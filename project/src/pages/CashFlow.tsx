import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, TrendingUp, AlertTriangle, CheckCircle, IndianRupee } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate, today } from '../lib/utils';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import MetricCard from '../components/ui/MetricCard';
import type { Expense, Invoice } from '../types';

interface Toast { id: string; type: 'success' | 'error'; message: string; }
interface CashFlowProps { onToast: (t: Omit<Toast, 'id'>) => void; }
const EXPENSE_TYPES = [{ value: 'salary', label: 'Salary' }, { value: 'supplier', label: 'Supplier Payment' }, { value: 'transport', label: 'Transport' }, { value: 'rent', label: 'Rent' }, { value: 'utility', label: 'Utility' }, { value: 'other', label: 'Other' }];

export default function CashFlow({ onToast }: CashFlowProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ expense_type: 'salary' as Expense['expense_type'], description: '', amount: '', due_date: today(), is_recurring: false });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [showBalanceEdit, setShowBalanceEdit] = useState(false);
  const [balanceInput, setBalanceInput] = useState('0');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => { loadAll(); const saved = localStorage.getItem('textileflow_balance'); if (saved) setCurrentBalance(parseFloat(saved)); }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [expRes, invRes] = await Promise.all([supabase.from('expenses').select('*').order('due_date'), supabase.from('invoices').select('*').neq('status', 'paid')]);
      setExpenses(expRes.data ?? []); setInvoices(invRes.data ?? []);
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to load cash flow data' });
    } finally {
      setLoading(false);
    }
  }

  function saveBalance() { const val = parseFloat(balanceInput) || 0; setCurrentBalance(val); localStorage.setItem('textileflow_balance', String(val)); setShowBalanceEdit(false); }

  function generateForecast() {
    const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
    return [{ label: '7 Days', days: 7 }, { label: '15 Days', days: 15 }, { label: '30 Days', days: 30 }, { label: '60 Days', days: 60 }].map(p => {
      const endDate = new Date(todayDate); endDate.setDate(endDate.getDate() + p.days);
      const inflows = invoices.reduce((sum, inv) => { const due = new Date(inv.due_date); return (due >= todayDate && due <= endDate) ? sum + (inv.total_amount - inv.paid_amount) : sum; }, 0);
      const outflows = expenses.filter(e => !e.is_paid).reduce((sum, exp) => { const due = new Date(exp.due_date); return (due >= todayDate && due <= endDate) ? sum + exp.amount : sum; }, 0);
      const balance = currentBalance + inflows - outflows;
      return { label: p.label, days: p.days, inflows, outflows, balance, deficit: balance < 0 };
    });
  }

  function openCreate() { setEditingId(null); setForm({ expense_type: 'salary', description: '', amount: '', due_date: today(), is_recurring: false }); setShowModal(true); }
  function openEdit(e: Expense) { setEditingId(e.id); setForm({ expense_type: e.expense_type, description: e.description, amount: String(e.amount), due_date: e.due_date, is_recurring: e.is_recurring }); setShowModal(true); }

  async function save() {
    if (!form.description || !form.amount) { onToast({ type: 'error', message: 'Fill required fields' }); return; }
    setSaving(true);
    try {
      const payload = { expense_type: form.expense_type, description: form.description, amount: parseFloat(form.amount), due_date: form.due_date, is_recurring: form.is_recurring };
      if (editingId) { const { error } = await supabase.from('expenses').update(payload).eq('id', editingId); if (error) onToast({ type: 'error', message: error.message }); else { onToast({ type: 'success', message: 'Updated' }); setShowModal(false); loadAll(); } }
      else { const { error } = await supabase.from('expenses').insert(payload); if (error) onToast({ type: 'error', message: error.message }); else { onToast({ type: 'success', message: 'Expense added' }); setShowModal(false); loadAll(); } }
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to save expense' });
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(id: string) {
    try {
      const { error } = await supabase.from('expenses').update({ is_paid: true, paid_date: today() }).eq('id', id);
      if (error) onToast({ type: 'error', message: error.message }); else { onToast({ type: 'success', message: 'Marked paid' }); loadAll(); }
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to mark paid' });
    }
  }

  async function deleteExpense(id: string) {
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) onToast({ type: 'error', message: error.message }); else { onToast({ type: 'success', message: 'Deleted' }); loadAll(); }
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to delete expense' });
    }
    setDeleteConfirm(null);
  }

  const forecast = generateForecast();
  const unpaidExpenses = expenses.filter(e => !e.is_paid);
  const totalOutflows = unpaidExpenses.reduce((s, e) => s + e.amount, 0);
  const totalInflows = invoices.reduce((s, i) => s + (i.total_amount - i.paid_amount), 0);
  const totalPages = Math.ceil(unpaidExpenses.length / ITEMS_PER_PAGE);
  const paginatedExpenses = unpaidExpenses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5"><p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Current Cash Balance</p><p className="text-lg sm:text-3xl font-bold text-slate-800 dark:text-slate-200 mt-1 whitespace-nowrap">{formatCurrency(currentBalance)}</p>{showBalanceEdit ? <div className="flex gap-2 mt-3"><input type="number" value={balanceInput} onChange={e => setBalanceInput(e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /><button onClick={saveBalance} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium">Save</button></div> : <button onClick={() => { setBalanceInput(String(currentBalance)); setShowBalanceEdit(true); }} className="mt-2 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium">Update Balance</button>}</div>
        <MetricCard title="Expected Inflows" value={formatCurrency(totalInflows)} subtitle="Open invoices" icon={TrendingUp} color="emerald" />
        <MetricCard title="Upcoming Outflows" value={formatCurrency(totalOutflows)} subtitle="Unpaid expenses" icon={IndianRupee} color={totalOutflows > 0 ? 'red' : 'emerald'} />
      </div>
      {forecast.filter(f => f.deficit).map(f => (<div key={f.label} className="flex items-start gap-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3"><AlertTriangle size={18} className="text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" /><p className="text-sm text-red-800 dark:text-red-200"><span className="font-semibold">Cash shortage in {f.label}:</span> Projected deficit of <span className="font-bold">{formatCurrency(Math.abs(f.balance))}</span></p></div>))}
      <div><h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Cash Flow Forecast</h3><div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {forecast.map(f => (<div key={f.label} className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm p-4 ${f.deficit ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30' : 'border-slate-200 dark:border-slate-700'}`}><p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{f.label}</p><p className={`text-lg sm:text-xl font-bold mt-1 whitespace-nowrap ${f.deficit ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{formatCurrency(f.balance)}</p><div className="mt-3 space-y-1.5 text-xs"><div className="flex justify-between text-emerald-700 dark:text-emerald-400"><span>+Inflows</span><span className="font-medium">{formatCurrency(f.inflows)}</span></div><div className="flex justify-between text-red-600 dark:text-red-400"><span>-Outflows</span><span className="font-medium">{formatCurrency(f.outflows)}</span></div></div>{f.deficit && <div className="mt-2 flex items-center gap-1 text-red-600 dark:text-red-400"><AlertTriangle size={10} /><span className="text-[10px] font-semibold">DEFICIT</span></div>}</div>))}
      </div></div>
      <div><div className="flex items-center justify-between mb-3 flex-wrap gap-2"><h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payables & Expenses</h3><button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-xl text-xs font-medium hover:bg-teal-700"><Plus size={14} /> Add Expense</button></div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {unpaidExpenses.length === 0 ? <EmptyState icon={IndianRupee} title="No expenses" description="Track outflows here." /> :
          <>
            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"><th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Description</th><th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden sm:table-cell">Type</th><th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Amount</th><th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden md:table-cell">Due</th><th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th><th className="px-4 py-3 w-24"></th></tr></thead><tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {paginatedExpenses.map(e => (<tr key={e.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700 ${e.is_paid ? 'opacity-60' : ''}`}><td className="px-4 py-3"><p className="font-medium text-slate-800 dark:text-slate-200">{e.description}</p>{e.is_recurring && <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Recurring</span>}</td><td className="px-4 py-3 hidden sm:table-cell"><span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">{EXPENSE_TYPES.find(t => t.value === e.expense_type)?.label}</span></td><td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatCurrency(e.amount)}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden md:table-cell">{formatDate(e.due_date)}</td><td className="px-4 py-3">{e.is_paid ? <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700 font-medium">Paid</span> : <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-700 font-medium">Pending</span>}</td><td className="px-4 py-3"><div className="flex items-center gap-1 justify-end">{!e.is_paid && <button onClick={() => markPaid(e.id)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"><CheckCircle size={14} /></button>}<button onClick={() => openEdit(e)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20"><Edit2 size={14} /></button><button onClick={() => setDeleteConfirm(e.id)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={14} /></button></div></td></tr>))}
            </tbody></table></div>

            {/* Mobile card view */}
            <div className="sm:hidden divide-y divide-slate-50 dark:divide-slate-700">
              {paginatedExpenses.map(e => (
                <div key={e.id} className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700 ${e.is_paid ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{e.description}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{EXPENSE_TYPES.find(t => t.value === e.expense_type)?.label}</p>
                      {e.is_recurring && <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Recurring</span>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${e.is_paid ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700'}`}>{e.is_paid ? 'Paid' : 'Pending'}</span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatCurrency(e.amount)}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(e.due_date)}</span>
                  </div>
                  <div className="flex gap-2">
                    {!e.is_paid && <button onClick={() => markPaid(e.id)} className="flex-1 px-3 py-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/40"><CheckCircle size={13} className="inline mr-1" />Mark Paid</button>}
                    <button onClick={() => openEdit(e)} className="flex-1 px-3 py-1.5 rounded-lg text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/40"><Edit2 size={13} className="inline mr-1" />Edit</button>
                    <button onClick={() => setDeleteConfirm(e.id)} className="flex-1 px-3 py-1.5 rounded-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40"><Trash2 size={13} className="inline mr-1" />Delete</button>
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
      </div>
      {showModal && <Modal title={editingId ? 'Edit Expense' : 'Add Expense'} onClose={() => setShowModal(false)} size="sm"><div className="space-y-4">
        <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Type</label><select value={form.expense_type} onChange={e => setForm(f => ({ ...f, expense_type: e.target.value as Expense['expense_type'] }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm">{EXPENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Description *</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Amount *</label><input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Due Date</label><input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_recurring} onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))} className="rounded text-teal-600" /><span className="text-sm text-slate-600 dark:text-slate-400">Recurring monthly</span></label>
        <div className="flex gap-3 pt-2"><button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button><button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update' : 'Add'}</button></div>
      </div></Modal>}
      {deleteConfirm && <Modal title="Delete Expense" onClose={() => setDeleteConfirm(null)} size="sm"><p className="text-sm text-slate-600 dark:text-slate-400 mb-5">Delete this expense?</p><div className="flex gap-3"><button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button><button onClick={() => deleteExpense(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">Delete</button></div></Modal>}
    </div>
  );
}
