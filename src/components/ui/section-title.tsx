import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionTitleProps {
  children: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionTitle({
  children,
  description,
  action,
  className,
}: SectionTitleProps) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-zinc-900">{children}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex-shrink-0">{action}</div> : null}
    </div>
  );
}
