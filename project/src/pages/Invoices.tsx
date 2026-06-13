import React, { useEffect, useState } from 'react';
import { Plus, Search, Eye, Trash2, FileText, CheckCircle, X, Download, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate, getDaysOverdue, addDays, generateInvoiceNumber, getReminderMessage, today, formatDateInput, generateInvoiceHTML, openWhatsAppReminder, validateMobile, sanitizeMobile } from '../lib/utils';
import { useCompanySettings } from '../lib/companySettings';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { invoiceStatusBadge } from '../components/ui/Badge';
import type { Invoice, InvoiceItem, Customer } from '../types';

interface Toast { id: string; type: 'success' | 'error'; message: string; }
interface InvoicesProps { onToast: (t: Omit<Toast, 'id'>) => void; }
interface LineItem { product_name: string; quality: string; quantity: string; unit: string; rate: string; gst_percentage: string; gst_type: 'cgst_sgst' | 'igst'; amount: number; }
const blankItem = (): LineItem => ({ product_name: '', quality: '', quantity: '', unit: 'meters', rate: '', gst_percentage: '5', gst_type: 'igst', amount: 0 });

const TEXTILE_PRODUCTS = [
  'Cotton Fabric', 'Silk Fabric', 'Polyester Fabric', 'Rayon Fabric', 'Linen Fabric',
  'Georgette', 'Chiffon', 'Satin', 'Velvet', 'Denim', 'Twill', 'Poplin',
  'Muslin', 'Organza', 'Taffeta', 'Crepe', 'Jersey', 'Flannel',
  'Terry Cloth', 'Canvas', 'Jute Fabric', 'Nylon Fabric', 'Acrylic Fabric',
  'Lycra', 'Spandex', 'Viscose', 'Brocade', 'Damask', 'Lace', 'Net Fabric',
  'Sheer Fabric', 'Suede', 'Fleece', 'Neoprene', 'Microfiber',
  'Cotton Yarn', 'Polyester Yarn', 'Silk Yarn', 'Wool Yarn', 'Blended Yarn',
  'Embroidered Fabric', 'Printed Fabric', 'Dyed Fabric', 'Bleached Fabric',
  'Raw Silk', 'Cotton Voile', 'Polyester Satin', 'Nylon Taffeta',
  'Viscose Georgette', 'Cotton Lycra'
];

