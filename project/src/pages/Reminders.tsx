import React, { useEffect, useState } from 'react';
import { MessageSquare, Send, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, formatCurrency, openWhatsAppReminder, sanitizeMobile } from '../lib/utils';
import EmptyState from '../components/ui/EmptyState';
import type { Reminder, Customer, Invoice } from '../types';

interface Toast { id: string; type: 'success' | 'error'; message: string; }
interface RemindersProps { onToast: (t: Omit<Toast, 'id'>) => void; }
type ReminderWithRelations = Reminder & { customer?: Customer; invoice?: Invoice };
const REMINDER_LABELS: Record<string, string> = { '7_days_before': '7 Days Before Due', '1_day_before': '1 Day Before Due', due_date: 'Due Today', '3_days_overdue': '3 Days Overdue', '10_days_overdue': '10 Days Overdue' };

export default function Reminders({ onToast }: RemindersProps) {
  const [reminders, setReminders] = useState<ReminderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'sent' | 'failed' | 'overdue'>('upcoming');
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const { data } = await supabase.from('reminders').select('*, customer:customers(*), invoice:invoices(*)').order('scheduled_date');
      setReminders(data ?? []);
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to load reminders' });
    } finally {
      setLoading(false);
    }
  }

  async function sendWhatsAppReminder(id: string, customerName: string, customerPhone: string, message: string) {
    setSending(id);
    try {
      const cleanPhone = sanitizeMobile(customerPhone);
      if (!cleanPhone) {
        onToast({ type: 'error', message: 'Invalid phone number' });
        setSending(null);
        return;
      }

      const opened = openWhatsAppReminder(cleanPhone, message);
      if (!opened) {
        onToast({ type: 'error', message: 'Failed to open WhatsApp' });
        setSending(null);
        return;
      }

      await supabase.from('reminders').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);
      await supabase.from('notifications').insert({ type: 'reminder_sent', title: 'Reminder Sent', message: `WhatsApp reminder sent to ${customerName}`, entity_type: 'reminder', entity_id: id });
      onToast({ type: 'success', message: `Reminder sent to ${customerName}` });
      load();
    } catch (error) {
      onToast({ type: 'error', message: 'Failed to send reminder' });
    } finally {
      setSending(null);
    }
  }

  const today_ = new Date(); today_.setHours(0, 0, 0, 0);
  const tabs = {
    upcoming: reminders.filter(r => r.status === 'pending' && new Date(r.scheduled_date) >= today_),
    overdue: reminders.filter(r => r.status === 'pending' && new Date(r.scheduled_date) < today_),
    sent: reminders.filter(r => r.status === 'sent'),
    failed: reminders.filter(r => r.status === 'failed'),
  };
  const current = tabs[tab];
  const tabConfig = [{ key: 'upcoming' as const, label: 'Upcoming', count: tabs.upcoming.length, color: 'text-blue-600 dark:text-blue-400' }, { key: 'overdue' as const, label: 'Overdue', count: tabs.overdue.length, color: 'text-red-600 dark:text-red-400' }, { key: 'sent' as const, label: 'Sent', count: tabs.sent.length, color: 'text-emerald-600 dark:text-emerald-400' }, { key: 'failed' as const, label: 'Failed', count: tabs.failed.length, color: 'text-slate-600 dark:text-slate-400' }];

  return (
    <div className="space-y-5">
      {/* Tab buttons - horizontally scrollable on mobile */}
      <div className="overflow-x-auto flex gap-2 pb-2">
        {tabConfig.map(t => (<button key={t.key} onClick={() => setTab(t.key)} className={`rounded-xl border p-4 text-left transition-all whitespace-nowrap ${tab === t.key ? 'bg-teal-600 border-teal-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600'}`}><p className={`text-2xl font-bold ${tab === t.key ? 'text-white' : t.color}`}>{t.count}</p><p className={`text-xs font-medium mt-0.5 ${tab === t.key ? 'text-teal-100' : 'text-slate-500 dark:text-slate-400'}`}>{t.label}</p></button>))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-700 px-4 py-3 flex items-center gap-2"><MessageSquare size={16} className="text-slate-400 dark:text-slate-500" /><span className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize">{tab} Reminders</span></div>
        {loading ? <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" /></div> :
        current.length === 0 ? <EmptyState icon={MessageSquare} title={`No ${tab} reminders`} description="Reminders are auto-created with invoices." /> :
        <div className="divide-y divide-slate-50 dark:divide-slate-700">
          {current.map(r => (<div key={r.id} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700">
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${r.status === 'sent' ? 'bg-emerald-100 dark:bg-emerald-900/30' : r.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30' : new Date(r.scheduled_date) < today_ ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                {r.status === 'sent' ? <CheckCircle size={14} className="text-emerald-600 dark:text-emerald-400" /> : r.status === 'failed' ? <XCircle size={14} className="text-red-600 dark:text-red-400" /> : <Clock size={14} className={new Date(r.scheduled_date) < today_ ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-medium text-slate-800 dark:text-slate-200">{(r.customer as any)?.name}</span><span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">{REMINDER_LABELS[r.reminder_type]}</span></div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Invoice: {(r.invoice as any)?.invoice_number} · Amount: {(r.invoice as any) ? formatCurrency((r.invoice as any).total_amount) : '—'} · Scheduled: {formatDate(r.scheduled_date)}</p>
                {r.message && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 line-clamp-2 italic">"{r.message}"</p>}
                {r.sent_at && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Sent: {formatDate(r.sent_at)}</p>}
              </div>
              {r.status === 'pending' && <button onClick={() => {
                const phone = (r.customer as any)?.whatsapp || (r.customer as any)?.mobile;
                const message = r.message || `Dear ${(r.customer as any)?.name}, your invoice ${(r.invoice as any)?.invoice_number} for ${formatCurrency((r.invoice as any)?.total_amount)} is due on ${formatDate((r.invoice as any)?.due_date)}. Please arrange payment at the earliest.`;
                sendWhatsAppReminder(r.id, (r.customer as any)?.name ?? '', phone, message);
              }} disabled={sending === r.id} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${sending === r.id ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500' : 'bg-teal-600 text-white hover:bg-teal-700'}`}>{sending === r.id ? <><RefreshCw size={12} className="animate-spin" />Sending...</> : <><Send size={12} />WhatsApp</>}</button>}
            </div>
          </div>))}
        </div>}
      </div>
      <div className="bg-teal-50 dark:bg-teal-950/50 border border-teal-100 dark:border-teal-800 rounded-xl p-4"><h4 className="text-sm font-semibold text-teal-800 dark:text-teal-300 mb-2">Auto-Reminder Schedule</h4><div className="space-y-1.5">{Object.entries(REMINDER_LABELS).map(([key, label]) => (<div key={key} className="flex items-center gap-2 text-xs text-teal-700 dark:text-teal-300"><span className="w-2 h-2 rounded-full bg-teal-400 dark:bg-teal-600 flex-shrink-0" /><span className="font-medium">{label}</span></div>))}</div><p className="text-xs text-teal-600 dark:text-teal-400 mt-2 opacity-75">Reminders auto-generate per invoice. Click "WhatsApp" to send the reminder message to the customer.</p></div>
    </div>
  );
}
