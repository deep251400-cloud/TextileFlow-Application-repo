import React, { useEffect, useState } from 'react';
import { Wallet, AlertTriangle, TrendingDown, Users, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate, getDaysOverdue, getRiskCategory, openWhatsAppReminder } from '../lib/utils';
import MetricCard from '../components/ui/MetricCard';
import { riskBadge } from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import type { Customer, Invoice } from '../types';

interface DebtorEntry { customer: Customer; outstanding: number; lastPaymentDate: string | null; nearestDueDate: string; maxDaysOverdue: number; creditLimit: number; overdueCount: number; invoiceCount: number; risk: 'low' | 'medium' | 'high' | 'critical'; }
interface Toast { id: string; type: 'success' | 'error'; message: string; }
interface DebtorsProps { onToast?: (t: Omit<Toast, 'id'>) => void; }

export default function Debtors({ onToast }: DebtorsProps) {
  const [debtors, setDebtors] = useState<DebtorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'outstanding' | 'overdue' | 'risk'>('outstanding');
  const [riskFilter, setRiskFilter] = useState('all');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const [invRes, custRes, payRes] = await Promise.all([supabase.from('invoices').select('*').neq('status', 'paid'), supabase.from('customers').select('*'), supabase.from('payments').select('customer_id, payment_date').order('payment_date', { ascending: false })]);
      const invoices: Invoice[] = invRes.data ?? []; const customers: Customer[] = custRes.data ?? []; const payments: any[] = payRes.data ?? [];
      const lastPaymentMap = new Map<string, string>(); payments.forEach(p => { if (!lastPaymentMap.has(p.customer_id)) lastPaymentMap.set(p.customer_id, p.payment_date); });
      const customerInvoices = new Map<string, Invoice[]>(); invoices.forEach(inv => { const list = customerInvoices.get(inv.customer_id) ?? []; list.push(inv); customerInvoices.set(inv.customer_id, list); });
      const entries: DebtorEntry[] = [];
      customerInvoices.forEach((invList, custId) => {
        const customer = customers.find(c => c.id === custId); if (!customer) return;
        const outstanding = invList.reduce((s, i) => s + (i.total_amount - i.paid_amount), 0); if (outstanding <= 0) return;
        const overdueInvs = invList.filter(i => getDaysOverdue(i.due_date) > 0);
        const maxDaysOverdue = Math.max(0, ...invList.map(i => getDaysOverdue(i.due_date)));
        const nearestDueDate = invList.reduce((min, i) => i.due_date < min ? i.due_date : min, invList[0].due_date);
        entries.push({ customer, outstanding, lastPaymentDate: lastPaymentMap.get(custId) ?? null, nearestDueDate, maxDaysOverdue, creditLimit: customer.credit_limit, overdueCount: overdueInvs.length, invoiceCount: invList.length, risk: getRiskCategory(maxDaysOverdue, outstanding, overdueInvs.length) });
      });
      setDebtors(entries);
    } catch (error) {
      onToast?.({ type: 'error', message: 'Failed to load debtors' });
    } finally {
      setLoading(false);
    }
  }

  function handleWhatsAppReminder(debtor: DebtorEntry) {
    const phone = debtor.customer.whatsapp || debtor.customer.mobile;
    const message = `Dear ${debtor.customer.name}, your outstanding balance of ${formatCurrency(debtor.outstanding)} with TextileFlow is overdue by ${debtor.maxDaysOverdue} days. Please arrange payment at the earliest.`;
    openWhatsAppReminder(phone, message);
  }

  const filtered = debtors.filter(d => riskFilter === 'all' || d.risk === riskFilter);
  const sorted = [...filtered].sort((a, b) => { if (sortBy === 'outstanding') return b.outstanding - a.outstanding; if (sortBy === 'overdue') return b.maxDaysOverdue - a.maxDaysOverdue; const ro = { critical: 4, high: 3, medium: 2, low: 1 }; return ro[b.risk] - ro[a.risk]; });
  const totalOutstanding = debtors.reduce((s, d) => s + d.outstanding, 0);
  const totalOverdue = debtors.filter(d => d.maxDaysOverdue > 0).reduce((s, d) => s + d.outstanding, 0);
  const highRisk = debtors.filter(d => d.risk === 'high' || d.risk === 'critical').length;
  const avgDays = debtors.length > 0 ? Math.round(debtors.reduce((s, d) => s + d.maxDaysOverdue, 0) / debtors.length) : 0;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Outstanding" value={formatCurrency(totalOutstanding)} subtitle={`${debtors.length} customers`} icon={Wallet} color="blue" />
        <MetricCard title="Overdue Amount" value={formatCurrency(totalOverdue)} icon={AlertTriangle} color={totalOverdue > 0 ? 'red' : 'emerald'} />
        <MetricCard title="High-Risk" value={String(highRisk)} icon={TrendingDown} color={highRisk > 0 ? 'amber' : 'emerald'} />
        <MetricCard title="Avg Overdue" value={`${avgDays}d`} icon={Users} color="slate" />
      </div>

      {/* Risk filter tabs - horizontally scrollable on mobile */}
      <div className="overflow-x-auto flex gap-2 pb-2">
        {['all', 'low', 'medium', 'high', 'critical'].map(r => (
          <button key={r} onClick={() => setRiskFilter(r)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${riskFilter === r ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600'}`}>{r.charAt(0).toUpperCase() + r.slice(1)} {r !== 'all' ? 'Risk' : ''}</button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="text-sm text-slate-500 dark:text-slate-400">Sort by:</div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-xs"><option value="outstanding">Outstanding</option><option value="overdue">Days Overdue</option><option value="risk">Risk Score</option></select>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {sorted.length === 0 ? <EmptyState icon={Wallet} title="No outstanding debtors" description="All invoices are paid up!" /> :
        <>
          {/* Desktop table view */}
          <div className="hidden sm:block overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">#</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Customer</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Outstanding</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden md:table-cell">Next Due</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden lg:table-cell">Overdue Days</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden lg:table-cell">Last Payment</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Risk</th>
            <th className="px-4 py-3 w-20"></th>
          </tr></thead><tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {sorted.map((d, i) => (
              <tr key={d.customer.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700 ${d.risk === 'critical' ? 'bg-red-50/40 dark:bg-red-950/30' : ''}`}>
                <td className="px-4 py-3 text-slate-400 dark:text-slate-500 font-medium text-xs">{i + 1}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${d.risk === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : d.risk === 'high' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : d.risk === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>{d.customer.name.charAt(0)}</div><div><p className="font-medium text-slate-800 dark:text-slate-200">{d.customer.name}</p><p className="text-xs text-slate-400 dark:text-slate-500">{d.invoiceCount} invoice{d.invoiceCount > 1 ? 's' : ''} · {d.customer.mobile}</p></div></div></td>
                <td className="px-4 py-3 text-right"><p className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatCurrency(d.outstanding)}</p>{d.creditLimit > 0 && <p className="text-xs text-slate-400 dark:text-slate-500">Limit: {formatCurrency(d.creditLimit)}</p>}</td>
                <td className="px-4 py-3 hidden md:table-cell"><p className="text-slate-600 dark:text-slate-400">{formatDate(d.nearestDueDate)}</p>{d.overdueCount > 0 && <p className="text-xs text-red-500 dark:text-red-400">{d.overdueCount} overdue</p>}</td>
                <td className="px-4 py-3 text-right hidden lg:table-cell">{d.maxDaysOverdue > 0 ? <span className="text-red-600 dark:text-red-400 font-semibold">{d.maxDaysOverdue}d</span> : <span className="text-emerald-600 dark:text-emerald-400 font-medium">Current</span>}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-slate-500 dark:text-slate-400 text-xs">{d.lastPaymentDate ? formatDate(d.lastPaymentDate) : 'Never'}</td>
                <td className="px-4 py-3">{riskBadge(d.risk)}</td>
                <td className="px-4 py-3"><button onClick={() => handleWhatsAppReminder(d)} title="Send WhatsApp reminder" className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20"><MessageSquare size={14} /></button></td>
              </tr>
            ))}
          </tbody></table></div>

          {/* Mobile card view */}
          <div className="sm:hidden divide-y divide-slate-50 dark:divide-slate-700">
            {sorted.map((d, i) => (
              <div key={d.customer.id} className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700 ${d.risk === 'critical' ? 'bg-red-50/40 dark:bg-red-950/30' : ''}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${d.risk === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : d.risk === 'high' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : d.risk === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>{d.customer.name.charAt(0)}</div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{d.customer.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{d.customer.mobile}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{d.invoiceCount} invoice{d.invoiceCount > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">{riskBadge(d.risk)}</div>
                </div>
                <div className="space-y-1 mb-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400">Outstanding:</span><span className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatCurrency(d.outstanding)}</span></div>
                  {d.creditLimit > 0 && <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>Credit Limit:</span><span>{formatCurrency(d.creditLimit)}</span></div>}
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>Next Due:</span><span>{formatDate(d.nearestDueDate)}</span></div>
                  {d.maxDaysOverdue > 0 && <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400">Overdue:</span><span className="font-semibold text-red-600 dark:text-red-400">{d.maxDaysOverdue} days</span></div>}
                </div>
                <button onClick={() => handleWhatsAppReminder(d)} className="w-full px-3 py-2 rounded-lg text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/40 flex items-center justify-center gap-1.5"><MessageSquare size={13} />Send WhatsApp</button>
              </div>
            ))}
          </div>
        </>}
      </div>

      {debtors.length > 0 && <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5"><h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Aging Analysis</h3><div className="grid grid-cols-2 gap-3">
        {[{ label: 'Current', debtors: debtors.filter(d => d.maxDaysOverdue <= 0), color: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' }, { label: '1–15 days', debtors: debtors.filter(d => d.maxDaysOverdue > 0 && d.maxDaysOverdue <= 15), color: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300' }, { label: '16–30 days', debtors: debtors.filter(d => d.maxDaysOverdue > 15 && d.maxDaysOverdue <= 30), color: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300' }, { label: '30+ days', debtors: debtors.filter(d => d.maxDaysOverdue > 30), color: 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' }].map(bucket => (
          <div key={bucket.label} className={`rounded-xl border p-4 ${bucket.color}`}><p className="text-lg font-bold">{formatCurrency(bucket.debtors.reduce((s, d) => s + d.outstanding, 0))}</p><p className="text-xs font-medium mt-1 opacity-80">{bucket.label}</p><p className="text-xs opacity-60">{bucket.debtors.length} customers</p></div>
        ))}
      </div></div>}
    </div>
  );
}