export default function Invoices({ onToast }: InvoicesProps) {
  const { settings: companySettings } = useCompanySettings();
  const [invoices, setInvoices] = useState<(Invoice & { customer?: Customer; items?: InvoiceItem[] })[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<(Invoice & { customer?: Customer; items?: InvoiceItem[] }) | null>(null);
  const [showPayment, setShowPayment] = useState<Invoice | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({ customer_id: '', invoice_date: today(), notes: '', discount: '0' });
  const [lineItems, setLineItems] = useState<LineItem[]>([blankItem()]);
  const [saving, setSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: today(), payment_method: 'bank_transfer', notes: '' });
  const [payingSaving, setPayingSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [invRes, custRes] = await Promise.all([
        supabase.from('invoices').select('*, customer:customers(*), items:invoice_items(*)').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('name'),
      ]);
      setInvoices(invRes.data ?? []);
      setCustomers(custRes.data ?? []);
      setCurrentPage(1);
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to load invoices' });
    } finally {
      setLoading(false);
    }
  }

  function calcItem(item: LineItem): number { const qty = parseFloat(item.quantity) || 0; const rate = parseFloat(item.rate) || 0; const gst = parseFloat(item.gst_percentage) || 0; const base = qty * rate; return parseFloat((base + base * gst / 100).toFixed(2)); }
  function updateItem(idx: number, field: keyof LineItem, value: string) { setLineItems(prev => { const next = [...prev]; next[idx] = { ...next[idx], [field]: value }; next[idx].amount = calcItem(next[idx]); return next; }); }
  const subtotal = lineItems.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0), 0);
  const gstTotal = lineItems.reduce((s, i) => { const base = (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0); return s + base * (parseFloat(i.gst_percentage) || 0) / 100; }, 0);
  const cgstTotal = lineItems.filter(i => i.gst_type === 'cgst_sgst').reduce((s, i) => { const base = (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0); return s + base * (parseFloat(i.gst_percentage) || 0) / 100 / 2; }, 0);
  const sgstTotal = cgstTotal;
  const igstTotal = lineItems.filter(i => i.gst_type === 'igst').reduce((s, i) => { const base = (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0); return s + base * (parseFloat(i.gst_percentage) || 0) / 100; }, 0);
  const discount = parseFloat(form.discount) || 0;
  const totalAmount = subtotal + gstTotal - discount;

  async function saveInvoice() {
    if (!form.customer_id) { onToast({ type: 'error', message: 'Select a customer' }); return; }
    if (lineItems.some(i => !i.product_name || !i.quantity || !i.rate)) { onToast({ type: 'error', message: 'Fill all item details' }); return; }
    setSaving(true);
    const customer = customers.find(c => c.id === form.customer_id)!;
    const dueDate = formatDateInput(addDays(form.invoice_date, customer.credit_period));
    const { data: countData } = await supabase.from('invoices').select('id', { count: 'exact' });
    const invoiceNumber = generateInvoiceNumber(countData?.length ?? 0);
    const { data: inv, error: invErr } = await supabase.from('invoices').insert({ invoice_number: invoiceNumber, invoice_date: form.invoice_date, due_date: dueDate, customer_id: form.customer_id, subtotal: parseFloat(subtotal.toFixed(2)), gst_amount: parseFloat(gstTotal.toFixed(2)), discount, total_amount: parseFloat(totalAmount.toFixed(2)), paid_amount: 0, status: 'sent', notes: form.notes || null }).select().single();
    if (invErr || !inv) { onToast({ type: 'error', message: invErr?.message ?? 'Failed' }); setSaving(false); return; }
    await supabase.from('invoice_items').insert(lineItems.map(i => ({ invoice_id: inv.id, product_name: i.product_name, quality: i.quality || null, quantity: parseFloat(i.quantity), unit: i.unit, rate: parseFloat(i.rate), gst_percentage: parseFloat(i.gst_percentage), gst_type: i.gst_type, amount: i.amount })));
    await supabase.from('invoices').update({ cgst_amount: parseFloat(cgstTotal.toFixed(2)), sgst_amount: parseFloat(sgstTotal.toFixed(2)), igst_amount: parseFloat(igstTotal.toFixed(2)) }).eq('id', inv.id);
    const reminderTypes: Array<{ type: string; offset: number }> = [{ type: '7_days_before', offset: -7 }, { type: '1_day_before', offset: -1 }, { type: 'due_date', offset: 0 }, { type: '3_days_overdue', offset: 3 }, { type: '10_days_overdue', offset: 10 }];
    await supabase.from('reminders').insert(reminderTypes.map(r => ({ invoice_id: inv.id, customer_id: form.customer_id, reminder_type: r.type, scheduled_date: formatDateInput(addDays(dueDate, r.offset)), status: 'pending', message: getReminderMessage(r.type, invoiceNumber, dueDate, totalAmount) })));
    await supabase.from('notifications').insert({ type: 'invoice_created', title: 'Invoice Created', message: `Invoice ${invoiceNumber} for ${customer.name} — ${formatCurrency(totalAmount)}`, entity_type: 'invoice', entity_id: inv.id });
    onToast({ type: 'success', message: `Invoice ${invoiceNumber} created` });
    setShowForm(false); setForm({ customer_id: '', invoice_date: today(), notes: '', discount: '0' }); setLineItems([blankItem()]); loadAll(); setSaving(false);
  }

  async function recordPayment() {
    if (!showPayment) return; const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) { onToast({ type: 'error', message: 'Enter valid amount' }); return; }
    setPayingSaving(true);
    await supabase.from('payments').insert({ invoice_id: showPayment.id, customer_id: showPayment.customer_id, amount, payment_date: paymentForm.payment_date, payment_method: paymentForm.payment_method, notes: paymentForm.notes || null });
    const newPaid = (showPayment.paid_amount ?? 0) + amount;
    const newStatus = newPaid >= showPayment.total_amount ? 'paid' : 'partial';
    await supabase.from('invoices').update({ paid_amount: newPaid, status: newStatus }).eq('id', showPayment.id);
    await supabase.from('notifications').insert({ type: 'payment_received', title: 'Payment Received', message: `${formatCurrency(amount)} received for ${showPayment.invoice_number}`, entity_type: 'invoice', entity_id: showPayment.id });
    onToast({ type: 'success', message: 'Payment recorded' }); setShowPayment(null); loadAll(); setPayingSaving(false);
  }

  async function deleteInvoice(id: string) {
    try {
      await supabase.from('invoices').delete().eq('id', id);
      onToast({ type: 'success', message: 'Invoice deleted' });
      loadAll();
      setDeleteConfirm(null);
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to delete invoice' });
    }
  }

  async function downloadInvoicePDF(invoice: Invoice & { customer?: Customer; items?: InvoiceItem[] }, customer: Customer | undefined, items: InvoiceItem[] | undefined) {
    try {
      if (!customer || !items) {
        onToast({ type: 'error', message: 'Invoice data incomplete' });
        return;
      }

      // Map invoice page data to generateInvoiceHTML expected format
      const mappedInvoice = {
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        amount: invoice.subtotal,
        gstAmount: invoice.gst_amount,
        cgstAmount: invoice.cgst_amount,
        sgstAmount: invoice.sgst_amount,
        igstAmount: invoice.igst_amount,
        totalAmount: invoice.total_amount,
        outstandingBalance: invoice.total_amount - invoice.paid_amount,
        notes: invoice.notes
      };

      const mappedCustomer = {
        name: customer.name,
        email: customer.email,
        phone: customer.mobile,
        address: customer.address,
        gstNumber: customer.gst_number
      };

      const mappedItems = items.map(item => ({
        description: `${item.product_name}${item.quality ? ` (${item.quality})` : ''}`,
        quantity: `${item.quantity} ${item.unit}`,
        rate: item.rate,
        amount: item.amount,
        gst: item.gst_percentage
      }));

      const htmlContent = generateInvoiceHTML(mappedInvoice, mappedCustomer, mappedItems, {
        name: companySettings.company_name,
        address: companySettings.company_address,
        gstNumber: companySettings.company_gst_number,
        phone: companySettings.company_phone,
        email: companySettings.company_email,
        bankName: companySettings.bank_name,
        bankAccount: companySettings.bank_account,
        bankIfsc: companySettings.bank_ifsc,
        footerText: companySettings.invoice_footer,
        logoUrl: companySettings.logo_url || undefined,
        primaryColor: companySettings.primary_color,
      });

      // Open in new window and trigger print
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        onToast({ type: 'error', message: 'Failed to open print window' });
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load before printing
      printWindow.onload = () => {
        printWindow.print();
      };

      // Also create blob download as fallback
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoice_number}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onToast({ type: 'success', message: 'Invoice PDF downloaded' });
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to download PDF' });
      console.error('PDF download error:', error);
    }
  }

  async function sendWhatsAppReminder(invoice: Invoice & { customer?: Customer; items?: InvoiceItem[] }) {
    try {
      if (!invoice.customer) {
        onToast({ type: 'error', message: 'Customer information missing' });
        return;
      }

      const phoneNumber = invoice.customer.whatsapp_number || invoice.customer.mobile;
      if (!phoneNumber) {
        onToast({ type: 'error', message: 'Customer has no phone number' });
        return;
      }

      if (!validateMobile(phoneNumber)) {
        onToast({ type: 'error', message: 'Invalid phone number' });
        return;
      }

      const balance = invoice.total_amount - invoice.paid_amount;
      const status = balance <= 0 ? 'paid' : `due on ${formatDate(invoice.due_date)}`;
      const message = `Dear ${invoice.customer.name}, your payment of ${formatCurrency(invoice.total_amount)} for Invoice #${invoice.invoice_number} (due ${formatDate(invoice.due_date)}) is ${status}. Outstanding: ${formatCurrency(balance)}. Please arrange payment. - TextileFlow`;

      const sanitizedPhone = sanitizeMobile(phoneNumber);
      openWhatsAppReminder(sanitizedPhone, message);

      // Log reminder in database
      await supabase.from('reminders').insert({
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        reminder_type: 'whatsapp',
        scheduled_date: today(),
        status: 'sent',
        message: message,
      });

      onToast({ type: 'success', message: 'WhatsApp reminder sent' });
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to send WhatsApp reminder' });
      console.error('WhatsApp reminder error:', error);
    }
  }

  const filtered = invoices.filter(inv => { const ms = inv.invoice_number.toLowerCase().includes(search.toLowerCase()) || (inv.customer as any)?.name?.toLowerCase().includes(search.toLowerCase()); const mst = statusFilter === 'all' || inv.status === statusFilter; return ms && mst; });

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedInvoices = filtered.slice(startIdx, endIdx);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"><option value="all">All Status</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="partial">Partial</option></select>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 whitespace-nowrap w-full sm:w-auto justify-center sm:justify-start"><Plus size={16} /> New Invoice</button>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" /></div> :
        filtered.length === 0 ? <EmptyState icon={FileText} title="No invoices" description="Create your first invoice." action={<button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700"><Plus size={14} /> New Invoice</button>} /> :
        <>
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Invoice</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden sm:table-cell">Customer</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden md:table-cell">Due Date</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Amount</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden lg:table-cell">Balance</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
            <th className="px-4 py-3 w-32"></th>
          </tr></thead><tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {paginatedInvoices.map(inv => { const balance = inv.total_amount - inv.paid_amount; const overdueDays = getDaysOverdue(inv.due_date); return (
              <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                <td className="px-4 py-3"><p className="font-medium text-slate-800 dark:text-slate-200">{inv.invoice_number}</p><p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(inv.invoice_date)}</p></td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden sm:table-cell">{(inv as any).customer?.name ?? '—'}</td>
                <td className="px-4 py-3 hidden md:table-cell"><p className="text-slate-600 dark:text-slate-400">{formatDate(inv.due_date)}</p>{overdueDays > 0 && inv.status !== 'paid' && <p className="text-xs text-red-500 font-medium">{overdueDays}d overdue</p>}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatCurrency(inv.total_amount)}</td>
                <td className="px-4 py-3 text-right hidden lg:table-cell"><span className={balance > 0 ? 'text-amber-700 dark:text-amber-500 font-medium' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>{balance > 0 ? formatCurrency(balance) : 'Paid'}</span></td>
                <td className="px-4 py-3">{invoiceStatusBadge(inv.status)}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-1 justify-end">
                  <button onClick={() => setViewInvoice(inv)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30" title="View"><Eye size={14} /></button>
                  {inv.status !== 'paid' && <button onClick={() => sendWhatsAppReminder(inv)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30" title="WhatsApp"><MessageCircle size={14} /></button>}
                  {inv.status !== 'paid' && <button onClick={() => { setShowPayment(inv); setPaymentForm({ amount: String(balance), payment_date: today(), payment_method: 'bank_transfer', notes: '' }); }} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30" title="Record Payment"><CheckCircle size={14} /></button>}
                  <button onClick={() => setDeleteConfirm(inv.id)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30" title="Delete"><Trash2 size={14} /></button>
                </div></td></tr>); })}
          </tbody></table></div>

          {/* Mobile Card View */}
          <div className="sm:hidden divide-y divide-slate-50 dark:divide-slate-700">
            {paginatedInvoices.map(inv => { const balance = inv.total_amount - inv.paid_amount; return (
              <div key={inv.id} className="p-4 space-y-3 hover:bg-slate-50 dark:hover:bg-slate-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{inv.invoice_number}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{(inv as any).customer?.name ?? '—'}</p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatCurrency(inv.total_amount)}</p>
                    {balance > 0 && <p className="text-xs text-amber-700 dark:text-amber-500 font-medium whitespace-nowrap">{formatCurrency(balance)} due</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>{invoiceStatusBadge(inv.status)}</div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setViewInvoice(inv)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30"><Eye size={14} /></button>
                    {inv.status !== 'paid' && <button onClick={() => sendWhatsAppReminder(inv)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"><MessageCircle size={14} /></button>}
                    {inv.status !== 'paid' && <button onClick={() => { setShowPayment(inv); setPaymentForm({ amount: String(balance), payment_date: today(), payment_method: 'bank_transfer', notes: '' }); }} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"><CheckCircle size={14} /></button>}
                    <button onClick={() => setDeleteConfirm(inv.id)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );})}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Showing {Math.min(startIdx + 1, filtered.length)}-{Math.min(endIdx, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>}
      </div>

      {showForm && <Modal title="Create Invoice" onClose={() => setShowForm(false)} size="xl"><div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2"><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Customer *</label><select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"><option value="">Select customer...</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.credit_period} days credit)</option>)}</select></div>
          <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Invoice Date</label><input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
        </div>
        {form.customer_id && <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-700 rounded-xl px-4 py-3"><p className="text-xs text-teal-700 dark:text-teal-400 font-medium">Due Date: {formatDate(formatDateInput(addDays(form.invoice_date, customers.find(c => c.id === form.customer_id)!.credit_period)))} ({customers.find(c => c.id === form.customer_id)!.credit_period} days)</p></div>}
        <div><div className="flex items-center justify-between mb-2"><label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Items</label><button onClick={() => setLineItems(p => [...p, blankItem()])} className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium flex items-center gap-1"><Plus size={12} /> Add Item</button></div>
          <div className="space-y-2">
            <datalist id="textile-products">
              {TEXTILE_PRODUCTS.map((product, idx) => (
                <option key={idx} value={product} />
              ))}
            </datalist>
            {lineItems.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-start bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
              <div className="col-span-12 sm:col-span-1 flex items-center"><span className="text-xs font-medium text-slate-500 dark:text-slate-400">Item {idx + 1}</span></div>
              <div className="col-span-12 sm:col-span-3"><input list="textile-products" value={item.product_name} onChange={e => updateItem(idx, 'product_name', e.target.value)} placeholder="Product" className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
              <div className="col-span-12 sm:col-span-2"><input value={item.quality} onChange={e => updateItem(idx, 'quality', e.target.value)} placeholder="Quality" className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
              <div className="col-span-6 sm:col-span-1"><input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="Qty" className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
              <div className="col-span-6 sm:col-span-1"><select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200"><option value="meters">m</option><option value="kg">kg</option><option value="pcs">pcs</option><option value="rolls">rolls</option></select></div>
              <div className="col-span-6 sm:col-span-2"><input type="number" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} placeholder="Rate" className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
              <div className="col-span-6 sm:col-span-1"><select value={item.gst_type} onChange={e => updateItem(idx, 'gst_type', e.target.value)} className="w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200"><option value="igst">IGST</option><option value="cgst_sgst">CGST+SGST</option></select></div>
              <div className="col-span-3 sm:col-span-1"><select value={item.gst_percentage} onChange={e => updateItem(idx, 'gst_percentage', e.target.value)} className="w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-xs bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200"><option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option></select></div>
              <div className="col-span-3 sm:col-span-1 text-right"><p className="text-xs font-semibold text-slate-700 dark:text-slate-300 py-2">{formatCurrency(item.amount)}</p></div>
              <div className="col-span-2 sm:col-span-1 flex justify-end pt-2">{lineItems.length > 1 && <button onClick={() => setLineItems(p => p.filter((_, i) => i !== idx))} className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400"><X size={14} /></button>}</div>
            </div>))}
          </div>
        </div>
        <div className="flex flex-col sm:items-end gap-1 pt-2 border-t border-slate-100 dark:border-slate-700">
          <div className="flex gap-8 text-sm text-slate-600 dark:text-slate-400"><span>Subtotal</span><span className="font-medium w-28 text-right">{formatCurrency(subtotal)}</span></div>
          {cgstTotal > 0 && <div className="flex gap-8 text-sm text-slate-600 dark:text-slate-400"><span>CGST</span><span className="font-medium w-28 text-right">{formatCurrency(cgstTotal)}</span></div>}
          {sgstTotal > 0 && <div className="flex gap-8 text-sm text-slate-600 dark:text-slate-400"><span>SGST</span><span className="font-medium w-28 text-right">{formatCurrency(sgstTotal)}</span></div>}
          {igstTotal > 0 && <div className="flex gap-8 text-sm text-slate-600 dark:text-slate-400"><span>IGST</span><span className="font-medium w-28 text-right">{formatCurrency(igstTotal)}</span></div>}
          <div className="flex gap-8 text-sm text-slate-600 dark:text-slate-400"><span>Total GST</span><span className="font-medium w-28 text-right">{formatCurrency(gstTotal)}</span></div>
          <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 flex-col sm:flex-row"><span className="sm:order-first">Discount</span><input type="number" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} className="w-full sm:w-28 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-right bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
          <div className="flex gap-8 text-base font-bold text-slate-800 dark:text-slate-200 pt-1 border-t border-slate-200 dark:border-slate-600 mt-1 w-full sm:w-auto justify-between sm:justify-normal"><span>Total</span><span className="w-28 text-right text-teal-700 dark:text-teal-400">{formatCurrency(totalAmount)}</span></div>
        </div>
        <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" /></div>
        <div className="flex gap-3 pt-2 flex-col sm:flex-row"><button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button><button onClick={saveInvoice} disabled={saving} className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-60">{saving ? 'Creating...' : 'Create Invoice'}</button></div>
      </div></Modal>}

      {viewInvoice && <Modal title={`Invoice ${viewInvoice.invoice_number}`} onClose={() => setViewInvoice(null)} size="lg"><div><div id="print-invoice" className="space-y-5">
        <div className="flex items-start justify-between"><div><h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">INVOICE</h2><p className="text-sm text-slate-500 dark:text-slate-400">{viewInvoice.invoice_number}</p></div><div className="text-right"><p className="text-sm text-slate-600 dark:text-slate-400">Date: {formatDate(viewInvoice.invoice_date)}</p><p className="text-sm text-slate-600 dark:text-slate-400">Due: {formatDate(viewInvoice.due_date)}</p><div className="mt-1">{invoiceStatusBadge(viewInvoice.status)}</div></div></div>
        <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4"><p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Bill To</p><p className="font-semibold text-slate-800 dark:text-slate-200">{(viewInvoice as any).customer?.name}</p>{(viewInvoice as any).customer?.address && <p className="text-sm text-slate-600 dark:text-slate-400">{(viewInvoice as any).customer.address}</p>}{(viewInvoice as any).customer?.gst_number && <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">GST: {(viewInvoice as any).customer.gst_number}</p>}<p className="text-sm text-slate-600 dark:text-slate-400">{(viewInvoice as any).customer?.mobile}</p></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b-2 border-slate-200 dark:border-slate-600"><th className="text-left py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Product</th><th className="text-right py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Qty</th><th className="text-right py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Rate</th><th className="text-right py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">GST%</th><th className="text-right py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Amount</th></tr></thead><tbody>
          {(viewInvoice.items ?? []).map(item => (<tr key={item.id} className="border-b border-slate-50 dark:border-slate-700"><td className="py-2"><p className="font-medium text-slate-800 dark:text-slate-200">{item.product_name}</p>{item.quality && <p className="text-xs text-slate-400 dark:text-slate-500">{item.quality}</p>}</td><td className="text-right py-2 text-slate-600 dark:text-slate-400">{item.quantity} {item.unit}</td><td className="text-right py-2 text-slate-600 dark:text-slate-400">{formatCurrency(item.rate)}</td><td className="text-right py-2 text-slate-600 dark:text-slate-400">{item.gst_percentage}%</td><td className="text-right py-2 font-medium text-slate-800 dark:text-slate-200">{formatCurrency(item.amount)}</td></tr>))}
        </tbody></table></div>
        <div className="flex flex-col sm:items-end gap-1 pt-2 border-t border-slate-200 dark:border-slate-600">
          <div className="flex gap-8 text-sm text-slate-600 dark:text-slate-400"><span>Subtotal</span><span className="w-28 text-right">{formatCurrency(viewInvoice.subtotal)}</span></div>
          {viewInvoice.cgst_amount > 0 && <div className="flex gap-8 text-sm text-slate-600 dark:text-slate-400"><span>CGST</span><span className="w-28 text-right">{formatCurrency(viewInvoice.cgst_amount)}</span></div>}
          {viewInvoice.sgst_amount > 0 && <div className="flex gap-8 text-sm text-slate-600 dark:text-slate-400"><span>SGST</span><span className="w-28 text-right">{formatCurrency(viewInvoice.sgst_amount)}</span></div>}
          {viewInvoice.igst_amount > 0 && <div className="flex gap-8 text-sm text-slate-600 dark:text-slate-400"><span>IGST</span><span className="w-28 text-right">{formatCurrency(viewInvoice.igst_amount)}</span></div>}
          <div className="flex gap-8 text-sm text-slate-600 dark:text-slate-400"><span>Total GST</span><span className="w-28 text-right">{formatCurrency(viewInvoice.gst_amount)}</span></div>
          {viewInvoice.discount > 0 && <div className="flex gap-8 text-sm text-slate-600 dark:text-slate-400"><span>Discount</span><span className="w-28 text-right text-emerald-600 dark:text-emerald-400">-{formatCurrency(viewInvoice.discount)}</span></div>}
          <div className="flex gap-8 text-base font-bold text-slate-800 dark:text-slate-200 pt-1 border-t border-slate-200 dark:border-slate-600 mt-1"><span>Total</span><span className="w-28 text-right text-teal-700 dark:text-teal-400">{formatCurrency(viewInvoice.total_amount)}</span></div>
          {viewInvoice.paid_amount > 0 && <><div className="flex gap-8 text-sm text-slate-600 dark:text-slate-400"><span>Paid</span><span className="w-28 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(viewInvoice.paid_amount)}</span></div><div className="flex gap-8 text-sm font-semibold text-red-600 dark:text-red-400"><span>Balance</span><span className="w-28 text-right">{formatCurrency(viewInvoice.total_amount - viewInvoice.paid_amount)}</span></div></>}
        </div>
        {viewInvoice.notes && <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3"><p className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">Notes</p><p className="text-sm text-slate-600 dark:text-slate-400">{viewInvoice.notes}</p></div>}
      </div>
      <div className="flex gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-slate-700 print:hidden flex-col sm:flex-row">
        <button onClick={() => downloadInvoicePDF(viewInvoice, (viewInvoice as any).customer, viewInvoice.items)} className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 flex-1 sm:flex-none"><Download size={16} /> Download PDF</button>
        <button onClick={() => window.print()} className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 flex-1 sm:flex-none">Print</button>
        {viewInvoice.status !== 'paid' && <button onClick={() => sendWhatsAppReminder(viewInvoice)} className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 flex-1 sm:flex-none"><MessageCircle size={16} /> WhatsApp Reminder</button>}
        {viewInvoice.status !== 'paid' && <button onClick={() => { setShowPayment(viewInvoice); setViewInvoice(null); setPaymentForm({ amount: String(viewInvoice.total_amount - viewInvoice.paid_amount), payment_date: today(), payment_method: 'bank_transfer', notes: '' }); }} className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 flex-1 sm:flex-none">Record Payment</button>}
      </div></div></Modal>}

      {showPayment && <Modal title="Record Payment" onClose={() => setShowPayment(null)} size="sm"><div className="space-y-4">
        <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3"><p className="text-xs text-slate-500 dark:text-slate-400">Invoice: <span className="font-semibold text-slate-700 dark:text-slate-300">{showPayment.invoice_number}</span></p><p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Outstanding: <span className="font-semibold text-amber-700 dark:text-amber-500">{formatCurrency(showPayment.total_amount - showPayment.paid_amount)}</span></p></div>
        <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Amount *</label><input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Payment Date</label><input type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Method</label><select value={paymentForm.payment_method} onChange={e => setPaymentForm(f => ({ ...f, payment_method: e.target.value as any }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"><option value="bank_transfer">Bank Transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="upi">UPI</option></select></div>
        <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Notes</label><input value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
        <div className="flex gap-3 pt-2"><button onClick={() => setShowPayment(null)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400">Cancel</button><button onClick={recordPayment} disabled={payingSaving} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">{payingSaving ? 'Saving...' : 'Record'}</button></div>
      </div></Modal>}

      {deleteConfirm && <Modal title="Delete Invoice" onClose={() => setDeleteConfirm(null)} size="sm"><p className="text-sm text-slate-600 dark:text-slate-400 mb-5">Delete this invoice and all items?</p><div className="flex gap-3"><button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400">Cancel</button><button onClick={() => deleteInvoice(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">Delete</button></div></Modal>}
    </div>
  );
}
