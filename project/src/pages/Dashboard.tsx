import React, { useEffect, useState } from 'react';
import { FileText, Users, Package, Wallet, TrendingUp, AlertTriangle, Clock, CheckCircle, IndianRupee, ArrowRight } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate, getDaysOverdue, getRiskCategory } from '../lib/utils';
import MetricCard from '../components/ui/MetricCard';
import type { Invoice, Order, Customer, Page } from '../types';

interface Toast { id: string; type: 'success' | 'error'; message: string; }
interface DashboardProps { onNavigate: (page: Page) => void; onToast?: (t: Omit<Toast, 'id'>) => void; }
interface Expense { id: string; date: string; description: string; amount: number; category: string; }
interface Payment { id: string; invoice_id: string; amount: number; payment_date: string; }

export default function Dashboard({ onNavigate, onToast }: DashboardProps) {
  const [data, setData] = useState<{
    totalSales: number; totalOutstanding: number; totalOverdue: number;
    expectedThisMonth: number; activeOrders: number; delayedOrders: number;
    ordersDueThisWeek: number; highRiskCustomers: number;
    recentInvoices: (Invoice & { customer?: Customer })[];
    delayedOrderList: Order[];
    priorityCollections: Array<{ customer: Customer; outstanding: number; maxDaysOverdue: number; risk: string }>;
    invoices: (Invoice & { customer?: Customer })[];
    expenses: Expense[];
    payments: Payment[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<'thisYear' | 'last12' | 'last6'>('last12');
  const [analysisTab, setAnalysisTab] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [invoicesRes, ordersRes, customersRes, expensesRes, paymentsRes] = await Promise.all([
        supabase.from('invoices').select('*, customer:customers(*)').order('created_at', { ascending: false }),
        supabase.from('orders').select('*, customer:customers(*)').order('created_at', { ascending: false }),
        supabase.from('customers').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('payments').select('*'),
      ]);
      const invoices: (Invoice & { customer?: Customer })[] = invoicesRes.data ?? [];
      const orders: (Order & { customer?: Customer | null })[] = ordersRes.data ?? [];
      const customers: Customer[] = customersRes.data ?? [];
      const expenses: Expense[] = expensesRes.data ?? [];
      const payments: Payment[] = paymentsRes.data ?? [];
      const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
      const weekFromNow = new Date(todayDate); weekFromNow.setDate(weekFromNow.getDate() + 7);
      const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
      const monthEnd = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
      const unpaidInvoices = invoices.filter(i => i.status !== 'paid');
      const totalSales = invoices.reduce((s, i) => s + i.total_amount, 0);
      const totalOutstanding = unpaidInvoices.reduce((s, i) => s + (i.total_amount - i.paid_amount), 0);
      const totalOverdue = unpaidInvoices.filter(i => new Date(i.due_date) < todayDate).reduce((s, i) => s + (i.total_amount - i.paid_amount), 0);
      const expectedThisMonth = unpaidInvoices.filter(i => { const due = new Date(i.due_date); return due >= monthStart && due <= monthEnd; }).reduce((s, i) => s + (i.total_amount - i.paid_amount), 0);
      const activeOrders = orders.filter(o => !['delivered'].includes(o.status)).length;
      const delayedOrders = orders.filter(o => { const exp = new Date(o.expected_delivery_date); return exp < todayDate && o.status !== 'delivered'; });
      const ordersDueThisWeek = orders.filter(o => { const exp = new Date(o.expected_delivery_date); return exp >= todayDate && exp <= weekFromNow && o.status !== 'delivered'; }).length;
      const customerMap = new Map<string, { customer: Customer; outstanding: number; maxDaysOverdue: number; overdueCount: number }>();
      unpaidInvoices.forEach(inv => {
        const cust = customers.find(c => c.id === inv.customer_id);
        if (!cust) return;
        const overdue = getDaysOverdue(inv.due_date);
        const existing = customerMap.get(inv.customer_id);
        if (existing) { existing.outstanding += inv.total_amount - inv.paid_amount; existing.maxDaysOverdue = Math.max(existing.maxDaysOverdue, overdue); if (overdue > 0) existing.overdueCount++; }
        else { customerMap.set(inv.customer_id, { customer: cust, outstanding: inv.total_amount - inv.paid_amount, maxDaysOverdue: overdue, overdueCount: overdue > 0 ? 1 : 0 }); }
      });
      const priorityCollections = Array.from(customerMap.values()).map(c => ({ customer: c.customer, outstanding: c.outstanding, maxDaysOverdue: c.maxDaysOverdue, risk: getRiskCategory(c.maxDaysOverdue, c.outstanding, c.overdueCount) })).filter(c => c.maxDaysOverdue > 0).sort((a, b) => b.outstanding - a.outstanding || b.maxDaysOverdue - a.maxDaysOverdue).slice(0, 5);
      const highRiskCustomers = Array.from(customerMap.values()).filter(c => { const risk = getRiskCategory(c.maxDaysOverdue, c.outstanding, c.overdueCount); return risk === 'high' || risk === 'critical'; }).length;
      setData({ totalSales, totalOutstanding, totalOverdue, expectedThisMonth, activeOrders, delayedOrders: delayedOrders.length, ordersDueThisWeek, highRiskCustomers, recentInvoices: invoices.slice(0, 5), delayedOrderList: delayedOrders.slice(0, 4) as Order[], priorityCollections, invoices, expenses, payments });
    } catch (error) {
      onToast?.({ type: 'error', message: 'Failed to load dashboard' });
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" /></div>;
  if (!data) return null;

  const riskColors: Record<string, string> = { low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200', medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200', high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200', critical: 'bg-red-200 text-red-800 font-bold dark:bg-red-950 dark:text-red-300' };
  const riskCategoryColors: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' };

  // Chart data calculations
  const generateSalesTrendData = () => {
    const today = new Date();
    const months = timePeriod === 'last6' ? 6 : timePeriod === 'thisYear' ? today.getMonth() + 1 : 12;
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const monthRevenue = data.invoices.filter(inv => {
        const invDate = new Date(inv.invoice_date);
        return invDate >= monthStart && invDate <= monthEnd;
      }).reduce((sum, inv) => sum + inv.total_amount, 0);
      result.push({ month: monthName, revenue: Math.round(monthRevenue) });
    }
    return result;
  };

  const generateInvoiceStatusData = () => {
    const statusCount: Record<string, number> = { paid: 0, sent: 0, overdue: 0, partial: 0, draft: 0 };
    data.invoices.forEach(inv => {
      if (statusCount.hasOwnProperty(inv.status)) {
        statusCount[inv.status]++;
      }
    });
    return Object.entries(statusCount).map(([status, count]) => ({ name: status.charAt(0).toUpperCase() + status.slice(1), value: count }));
  };

  const generateOutstandingByRiskData = () => {
    const riskGroups: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const customers: Customer[] = data.invoices.map(i => i.customer).filter((c): c is Customer => c !== undefined);
    const uniqueCustomers = Array.from(new Map(customers.map(c => [c.id, c])).values());
    uniqueCustomers.forEach(cust => {
      const custInvoices = data.invoices.filter(i => i.customer_id === cust.id && i.status !== 'paid');
      const totalOutstanding = custInvoices.reduce((sum, i) => sum + (i.total_amount - i.paid_amount), 0);
      if (totalOutstanding > 0) {
        const maxDaysOverdue = Math.max(...custInvoices.map(i => getDaysOverdue(i.due_date)), 0);
        const overdueCount = custInvoices.filter(i => getDaysOverdue(i.due_date) > 0).length;
        const risk = getRiskCategory(maxDaysOverdue, totalOutstanding, overdueCount);
        riskGroups[risk] += totalOutstanding;
      }
    });
    return Object.entries(riskGroups).filter(([_, val]) => val > 0).map(([risk, amount]) => ({ name: risk.charAt(0).toUpperCase() + risk.slice(1), value: Math.round(amount) }));
  };

  const generateCashFlowData = () => {
    const today = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const inflow = data.payments.filter(p => {
        const pDate = new Date(p.payment_date);
        return pDate >= monthStart && pDate <= monthEnd;
      }).reduce((sum, p) => sum + p.amount, 0);
      const outflow = data.expenses.filter(e => {
        const eDate = new Date(e.date);
        return eDate >= monthStart && eDate <= monthEnd;
      }).reduce((sum, e) => sum + e.amount, 0);
      result.push({ month: monthName, inflow: Math.round(inflow), outflow: Math.round(outflow) });
    }
    return result;
  };

  const generatePeriodAnalysisData = () => {
    const today = new Date();
    if (analysisTab === 'monthly') {
      const result = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const sales = data.invoices.filter(inv => {
          const invDate = new Date(inv.invoice_date);
          return invDate >= monthStart && invDate <= monthEnd;
        }).reduce((sum, inv) => sum + inv.total_amount, 0);
        const collections = data.payments.filter(p => {
          const pDate = new Date(p.payment_date);
          return pDate >= monthStart && pDate <= monthEnd;
        }).reduce((sum, p) => sum + p.amount, 0);
        const expenses = data.expenses.filter(e => {
          const eDate = new Date(e.date);
          return eDate >= monthStart && eDate <= monthEnd;
        }).reduce((sum, e) => sum + e.amount, 0);
        const outstanding = data.invoices.filter(inv => {
          const invDate = new Date(inv.invoice_date);
          return invDate <= monthEnd && inv.status !== 'paid';
        }).reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0);
        result.push({ period: monthName, sales: Math.round(sales), collections: Math.round(collections), outstanding: Math.round(outstanding), expenses: Math.round(expenses) });
      }
      return result;
    } else if (analysisTab === 'quarterly') {
      const result = [];
      const currentQuarter = Math.floor(today.getMonth() / 3);
      for (let q = 3; q >= 0; q--) {
        const quarter = (currentQuarter - q + 4) % 4;
        const year = today.getFullYear() - (q > currentQuarter ? 1 : 0);
        const monthStart = new Date(year, quarter * 3, 1);
        const monthEnd = new Date(year, (quarter + 1) * 3, 0);
        const sales = data.invoices.filter(inv => {
          const invDate = new Date(inv.invoice_date);
          return invDate >= monthStart && invDate <= monthEnd;
        }).reduce((sum, inv) => sum + inv.total_amount, 0);
        const collections = data.payments.filter(p => {
          const pDate = new Date(p.payment_date);
          return pDate >= monthStart && pDate <= monthEnd;
        }).reduce((sum, p) => sum + p.amount, 0);
        const expenses = data.expenses.filter(e => {
          const eDate = new Date(e.date);
          return eDate >= monthStart && eDate <= monthEnd;
        }).reduce((sum, e) => sum + e.amount, 0);
        const outstanding = data.invoices.filter(inv => {
          const invDate = new Date(inv.invoice_date);
          return invDate <= monthEnd && inv.status !== 'paid';
        }).reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0);
        result.push({ period: `Q${quarter + 1} ${year}`, sales: Math.round(sales), collections: Math.round(collections), outstanding: Math.round(outstanding), expenses: Math.round(expenses) });
      }
      return result;
    } else {
      const result = [];
      for (let y = 2; y >= 0; y--) {
        const year = today.getFullYear() - y;
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);
        const sales = data.invoices.filter(inv => {
          const invDate = new Date(inv.invoice_date);
          return invDate >= yearStart && invDate <= yearEnd;
        }).reduce((sum, inv) => sum + inv.total_amount, 0);
        const collections = data.payments.filter(p => {
          const pDate = new Date(p.payment_date);
          return pDate >= yearStart && pDate <= yearEnd;
        }).reduce((sum, p) => sum + p.amount, 0);
        const expenses = data.expenses.filter(e => {
          const eDate = new Date(e.date);
          return eDate >= yearStart && eDate <= yearEnd;
        }).reduce((sum, e) => sum + e.amount, 0);
        const outstanding = data.invoices.filter(inv => {
          const invDate = new Date(inv.invoice_date);
          return invDate <= yearEnd && inv.status !== 'paid';
        }).reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0);
        result.push({ period: year.toString(), sales: Math.round(sales), collections: Math.round(collections), outstanding: Math.round(outstanding), expenses: Math.round(expenses) });
      }
      return result;
    }
  };

  const salesTrendData = generateSalesTrendData();
  const invoiceStatusData = generateInvoiceStatusData();
  const outstandingByRiskData = generateOutstandingByRiskData();
  const cashFlowData = generateCashFlowData();
  const periodAnalysisData = generatePeriodAnalysisData();
  const statusColors = { paid: '#10b981', sent: '#3b82f6', overdue: '#ef4444', partial: '#f59e0b', draft: '#64748b' };

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Financial Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Total Sales" value={formatCurrency(data.totalSales)} subtitle="All invoices" icon={IndianRupee} color="teal" />
          <MetricCard title="Outstanding" value={formatCurrency(data.totalOutstanding)} subtitle="Unpaid invoices" icon={FileText} color="blue" />
          <MetricCard title="Overdue" value={formatCurrency(data.totalOverdue)} subtitle="Past due date" icon={AlertTriangle} color="red" />
          <MetricCard title="Due This Month" value={formatCurrency(data.expectedThisMonth)} subtitle="Expected collections" icon={CheckCircle} color="emerald" />
        </div>
      </div>

      {/* Order Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Active Orders" value={String(data.activeOrders)} subtitle="In production / transit" icon={Package} color="blue" />
        <MetricCard title="Delayed Orders" value={String(data.delayedOrders)} subtitle="Past expected date" icon={Clock} color={data.delayedOrders > 0 ? 'amber' : 'emerald'} />
        <MetricCard title="Due This Week" value={String(data.ordersDueThisWeek)} subtitle="Expected deliveries" icon={Package} color="teal" />
        <MetricCard title="High-Risk Debtors" value={String(data.highRiskCustomers)} subtitle="Require follow-up" icon={Users} color={data.highRiskCustomers > 0 ? 'red' : 'emerald'} />
      </div>

      {/* Collections and Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex-wrap gap-2"><h3 className="font-semibold text-slate-800 dark:text-slate-200">Collection Priority</h3><button onClick={() => onNavigate('debtors')} className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 font-medium">View all <ArrowRight size={12} /></button></div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
            {data.priorityCollections.length === 0 ? <div className="px-5 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">No overdue collections</div> :
              data.priorityCollections.map((item, i) => (
                <div key={item.customer.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{item.customer.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{item.maxDaysOverdue} days overdue</p></div>
                  <div className="text-right"><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(item.outstanding)}</p><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${riskColors[item.risk]}`}>{item.risk.charAt(0).toUpperCase() + item.risk.slice(1)}</span></div>
                </div>
              ))}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex-wrap gap-2"><h3 className="font-semibold text-slate-800 dark:text-slate-200">Recent Invoices</h3><button onClick={() => onNavigate('invoices')} className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 font-medium">View all <ArrowRight size={12} /></button></div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
            {data.recentInvoices.length === 0 ? <div className="px-5 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">No invoices yet</div> :
              data.recentInvoices.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-800 dark:text-slate-200">{inv.invoice_number}</p><p className="text-xs text-slate-500 dark:text-slate-400 truncate">{(inv as any).customer?.name ?? '—'}</p></div>
                  <div className="text-right"><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(inv.total_amount)}</p><p className="text-xs text-slate-400 dark:text-slate-500">Due {formatDate(inv.due_date)}</p></div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${inv.status === 'paid' ? 'bg-emerald-50 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700' : inv.status === 'overdue' ? 'bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200 border-red-200 dark:border-red-700' : inv.status === 'partial' ? 'bg-amber-50 dark:bg-amber-900 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-700' : inv.status === 'sent' ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-700' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Delayed Orders Alert */}
      {data.delayedOrderList.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-700 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 rounded-t-xl flex-wrap gap-2"><div className="flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600 dark:text-amber-500" /><h3 className="font-semibold text-amber-800 dark:text-amber-200">Delayed Orders Alert</h3></div><button onClick={() => onNavigate('orders')} className="text-xs text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 flex items-center gap-1 font-medium">View all <ArrowRight size={12} /></button></div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
            {data.delayedOrderList.map(order => (
              <div key={order.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-800 dark:text-slate-200">{order.order_number}</p><p className="text-xs text-slate-500 dark:text-slate-400">{order.mill_name} — {order.product_name}</p></div>
                <div className="text-right"><p className="text-xs text-slate-400 dark:text-slate-500">Expected: {formatDate(order.expected_delivery_date)}</p><p className="text-xs font-medium text-red-600 dark:text-red-400">{getDaysOverdue(order.expected_delivery_date)} days late</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Growth Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Revenue Growth</h3>
            <div className="flex gap-1">
              <button onClick={() => setTimePeriod('thisYear')} className={`px-3 py-1 text-xs font-medium rounded ${timePeriod === 'thisYear' ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>This Year</button>
              <button onClick={() => setTimePeriod('last12')} className={`px-3 py-1 text-xs font-medium rounded ${timePeriod === 'last12' ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>Last 12M</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={salesTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }} />
              <Line type="monotone" dataKey="revenue" stroke="#14b8a6" strokeWidth={2} dot={{ fill: '#14b8a6', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Invoice Status Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Invoice Status Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={invoiceStatusData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                {invoiceStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={statusColors[entry.name.toLowerCase() as keyof typeof statusColors] || '#64748b'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Outstanding by Risk & Cash Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outstanding by Risk Category */}
        {outstandingByRiskData.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Outstanding by Risk Category</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={outstandingByRiskData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }} />
                <Bar dataKey="value" fill="#14b8a6">
                  {outstandingByRiskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={riskCategoryColors[entry.name.toLowerCase()] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Monthly Cash Flow */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Monthly Inflow vs Outflow</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }} />
              <Legend />
              <Bar dataKey="inflow" fill="#10b981" name="Inflow" />
              <Bar dataKey="outflow" fill="#ef4444" name="Outflow" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Period Analysis */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Period Analysis</h3>
          <div className="flex gap-1">
            <button onClick={() => setAnalysisTab('monthly')} className={`px-3 py-1 text-xs font-medium rounded ${analysisTab === 'monthly' ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>Monthly</button>
            <button onClick={() => setAnalysisTab('quarterly')} className={`px-3 py-1 text-xs font-medium rounded ${analysisTab === 'quarterly' ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>Quarterly</button>
            <button onClick={() => setAnalysisTab('yearly')} className={`px-3 py-1 text-xs font-medium rounded ${analysisTab === 'yearly' ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>Yearly</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Period</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Sales</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Collections</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Outstanding</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">Expenses</th>
              </tr>
            </thead>
            <tbody>
              {periodAnalysisData.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.period}</td>
                  <td className="text-right px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{formatCurrency(row.sales)}</td>
                  <td className="text-right px-4 py-3 font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(row.collections)}</td>
                  <td className="text-right px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{formatCurrency(row.outstanding)}</td>
                  <td className="text-right px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{formatCurrency(row.expenses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
