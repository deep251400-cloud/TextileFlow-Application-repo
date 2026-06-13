import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Users, Phone, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import type { Customer } from '../types';

interface Toast { id: string; type: 'success' | 'error'; message: string; }
interface CustomersProps { onToast: (t: Omit<Toast, 'id'>) => void; }
const defaultForm = { name: '', mobile: '', whatsapp: '', gst_number: '', address: '', credit_period: 30, credit_limit: 0 };

export default function Customers({ onToast }: CustomersProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const { data } = await supabase.from('customers').select('*').order('name');
      setCustomers(data ?? []);
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to load customers' });
    } finally {
      setLoading(false);
    }
  }

  function openCreate() { setEditingId(null); setForm(defaultForm); setShowModal(true); }

  function openEdit(c: Customer) {
    setEditingId(c.id);
    setForm({ name: c.name, mobile: c.mobile, whatsapp: c.whatsapp ?? '', gst_number: c.gst_number ?? '', address: c.address ?? '', credit_period: c.credit_period, credit_limit: c.credit_limit });
    setShowModal(true);
  }

  async function save() {
    if (!form.name.trim() || !form.mobile.trim()) { onToast({ type: 'error', message: 'Name and mobile number are required' }); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), mobile: form.mobile.trim(), whatsapp: form.whatsapp.trim() || null, gst_number: form.gst_number.trim() || null, address: form.address.trim() || null, credit_period: Number(form.credit_period), credit_limit: Number(form.credit_limit) };
      if (editingId) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editingId);
        if (error) onToast({ type: 'error', message: error.message }); else { onToast({ type: 'success', message: 'Customer updated' }); setShowModal(false); load(); }
      } else {
        const { error } = await supabase.from('customers').insert(payload);
        if (error) onToast({ type: 'error', message: error.message }); else { onToast({ type: 'success', message: 'Customer added' }); setShowModal(false); load(); }
      }
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to save customer' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer(id: string) {
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) onToast({ type: 'error', message: 'Cannot delete: linked records exist' }); else { onToast({ type: 'success', message: 'Customer deleted' }); load(); }
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to delete customer' });
    }
    setDeleteConfirm(null);
  }

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.mobile.includes(search) || (c.gst_number ?? '').toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedCustomers = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" /><input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Search customers..." className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 whitespace-nowrap w-full sm:w-auto justify-center"><Plus size={16} /> Add Customer</button>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" /></div> :
        paginatedCustomers.length === 0 ? <EmptyState icon={Users} title="No customers found" description={search ? 'No match.' : 'Add your first customer.'} action={!search ? <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700"><Plus size={14} /> Add Customer</button> : undefined} /> :
        <>
          {/* Desktop table view */}
          <div className="hidden sm:block overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Customer</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Mobile</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">GST Number</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden lg:table-cell">Credit Period</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden lg:table-cell">Credit Limit</th>
            <th className="px-4 py-3 w-20"></th>
          </tr></thead><tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {paginatedCustomers.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700"><td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-700 dark:text-teal-400 font-bold text-sm flex-shrink-0">{c.name.charAt(0).toUpperCase()}</div><div><p className="font-medium text-slate-800 dark:text-slate-200">{c.name}</p><p className="text-xs text-slate-400 dark:text-slate-500 sm:hidden">{c.mobile}</p></div></div></td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden sm:table-cell"><div className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400 dark:text-slate-500" />{c.mobile}</div></td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden md:table-cell">{c.gst_number ? <div className="flex items-center gap-1.5"><CreditCard size={13} className="text-slate-400 dark:text-slate-500" /><span className="font-mono text-xs">{c.gst_number}</span></div> : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
              <td className="px-4 py-3 text-right hidden lg:table-cell"><span className="text-slate-700 dark:text-slate-300 font-medium">{c.credit_period} days</span></td>
              <td className="px-4 py-3 text-right hidden lg:table-cell"><span className="text-slate-700 dark:text-slate-300 font-medium">{formatCurrency(c.credit_limit)}</span></td>
              <td className="px-4 py-3"><div className="flex items-center gap-1 justify-end"><button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20"><Edit2 size={14} /></button><button onClick={() => setDeleteConfirm(c.id)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={14} /></button></div></td></tr>
            ))}
          </tbody></table></div>

          {/* Mobile card view */}
          <div className="sm:hidden divide-y divide-slate-50 dark:divide-slate-700">
            {paginatedCustomers.map(c => (
              <div key={c.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-700 dark:text-teal-400 font-bold text-sm flex-shrink-0">{c.name.charAt(0).toUpperCase()}</div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{c.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.mobile}</p>
                    {c.gst_number && <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{c.gst_number}</p>}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => openEdit(c)} className="flex-1 px-3 py-1.5 rounded-lg text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/40"><Edit2 size={13} className="inline mr-1" />Edit</button>
                  <button onClick={() => setDeleteConfirm(c.id)} className="flex-1 px-3 py-1.5 rounded-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40"><Trash2 size={13} className="inline mr-1" />Delete</button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs text-slate-600 dark:text-slate-400">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>}
      </div>
      {showModal && <Modal title={editingId ? 'Edit Customer' : 'Add Customer'} onClose={() => setShowModal(false)} size="md"><div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Customer Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ravi Textiles" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Mobile Number *</label><input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="9876543210" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">WhatsApp Number</label><input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="Same as mobile" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">GST Number</label><input value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value.toUpperCase() }))} placeholder="24XXXXX0000X1ZX" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Credit Period (Days)</label><input type="number" value={form.credit_period} onChange={e => setForm(f => ({ ...f, credit_period: Number(e.target.value) }))} min={0} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Credit Limit</label><input type="number" value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: Number(e.target.value) }))} min={0} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Address</label><textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" /></div>
        </div>
        <div className="flex gap-3 pt-2"><button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button><button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update' : 'Add Customer'}</button></div>
      </div></Modal>}
      {deleteConfirm && <Modal title="Delete Customer" onClose={() => setDeleteConfirm(null)} size="sm"><p className="text-sm text-slate-600 dark:text-slate-400 mb-5">Delete this customer permanently?</p><div className="flex gap-3"><button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button><button onClick={() => deleteCustomer(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">Delete</button></div></Modal>}
    </div>
  );
}
