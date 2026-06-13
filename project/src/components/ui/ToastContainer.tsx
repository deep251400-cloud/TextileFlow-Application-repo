import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const icons = { success: CheckCircle, error: XCircle, warning: AlertCircle, info: Info };
const colors = {
  success: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300',
  error: 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300',
  warning: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
  info: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const Icon = icons[toast.type];
  useEffect(() => { const t = setTimeout(onRemove, 4000); return () => clearTimeout(t); }, [onRemove]);
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg ${colors[toast.type]} animate-slide-in`}>
      <Icon size={18} className="flex-shrink-0 mt-0.5" />
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button onClick={onRemove} className="flex-shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-80 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)]">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={() => onRemove(t.id)} />)}
    </div>
  );
}
