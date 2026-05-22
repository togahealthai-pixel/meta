import * as React from 'react';
import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MetricCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label?: string;
  };
  loading?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  sublabel,
  icon: Icon,
  trend,
  loading,
  className,
}: MetricCardProps) {
  const trendPositive = trend ? trend.value >= 0 : null;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </p>
        {Icon ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded-md bg-zinc-100" />
        ) : (
          <span className="text-3xl font-semibold tracking-tight text-zinc-900">
            {value}
          </span>
        )}

        {trend && !loading ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium',
              trendPositive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            )}
          >
            {trendPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(trend.value)}%
          </span>
        ) : null}
      </div>

      {sublabel ? (
        <p className="mt-1.5 text-xs text-zinc-500">{sublabel}</p>
      ) : null}
    </div>
  );
}
