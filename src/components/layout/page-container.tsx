import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

const sizeClasses: Record<NonNullable<PageContainerProps['size']>, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  full: 'max-w-none',
};

export function PageContainer({
  children,
  className,
  size = 'lg',
}: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full px-6 py-8', sizeClasses[size], className)}>
      {children}
    </div>
  );
}
