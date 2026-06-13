type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'purple';

const variants: Record<BadgeVariant, string> = {
  success: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  warning: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  error: 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  info: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  purple: 'bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
};

interface BadgeProps {
  label: string;
  variant: BadgeVariant;
  size?: 'sm' | 'md';
}

export default function Badge({ label, variant, size = 'sm' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center border font-medium rounded-full whitespace-nowrap ${variants[variant]} ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}`}>
      {label}
    </span>
  );
}

export function invoiceStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    draft: { label: 'Draft', variant: 'neutral' },
    sent: { label: 'Sent', variant: 'info' },
    paid: { label: 'Paid', variant: 'success' },
    overdue: { label: 'Overdue', variant: 'error' },
    partial: { label: 'Partial', variant: 'warning' },
  };
  const cfg = map[status] ?? { label: status, variant: 'neutral' };
  return <Badge label={cfg.label} variant={cfg.variant} />;
}

export function orderStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    ordered: { label: 'Ordered', variant: 'neutral' },
    production_started: { label: 'Production', variant: 'info' },
    in_process: { label: 'In Process', variant: 'purple' },
    ready: { label: 'Ready', variant: 'success' },
    dispatched: { label: 'Dispatched', variant: 'info' },
    delivered: { label: 'Delivered', variant: 'success' },
    delayed: { label: 'Delayed', variant: 'error' },
  };
  const cfg = map[status] ?? { label: status, variant: 'neutral' };
  return <Badge label={cfg.label} variant={cfg.variant} />;
}

export function riskBadge(risk: string) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    low: { label: 'Low Risk', variant: 'success' },
    medium: { label: 'Medium Risk', variant: 'warning' },
    high: { label: 'High Risk', variant: 'error' },
    critical: { label: 'Critical', variant: 'error' },
  };
  const cfg = map[risk] ?? { label: risk, variant: 'neutral' };
  return <Badge label={cfg.label} variant={cfg.variant} />;
}
