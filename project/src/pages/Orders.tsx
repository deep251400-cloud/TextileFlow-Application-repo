import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, getDaysOverdue, generateOrderNumber, today } from '../lib/utils';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { orderStatusBadge } from '../components/ui/Badge';
import type { Order, Customer } from '../types';

interface Toast { id: string; type: 'success' | 'error'; message: string; }
interface OrdersProps { onToast: (t: Omit<Toast, 'id'>) => void; }
const ORDER_STATUSES = [{ value: 'ordered', label: 'Ordered' }, { value: 'production_started', label: 'Production Started' }, { value: 'in_process', label: 'In Process' }, { value: 'ready', label: 'Ready' }, { value: 'dispatched', label: 'Dispatched' }, { value: 'delivered', label: 'Delivered' }, { value: 'delayed', label: 'Delayed' }];

export default function Orders({ onToast }: OrdersProps) {
  const [orders, setOrders] = useState<(Order & { customer?: Customer | null })[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ mill_name: '', product_name: '', quantity: '', unit: 'meters', order_date: today(), expected_delivery_date: '', actual_delivery_date: '', customer_id: '', status: 'ordered' as Order['status'], notes: '' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [ordRes, custRes] = await Promise.all([supabase.from('orders').select('*, customer:customers(*)').order('created_at', { ascending: false }), supabase.from('customers').select('*').order('name')]);
      const today_ = new Date(); today_.setHours(0, 0, 0, 0);
      const ords = (ordRes.data ?? []).map(o => { const exp = new Date(o.expected_delivery_date); if (exp < today_ && !['delivered', 'delayed'].includes(o.status)) return { ...o, status: 'delayed' as Order['status'] }; return o; });
      setOrders(ords as any); setCustomers(custRes.data ?? []);
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to load orders' });
    } finally {
      setLoading(false);
    }
  }

  function openCreate() { setEditingId(null); setForm({ mill_name: '', product_name: '', quantity: '', unit: 'meters', order_date: today(), expected_delivery_date: '', actual_delivery_date: '', customer_id: '', status: 'ordered', notes: '' }); setShowModal(true); }
  function openEdit(o: Order) { setEditingId(o.id); setForm({ mill_name: o.mill_name, product_name: o.product_name, quantity: String(o.quantity), unit: o.unit, order_date: o.order_date, expected_delivery_date: o.expected_delivery_date, actual_delivery_date: o.actual_delivery_date ?? '', customer_id: o.customer_id ?? '', status: o.status, notes: o.notes ?? '' }); setShowModal(true); }

  async function save() {
    if (!form.mill_name || !form.product_name || !form.quantity || !form.expected_delivery_date) { onToast({ type: 'error', message: 'Fill required fields' }); return; }
    setSaving(true);
    try {
      const payload = { mill_name: form.mill_name, product_name: form.product_name, quantity: parseFloat(form.quantity), unit: form.unit, order_date: form.order_date, expected_delivery_date: form.expected_delivery_date, actual_delivery_date: form.actual_delivery_date || null, customer_id: form.customer_id || null, status: form.status, notes: form.notes || null };
      if (editingId) {
        const { error } = await supabase.from('orders').update(payload).eq('id', editingId);
        if (error) onToast({ type: 'error', message: error.message }); else { onToast({ type: 'success', message: 'Order updated' }); setShowModal(false); loadAll(); }
      } else {
        const { data: countData } = await supabase.from('orders').select('id', { count: 'exact' });
        const orderNumber = generateOrderNumber(countData?.length ?? 0);
        const { error } = await supabase.from('orders').insert({ ...payload, order_number: orderNumber });
        if (error) onToast({ type: 'error', message: error.message }); else { onToast({ type: 'success', message: `Order ${orderNumber} created` }); setShowModal(false); loadAll(); }
      }
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to save order' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder(id: string) {
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) onToast({ type: 'error', message: error.message }); else { onToast({ type: 'success', message: 'Order deleted' }); loadAll(); }
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to delete order' });
    }
    setDeleteConfirm(null);
  }

  const filtered = orders.filter(o => { const ms = o.order_number.toLowerCase().includes(search.toLowerCase()) || o.mill_name.toLowerCase().includes(search.toLowerCase()) || o.product_name.toLowerCase().includes(search.toLowerCase()) || (o.customer as any)?.name?.toLowerCase().includes(search.toLowerCase()); return ms && (statusFilter === 'all' || o.status === statusFilter); });
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedOrders = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const delayedCount = orders.filter(o => o.status === 'delayed').length;

  return (
    <div className="space-y-5">
      {delayedCount > 0 && <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3"><AlertTriangle size={18} className="text-amber-600 dark:text-amber-500 flex-shrink-0" /><p className="text-sm text-amber-800 dark:text-amber-200 font-medium">{delayedCount} order{delayedCount > 1 ? 's are' : ' is'} delayed</p></div>}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" /><input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Search orders..." className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 whitespace-nowrap w-full sm:w-auto justify-center"><Plus size={16} /> New Order</button>
      </div>

      {/* Status filter tabs - horizontally scrollable on mobile */}
      <div className="overflow-x-auto flex gap-2 pb-2">
        <button onClick={() => { setStatusFilter('all'); setCurrentPage(1); }} className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${statusFilter === 'all' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600'}`}>All</button>
        {ORDER_STATUSES.map(s => (<button key={s.value} onClick={() => { setStatusFilter(s.value); setCurrentPage(1); }} className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${statusFilter === s.value ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600'}`}>{s.label}</button>))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{ label: 'Total Orders', value: orders.length, color: 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300' }, { label: 'Active', value: orders.filter(o => !['delivered'].includes(o.status)).length, color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' }, { label: 'Delayed', value: delayedCount, color: delayedCount > 0 ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400' }, { label: 'Delivered', value: orders.filter(o => o.status === 'delivered').length, color: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' }].map(s => (
          <div key={s.label} className={`rounded-xl px-4 py-3 ${s.color}`}><p className="text-2xl font-bold">{s.value}</p><p className="text-xs font-medium mt-0.5 opacity-75">{s.label}</p></div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" /></div> :
        paginatedOrders.length === 0 ? <EmptyState icon={Package} title="No orders" description="Track production orders here." /> :
        <>
          {/* Desktop table view */}
          <div className="hidden sm:block overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Order</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden sm:table-cell">Mill</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden md:table-cell">Product</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden lg:table-cell">Customer</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Expected</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
            <th className="px-4 py-3 w-20"></th>
          </tr></thead><tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {paginatedOrders.map(o => { const overdueDays = getDaysOverdue(o.expected_delivery_date); return (
              <tr key={o.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700 ${o.status === 'delayed' ? 'bg-red-50/50 dark:bg-red-950/30' : ''}`}>
                <td className="px-4 py-3"><p className="font-medium text-slate-800 dark:text-slate-200">{o.order_number}</p><p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(o.order_date)}</p></td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden sm:table-cell">{o.mill_name}</td>
                <td className="px-4 py-3 hidden md:table-cell"><p className="text-slate-700 dark:text-slate-300">{o.product_name}</p><p className="text-xs text-slate-400 dark:text-slate-500">{o.quantity} {o.unit}</p></td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden lg:table-cell">{(o.customer as any)?.name ?? '—'}</td>
                <td className="px-4 py-3"><p className="text-slate-600 dark:text-slate-400">{formatDate(o.expected_delivery_date)}</p>{o.status === 'delayed' && <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1"><AlertTriangle size={10} />{overdueDays}d late</p>}</td>
                <td className="px-4 py-3">{orderStatusBadge(o.status)}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-1 justify-end"><button onClick={() => openEdit(o as Order)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20"><Edit2 size={14} /></button><button onClick={() => setDeleteConfirm(o.id)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={14} /></button></div></td>
              </tr>); })}
          </tbody></table></div>

          {/* Mobile card view */}
          <div className="sm:hidden divide-y divide-slate-50 dark:divide-slate-700">
            {paginatedOrders.map(o => { const overdueDays = getDaysOverdue(o.expected_delivery_date); return (
              <div key={o.id} className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700 ${o.status === 'delayed' ? 'bg-red-50/50 dark:bg-red-950/30' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{o.order_number}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(o.order_date)}</p>
                  </div>
                  <div>{orderStatusBadge(o.status)}</div>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">{o.mill_name} • {o.product_name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{o.quantity} {o.unit}</p>
                {(o.customer as any)?.name && <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Customer: {(o.customer as any).name}</p>}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Expected: {formatDate(o.expected_delivery_date)}</span>
                  {o.status === 'delayed' && <span className="text-xs text-red-600 dark:text-red-400 font-medium">{overdueDays}d late</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(o as Order)} className="flex-1 px-3 py-1.5 rounded-lg text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/40"><Edit2 size={13} className="inline mr-1" />Edit</button>
                  <button onClick={() => setDeleteConfirm(o.id)} className="flex-1 px-3 py-1.5 rounded-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40"><Trash2 size={13} className="inline mr-1" />Delete</button>
                </div>
              </div>
            ); })}
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
      {showModal && <Modal title={editingId ? 'Edit Order' : 'New Order'} onClose={() => setShowModal(false)} size="lg"><div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Mill Name *</label><input value={form.mill_name} onChange={e => setForm(f => ({ ...f, mill_name: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Product *</label><input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Quantity *</label><div className="flex gap-2"><input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /><select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm"><option value="meters">meters</option><option value="kg">kg</option><option value="pcs">pcs</option><option value="rolls">rolls</option></select></div></div>
          <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Customer</label><select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm"><option value="">No customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Order Date</label><input type="date" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Expected Delivery *</label><input type="date" value={form.expected_delivery_date} onChange={e => setForm(f => ({ ...f, expected_delivery_date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Status</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Order['status'] }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm">{ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
          {form.status === 'delivered' && <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Actual Delivery</label><input type="date" value={form.actual_delivery_date} onChange={e => setForm(f => ({ ...f, actual_delivery_date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>}
          <div className="sm:col-span-2"><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" /></div>
        </div>
        <div className="flex gap-3 pt-2"><button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button><button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button></div>
      </div></Modal>}
      {deleteConfirm && <Modal title="Delete Order" onClose={() => setDeleteConfirm(null)} size="sm"><p className="text-sm text-slate-600 dark:text-slate-400 mb-5">Delete this order?</p><div className="flex gap-3"><button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button><button onClick={() => deleteOrder(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">Delete</button></div></Modal>}
    </div>
  );
}
