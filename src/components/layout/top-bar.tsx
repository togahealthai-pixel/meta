'use client';

import * as React from 'react';
import { Menu, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './app-shell';

export interface TopBarProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  search?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

export function TopBar({
  title,
  subtitle,
  breadcrumbs,
  search = true,
  actions,
  className,
}: TopBarProps) {
  const { setOpen } = useSidebar();

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur md:gap-4 md:px-6',
        className
      )}
    >
      {/* Hamburger — visible on < lg (tablet) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        {breadcrumbs ? (
          <div className="text-[11px] font-medium text-zinc-500">{breadcrumbs}</div>
        ) : null}
        {title ? (
          <h1 className="truncate text-sm font-semibold text-zinc-900">{title}</h1>
        ) : null}
        {subtitle ? (
          <p className="truncate text-[11px] text-zinc-500">{subtitle}</p>
        ) : null}
      </div>

      {search ? (
        <div className="hidden items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-white md:flex md:w-64">
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Search</span>
          <kbd className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            ⌘K
          </kbd>
        </div>
      ) : null}

      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
