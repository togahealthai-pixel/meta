import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkflowStepProps {
  step: number | string;
  label: React.ReactNode;
  description?: React.ReactNode;
  active?: boolean;
  done?: boolean;
  className?: string;
}

export function WorkflowStep({
  step,
  label,
  description,
  active,
  done,
  className,
}: WorkflowStepProps) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border text-xs font-semibold transition-colors',
          done
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : active
              ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
              : 'border-zinc-200 bg-white text-zinc-400'
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : step}
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <div
          className={cn(
            'text-sm transition-colors',
            active || done ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-400'
          )}
        >
          {label}
        </div>
        {description ? (
          <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">{description}</div>
        ) : null}
      </div>
    </div>
  );
}
