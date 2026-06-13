import React, { useEffect, useState, useRef } from 'react';
import { FileText, Users, Package, Download, BarChart2, TrendingUp, Clock, IndianRupee } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate, getDaysOverdue, getRiskCategory } from '../lib/utils';
import { useCompanySettings } from '../lib/companySettings';
import type { Invoice, Customer, Order, Payment } from '../types';

interface Toast { id: string; type: 'success' | 'error'; message: string; }
interface ReportsProps { onToast?: (t: Omit<Toast, 'id'>) => void; }

const STATUS_COLORS: Record<string, string> = { paid: '#10b981', sent: '#3b82f6', overdue: '#ef4444', partial: '#f59e0b', draft: '#94a3b8' };

export default function Reports({ onToast }: ReportsProps) {
  const { settings } = useCompanySettings();
  const reportRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{
    invoices: (Invoice & { customer?: Customer })[];
    customers: Customer[];
    orders: Order[];
    payments: Payment[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [activeSection, setActiveSection] = useState<'overview' | 'customers' | 'invoices'>('overview');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const [invRes, custRes, ordRes, payRes] = await Promise.all([
        supabase.from('invoices').select('*, customer:customers(*)').order('invoice_date', { ascending: false }),
        supabase.from('customers').select('*'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('payment_date', { ascending: false }),
      ]);
      setData({ invoices: invRes.data ?? [], customers: custRes.data ?? [], orders: ordRes.data ?? [], payments: payRes.data ?? [] });
    } catch { onToast?.({ type: 'error', message: 'Failed to load reports' }); }
    finally { setLoading(false); }
  }

  function getFilteredInvoices() {
    if (!data) return [];
    const now = new Date();
    return data.invoices.filter(inv => {
      const d = new Date(inv.invoice_date);
      if (period === 'daily') return d.toDateString() === now.toDateString();
      if (period === 'weekly') { const wa = new Date(now); wa.setDate(wa.getDate() - 7); return d >= wa; }
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }

  function downloadReport() {
    if (!reportRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const logoHTML = settings.logo_url
      ? `<img src="${settings.logo_url}" alt="Logo" style="max-height:60px;max-width:180px;object-fit:contain;margin-right:16px;" />`
      : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Report - ${settings.company_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #333; padding: 40px; }
    .header { display: flex; align-items: center; border-bottom: 3px solid ${settings.primary_color}; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 24px; font-weight: 700; color: ${settings.primary_color}; }
    .company-details { font-size: 11px; color: #666; line-height: 1.6; }
    .title { font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: ${settings.primary_color}; color: white; padding: 10px; font-size: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; font-size: 11px; color: #666; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    ${logoHTML}
    <div>
      <div class="company-name">${settings.company_name}</div>
      <div class="company-details">
        <p>${settings.company_address}</p>
        <p>GST: ${settings.company_gst_number} | Phone: ${settings.company_phone}</p>
      </div>
    </div>
  </div>
  <div class="title">Business Report - ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
  ${reportRef.current.innerHTML}
  <div class="footer">${settings.invoice_footer}</div>
</body>
</html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  }

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" /></div>;
  if (!data) return null;

  const filteredInvoices = getFilteredInvoices();
  const totalSales = filteredInvoices.reduce((s, i) => s + i.total_amount, 0);
  const totalCollected = filteredInvoices.reduce((s, i) => s + i.paid_amount, 0);
  const totalOutstanding = filteredInvoices.reduce((s, i) => s + (i.total_amount - i.paid_amount), 0);

  // Invoice status distribution
  const statusData = Object.entries(
    data.invoices.reduce((acc, inv) => { acc[inv.status] = (acc[inv.status] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  // Monthly revenue chart
  const monthlyData = (() => {
    const now = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const sales = data.invoices.filter(inv => { const d = new Date(inv.invoice_date); return d >= monthStart && d <= monthEnd; }).reduce((s, inv) => s + inv.total_amount, 0);
      const collections = data.payments.filter(p => { const d = new Date(p.payment_date); return d >= monthStart && d <= monthEnd; }).reduce((s, p) => s + p.amount, 0);
      result.push({ month: monthName, sales: Math.round(sales), collections: Math.round(collections) });
    }
    return result;
  })();

  // Customer analytics with payment history
  const customerAnalytics = data.customers.map(customer => {
    const custInvoices = data.invoices.filter(i => i.customer_id === customer.id);
    const custPayments = data.payments.filter(p => p.customer_id === customer.id);
    const totalBilled = custInvoices.reduce((s, i) => s + i.total_amount, 0);
    const totalPaid = custPayments.reduce((s, p) => s + p.amount, 0);
    const outstanding = totalBilled - totalPaid;
    const paidInvoices = custInvoices.filter(i => i.status === 'paid');
    const avgPaymentDays = paidInvoices.length > 0
      ? Math.round(paidInvoices.reduce((s, inv) => {
          const payForInv = data.payments.filter(p => p.invoice_id === inv.id);
          if (payForInv.length === 0) return s;
          const payDate = new Date(payForInv[payForInv.length - 1].payment_date);
          const invDate = new Date(inv.invoice_date);
          return s + Math.floor((payDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / paidInvoices.length)
      : null;
    const avgInvoiceAmount = custInvoices.length > 0 ? totalBilled / custInvoices.length : 0;
    const overdueInvoices = custInvoices.filter(i => i.status !== 'paid' && getDaysOverdue(i.due_date) > 0);

    return {
      customer, totalBilled, totalPaid, outstanding, avgPaymentDays,
      avgInvoiceAmount, invoiceCount: custInvoices.length, overdueCount: overdueInvoices.length,
    };
  }).sort((a, b) => b.totalBilled - a.totalBilled);

  const selectedCustomerData = selectedCustomer ? customerAnalytics.find(c => c.customer.id === selectedCustomer) : null;

  // Debtor aging
  const debtorMap = new Map<string, { customer: Customer; outstanding: number; maxOverdue: number; overdueCount: number }>();
  data.invoices.filter(i => i.status !== 'paid').forEach(inv => {
    const cust = data.customers.find(c => c.id === inv.customer_id);
    if (!cust) return;
    const overdue = getDaysOverdue(inv.due_date);
    const ex = debtorMap.get(inv.customer_id);
    if (ex) { ex.outstanding += inv.total_amount - inv.paid_amount; ex.maxOverdue = Math.max(ex.maxOverdue, overdue); if (overdue > 0) ex.overdueCount++; }
    else { debtorMap.set(inv.customer_id, { customer: cust, outstanding: inv.total_amount - inv.paid_amount, maxOverdue: overdue, overdueCount: overdue > 0 ? 1 : 0 }); }
  });
  const debtors = Array.from(debtorMap.values()).sort((a, b) => b.outstanding - a.outstanding);

  const sectionTabs: { id: typeof activeSection; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'customers', label: 'Customer History', icon: Users },
    { id: 'invoices', label: 'Invoice Details', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Top bar with tabs and download */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1 shadow-sm overflow-x-auto">
          {sectionTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveSection(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeSection === tab.id ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
        <button onClick={downloadReport} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Download size={16} /> Download Report
        </button>
      </div>

      <div ref={reportRef}>
        {/* OVERVIEW SECTION */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Period selector */}
            <div className="overflow-x-auto flex gap-2 pb-2 items-center">
              <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">Period:</span>
              {(['daily', 'weekly', 'monthly'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${period === p ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Sales</p>
                <p className="text-lg sm:text-xl font-bold text-teal-700 dark:text-teal-400 mt-1 whitespace-nowrap">{formatCurrency(totalSales)}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{filteredInvoices.length} invoices</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Collected</p>
                <p className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 whitespace-nowrap">{formatCurrency(totalCollected)}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{totalSales > 0 ? Math.round(totalCollected / totalSales * 100) : 0}%</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Outstanding</p>
                <p className="text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-400 mt-1 whitespace-nowrap">{formatCurrency(totalOutstanding)}</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue vs Collections */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><TrendingUp size={16} /> Revenue vs Collections</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="sales" name="Sales" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collections" name="Collections" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Invoice Status Distribution */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><FileText size={16} /> Invoice Status Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {statusData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.name.toLowerCase()] || '#94a3b8'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Debtor Aging */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2"><Users size={16} className="text-slate-500 dark:text-slate-400" /><h3 className="font-semibold text-slate-800 dark:text-slate-200">Debtor Aging Report</h3></div>
              </div>
              {debtors.length === 0 ? <div className="px-5 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">No outstanding debtors</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Customer</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Outstanding</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell">Max Overdue</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Risk</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                      {debtors.map(d => {
                        const risk = getRiskCategory(d.maxOverdue, d.outstanding, d.overdueCount);
                        return (
                          <tr key={d.customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{d.customer.name}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatCurrency(d.outstanding)}</td>
                            <td className="px-4 py-2.5 text-right hidden md:table-cell">{d.maxOverdue > 0 ? <span className="text-red-600 dark:text-red-400 font-medium">{d.maxOverdue}d</span> : <span className="text-emerald-600 dark:text-emerald-400">Current</span>}</td>
                            <td className="px-4 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${risk === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700' : risk === 'high' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-700' : risk === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700'}`}>{risk.charAt(0).toUpperCase() + risk.slice(1)}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Order Stats */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700"><div className="flex items-center gap-2"><Package size={16} className="text-slate-500 dark:text-slate-400" /><h3 className="font-semibold text-slate-800 dark:text-slate-200">Order Report</h3></div></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 dark:divide-slate-700">
                {[{ label: 'Total', value: data.orders.length, color: 'text-slate-700 dark:text-slate-300' }, { label: 'Active', value: data.orders.filter(o => !['delivered'].includes(o.status)).length, color: 'text-blue-700 dark:text-blue-400' }, { label: 'Delayed', value: data.orders.filter(o => o.status === 'delayed').length, color: 'text-red-700 dark:text-red-400' }, { label: 'Delivered', value: data.orders.filter(o => o.status === 'delivered').length, color: 'text-emerald-700 dark:text-emerald-400' }].map(s => (
                  <div key={s.label} className="px-5 py-4"><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p><p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMER HISTORY SECTION */}
        {activeSection === 'customers' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Customer list */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Customers</h3>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
                  {customerAnalytics.map(ca => (
                    <button key={ca.customer.id} onClick={() => setSelectedCustomer(ca.customer.id)}
                      className={`w-full text-left px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${selectedCustomer === ca.customer.id ? 'bg-teal-50 dark:bg-teal-950/30' : ''}`}>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{ca.customer.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{ca.invoiceCount} invoices</span>
                        <span className="text-xs font-medium text-teal-600 dark:text-teal-400 whitespace-nowrap">{formatCurrency(ca.totalBilled)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer detail */}
              <div className="lg:col-span-2 space-y-4">
                {selectedCustomerData ? (
                  <>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">{selectedCustomerData.customer.name}</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Total Billed</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatCurrency(selectedCustomerData.totalBilled)}</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Total Paid</p>
                          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatCurrency(selectedCustomerData.totalPaid)}</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Outstanding</p>
                          <p className="text-sm font-bold text-red-700 dark:text-red-400 whitespace-nowrap">{formatCurrency(selectedCustomerData.outstanding)}</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Avg Payment Days</p>
                          <p className="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1"><Clock size={14} />{selectedCustomerData.avgPaymentDays ?? 'N/A'}{selectedCustomerData.avgPaymentDays !== null ? 'd' : ''}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Avg Invoice Amount</p>
                          <p className="text-sm font-bold text-teal-700 dark:text-teal-400 whitespace-nowrap">{formatCurrency(selectedCustomerData.avgInvoiceAmount)}</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Overdue Invoices</p>
                          <p className={`text-sm font-bold ${selectedCustomerData.overdueCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{selectedCustomerData.overdueCount}</p>
                        </div>
                      </div>
                    </div>

                    {/* Customer invoice timeline chart */}
                    {(() => {
                      const custInvoices = data.invoices.filter(i => i.customer_id === selectedCustomer).sort((a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime());
                      const chartData = custInvoices.map(inv => ({ date: formatDate(inv.invoice_date), amount: inv.total_amount, paid: inv.paid_amount }));
                      return chartData.length > 0 ? (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><TrendingUp size={16} /> Invoice Trend</h3>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                              <Legend wrapperStyle={{ fontSize: 12 }} />
                              <Line type="monotone" dataKey="amount" name="Billed" stroke="#0d9488" strokeWidth={2} dot={{ r: 4 }} />
                              <Line type="monotone" dataKey="paid" name="Paid" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : null;
                    })()}

                    {/* Customer invoices list */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Invoice History</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Invoice</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:table-cell">Date</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Amount</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:table-cell">Paid</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Status</th>
                          </tr></thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                            {data.invoices.filter(i => i.customer_id === selectedCustomer).map(inv => (
                              <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{inv.invoice_number}</td>
                                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{formatDate(inv.invoice_date)}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatCurrency(inv.total_amount)}</td>
                                <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 hidden sm:table-cell whitespace-nowrap">{formatCurrency(inv.paid_amount)}</td>
                                <td className="px-4 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${inv.status === 'paid' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700' : inv.status === 'overdue' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-12 text-center">
                    <Users size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400">Select a customer to view their payment history</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* INVOICE DETAILS SECTION */}
        {activeSection === 'invoices' && (
          <div className="space-y-6">
            <div className="overflow-x-auto flex gap-2 pb-2 items-center">
              <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">Period:</span>
              {(['daily', 'weekly', 'monthly'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${period === p ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex-wrap gap-2">
                <div className="flex items-center gap-2"><FileText size={16} className="text-slate-500 dark:text-slate-400" /><h3 className="font-semibold text-slate-800 dark:text-slate-200">Invoice Report - {period.charAt(0).toUpperCase() + period.slice(1)}</h3></div>
              </div>
              {filteredInvoices.length === 0 ? <div className="px-5 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">No invoices in this period</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Invoice</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:table-cell">Customer</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell">Date</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Amount</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:table-cell">Paid</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Status</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                      {filteredInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{inv.invoice_number}</td>
                          <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 hidden sm:table-cell">{(inv as any).customer?.name ?? '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 hidden md:table-cell">{formatDate(inv.invoice_date)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatCurrency(inv.total_amount)}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 hidden sm:table-cell whitespace-nowrap">{formatCurrency(inv.paid_amount)}</td>
                          <td className="px-4 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${inv.status === 'paid' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700' : inv.status === 'overdue' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
