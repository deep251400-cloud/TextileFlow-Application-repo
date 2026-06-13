import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  color: 'teal' | 'amber' | 'red' | 'emerald' | 'blue' | 'slate';
  trend?: { value: string; positive: boolean };
}

const colorMap = {
  teal: { bg: 'bg-teal-50 dark:bg-teal-950/50', icon: 'bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400', value: 'text-teal-700 dark:text-teal-300' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/50', icon: 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400', value: 'text-amber-700 dark:text-amber-300' },
  red: { bg: 'bg-red-50 dark:bg-red-950/50', icon: 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400', value: 'text-red-700 dark:text-red-300' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/50', icon: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400', value: 'text-emerald-700 dark:text-emerald-300' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/50', icon: 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400', value: 'text-blue-700 dark:text-blue-300' },
  slate: { bg: 'bg-slate-50 dark:bg-slate-900/50', icon: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400', value: 'text-slate-700 dark:text-slate-300' },
};

export default function MetricCard({ title, value, subtitle, icon: Icon, color, trend }: MetricCardProps) {
  const colors = colorMap[color];
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 flex items-start gap-4 shadow-sm hover:shadow-md dark:shadow-md dark:hover:shadow-lg transition-shadow">
      <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${colors.icon}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{title}</p>
        <p className={`text-sm sm:text-base md:text-lg lg:text-xl font-bold mt-0.5 ${colors.value} leading-tight`}>{value}</p>
        {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{subtitle}</p>}
        {trend && (
          <p className={`text-xs font-medium mt-1 ${trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}
