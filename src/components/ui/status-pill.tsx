import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const statusPillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
  {
    variants: {
      tone: {
        success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        warning: 'bg-amber-50 text-amber-700 ring-amber-200',
        danger: 'bg-rose-50 text-rose-700 ring-rose-200',
        info: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
        neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  }
);

const dotClasses: Record<NonNullable<VariantProps<typeof statusPillVariants>['tone']>, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-indigo-500',
  neutral: 'bg-zinc-400',
};

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  dot?: boolean;
  pulse?: boolean;
}

export function StatusPill({
  className,
  tone = 'neutral',
  dot = true,
  pulse,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span className={cn(statusPillVariants({ tone }), className)} {...props}>
      {dot ? (
        <span className="relative flex h-1.5 w-1.5">
          {pulse ? (
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
                dotClasses[tone ?? 'neutral']
              )}
            />
          ) : null}
          <span
            className={cn(
              'relative inline-flex h-1.5 w-1.5 rounded-full',
              dotClasses[tone ?? 'neutral']
            )}
          />
        </span>
      ) : null}
      {children}
    </span>
  );
}
