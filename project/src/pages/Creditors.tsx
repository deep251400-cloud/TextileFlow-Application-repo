import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Landmark, Phone, CreditCard, X, IndianRupee } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate, today, formatDateInput } from '../lib/utils';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import MetricCard from '../components/ui/MetricCard';
import type { Creditor, CreditorPayment } from '../types';

interface Toast { id: string; type: 'success' | 'error'; message: string; }
interface CreditorsProps { onToast: (t: Omit<Toast, 'id'>) => void; }

const categoryColors: Record<string, string> = {
  supplier: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  vendor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  service_provider: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  other: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

const blankCreditor = () => ({ name: '', mobile: '', whatsapp: '', gst_number: '', address: '', credit_period: '30', category: 'supplier' as const, notes: '' });

export default function Creditors({ onToast }: CreditorsProps) {
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState<Creditor | null>(null);
  const [form, setForm] = useState(blankCreditor());
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: today(), payment_method: 'bank_transfer' as const, notes: '' });
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const { data } = await supabase.from('creditors').select('*').order('name');
      setCreditors(data ?? []);
    } catch { onToast({ type: 'error', message: 'Failed to load creditors' }); }
    finally { setLoading(false); }
  }

  const filtered = creditors.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.mobile.includes(search);
    const matchCategory = categoryFilter === 'all' || c.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalOutstanding = creditors.reduce((s, c) => s + c.outstanding_balance, 0);

  async function saveCreditor() {
    if (!form.name || !form.mobile) { onToast({ type: 'error', message: 'Name and mobile are required' }); return; }
    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase.from('creditors').update({
          name: form.name, mobile: form.mobile, whatsapp: form.whatsapp || null,
          gst_number: form.gst_number || null, address: form.address || null,
          credit_period: parseInt(form.credit_period) || 30, category: form.category, notes: form.notes || null,
        }).eq('id', editId);
        if (error) throw error;
        onToast({ type: 'success', message: 'Creditor updated' });
      } else {
        const { error } = await supabase.from('creditors').insert({
          name: form.name, mobile: form.mobile, whatsapp: form.whatsapp || null,
          gst_number: form.gst_number || null, address: form.address || null,
          credit_period: parseInt(form.credit_period) || 30, category: form.category, notes: form.notes || null,
        });
        if (error) throw error;
        onToast({ type: 'success', message: 'Creditor added' });
      }
      setShowForm(false); setEditId(null); setForm(blankCreditor()); loadAll();
    } catch { onToast({ type: 'error', message: 'Failed to save creditor' }); }
    finally { setSaving(false); }
  }

  async function deleteCreditor(id: string) {
    try {
      const { error } = await supabase.from('creditors').delete().eq('id', id);
      if (error) throw error;
      onToast({ type: 'success', message: 'Creditor deleted' }); loadAll();
    } catch { onToast({ type: 'error', message: 'Failed to delete' }); }
    setDeleteConfirm(null);
  }

  async function recordPayment() {
    if (!showPayment) return;
    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) { onToast({ type: 'error', message: 'Enter valid amount' }); return; }
    setSaving(true);
    try {
      await supabase.from('creditor_payments').insert({
        creditor_id: showPayment.id, amount, payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method, notes: paymentForm.notes || null,
      });
      const newBalance = Math.max(0, showPayment.outstanding_balance - amount);
      await supabase.from('creditors').update({ outstanding_balance: newBalance }).eq('id', showPayment.id);
      onToast({ type: 'success', message: `Payment of ${formatCurrency(amount)} recorded` });
      setShowPayment(null); setPaymentForm({ amount: '', payment_date: today(), payment_method: 'bank_transfer', notes: '' }); loadAll();
    } catch { onToast({ type: 'error', message: 'Failed to record payment' }); }
    finally { setSaving(false); }
  }

  function openEdit(c: Creditor) {
    setForm({ name: c.name, mobile: c.mobile, whatsapp: c.whatsapp || '', gst_number: c.gst_number || '', address: c.address || '', credit_period: String(c.credit_period), category: c.category, notes: c.notes || '' });
    setEditId(c.id); setShowForm(true);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" /></div>;

  const inputClass = 'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5';

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Creditors" value={String(creditors.length)} subtitle="All creditors" icon={Landmark} color="blue" />
        <MetricCard title="Outstanding" value={formatCurrency(totalOutstanding)} subtitle="Total payable" icon={IndianRupee} color="red" />
        <MetricCard title="Suppliers" value={String(creditors.filter(c => c.category === 'supplier').length)} subtitle="Raw material" icon={Landmark} color="teal" />
        <MetricCard title="Service Providers" value={String(creditors.filter(c => c.category === 'service_provider').length)} subtitle="External services" icon={Landmark} color="amber" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Search creditors..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} />
          </div>
          <select className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-200" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }}>
            <option value="all">All Categories</option>
            <option value="supplier">Supplier</option>
            <option value="vendor">Vendor</option>
            <option value="service_provider">Service Provider</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button onClick={() => { setForm(blankCreditor()); setEditId(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} /> Add Creditor
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Category</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Mobile</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Outstanding</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {paginated.length === 0 ? (
              <tr><td colSpan={5}><EmptyState icon={Landmark} title="No creditors" description="Add your first creditor" /></td></tr>
            ) : paginated.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{c.name}</p>
                  {c.gst_number && <p className="text-xs text-slate-500 dark:text-slate-400">GST: {c.gst_number}</p>}
                </td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${categoryColors[c.category]}`}>{c.category.replace('_', ' ')}</span></td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{c.mobile}</td>
                <td className="px-4 py-3 text-right"><p className="text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatCurrency(c.outstanding_balance)}</p></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setShowPayment(c)} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors" title="Record payment"><CreditCard size={16} /></button>
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title="Edit"><Edit2 size={16} /></button>
                    <button onClick={() => setDeleteConfirm(c.id)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Delete"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {paginated.length === 0 ? <EmptyState icon={Landmark} title="No creditors" description="Add your first creditor" /> : paginated.map(c => (
          <div key={c.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <div><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{c.name}</p><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${categoryColors[c.category]}`}>{c.category.replace('_', ' ')}</span></div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatCurrency(c.outstanding_balance)}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
              <Phone size={12} /> {c.mobile}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPayment(c)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium"><CreditCard size={14} /> Pay</button>
              <button onClick={() => openEdit(c)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium"><Edit2 size={14} /> Edit</button>
              <button onClick={() => setDeleteConfirm(c.id)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium"><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50">Prev</button>
          <span className="text-sm text-slate-600 dark:text-slate-400">{currentPage} / {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50">Next</button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && <Modal onClose={() => { setShowForm(false); setEditId(null); }} title={editId ? 'Edit Creditor' : 'Add Creditor'}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Name *</label><input className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className={labelClass}>Mobile *</label><input className={inputClass} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>WhatsApp</label><input className={inputClass} value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} /></div>
            <div><label className={labelClass}>GST Number</label><input className={inputClass} value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} /></div>
          </div>
          <div><label className={labelClass}>Address</label><input className={inputClass} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Credit Period (days)</label><input type="number" className={inputClass} value={form.credit_period} onChange={e => setForm(f => ({ ...f, credit_period: e.target.value }))} /></div>
            <div><label className={labelClass}>Category</label>
              <select className={inputClass} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))}>
                <option value="supplier">Supplier</option><option value="vendor">Vendor</option>
                <option value="service_provider">Service Provider</option><option value="other">Other</option>
              </select>
            </div>
          </div>
          <div><label className={labelClass}>Notes</label><textarea className={`${inputClass} h-20 resize-none`} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
            <button onClick={saveCreditor} disabled={saving} className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">{saving ? 'Saving...' : editId ? 'Update' : 'Add Creditor'}</button>
          </div>
        </div>
      </Modal>}

      {/* Record Payment Modal */}
      {showPayment && <Modal onClose={() => setShowPayment(null)} title="Record Payment">
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{showPayment.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Outstanding: {formatCurrency(showPayment.outstanding_balance)}</p>
            </div>
            <div><label className={labelClass}>Amount *</label><input type="number" className={inputClass} placeholder="0" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelClass}>Payment Date</label><input type="date" className={inputClass} value={paymentForm.payment_date} onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))} /></div>
              <div><label className={labelClass}>Method</label>
                <select className={inputClass} value={paymentForm.payment_method} onChange={e => setPaymentForm(f => ({ ...f, payment_method: e.target.value as any }))}>
                  <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option><option value="upi">UPI</option>
                </select>
              </div>
            </div>
            <div><label className={labelClass}>Notes</label><input className={inputClass} value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowPayment(null)} className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400">Cancel</button>
              <button onClick={recordPayment} disabled={saving} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">{saving ? 'Saving...' : 'Record Payment'}</button>
            </div>
          </div>
      </Modal>}

      {/* Delete Confirm */}
      {deleteConfirm && <Modal onClose={() => setDeleteConfirm(null)} title="Delete Creditor?" size="sm">
        <div className="text-center sm:text-left">
          <div className="mx-auto sm:mx-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <Trash2 size={24} className="text-red-600 dark:text-red-400" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Are you sure you want to delete this creditor?</p>
          <p className="text-xs text-slate-500 dark:text-slate-500">This action cannot be undone. All payment records will also be deleted.</p>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
          <button onClick={() => deleteCreditor(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg">Delete</button>
        </div>
      </Modal>}
    </div>
  );
}
