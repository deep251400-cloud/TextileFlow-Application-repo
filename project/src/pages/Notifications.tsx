import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import EmptyState from '../components/ui/EmptyState';
import type { Notification } from '../types';

interface Toast { id: string; type: 'success' | 'error'; message: string; }
interface NotificationsProps { onToast?: (t: Omit<Toast, 'id'>) => void; onUnreadChange: (count: number) => void; }
const TYPE_COLORS: Record<string, string> = { invoice_created: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400', payment_received: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400', order_created: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400', reminder_sent: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400', order_delayed: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400', default: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' };

export default function Notifications({ onToast, onUnreadChange }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
      setNotifications(data ?? []);
      onUnreadChange((data ?? []).filter(n => !n.is_read).length);
    } catch (error) {
      onToast?.({ type: 'error', message: 'Failed to load notifications' });
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
      if (error) onToast?.({ type: 'error', message: error.message }); else { onUnreadChange(0); load(); }
    } catch (error) {
      onToast?.({ type: 'error', message: 'Failed to mark all as read' });
    }
  }

  async function markRead(id: string) {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) onToast?.({ type: 'error', message: error.message }); else load();
    } catch (error) {
      onToast?.({ type: 'error', message: 'Failed to mark as read' });
    }
  }

  async function deleteNotification(id: string) {
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) onToast?.({ type: 'error', message: error.message }); else load();
    } catch (error) {
      onToast?.({ type: 'error', message: 'Failed to delete notification' });
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2"><p className="text-sm text-slate-500 dark:text-slate-400">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}</p>{unreadCount > 0 && <button onClick={markAllRead} className="flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"><CheckCheck size={14} />Mark all read</button>}</div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" /></div> :
        notifications.length === 0 ? <EmptyState icon={Bell} title="No notifications" description="Events will appear here." /> :
        <div className="divide-y divide-slate-50 dark:divide-slate-700">
          {notifications.map(n => (<div key={n.id} onClick={() => !n.is_read && markRead(n.id)} className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${!n.is_read ? 'bg-blue-50/40 dark:bg-blue-950/30' : ''}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${TYPE_COLORS[n.type] ?? TYPE_COLORS.default}`}><Bell size={13} /></div>
            <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><p className={`text-sm font-medium ${n.is_read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>{n.title}</p>{!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}</div><p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p><p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{formatDate(n.created_at)}</p></div>
            <button onClick={e => { e.stopPropagation(); deleteNotification(n.id); }} className="flex-shrink-0 p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 mt-0.5"><Trash2 size={12} /></button>
          </div>))}
        </div>}
      </div>
    </div>
  );
}
