import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  className?: string;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {title}
        </p>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">
        {value}
      </div>

      {subtitle && (
        <p className="mt-1.5 text-xs text-zinc-500">{subtitle}</p>
      )}

      {trend && (
        <p
          className={cn(
            'mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium',
            trend.positive
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          )}
        >
          {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% from last month
        </p>
      )}
    </div>
  );
}
