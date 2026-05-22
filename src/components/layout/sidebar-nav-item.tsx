'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './app-shell';

export interface SidebarNavItemProps {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  external?: boolean;
  active?: boolean;
  badge?: React.ReactNode;
}

export function SidebarNavItem({
  label,
  icon: Icon,
  href,
  onClick,
  external,
  active,
  badge,
}: SidebarNavItemProps) {
  const { setOpen } = useSidebar();

  const closeDrawer = React.useCallback(() => {
    // Only close on tablet — desktop sidebar is always visible so this is a no-op there
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setOpen(false);
    }
  }, [setOpen]);

  const content = (
    <>
      {Icon ? (
        <Icon
          className={cn(
            'h-4 w-4 flex-shrink-0 transition-colors',
            active ? 'text-indigo-600' : 'text-zinc-400 group-hover:text-zinc-600'
          )}
        />
      ) : (
        <span className="h-4 w-4 flex-shrink-0" aria-hidden />
      )}
      <span className="flex-1 truncate">{label}</span>
      {badge ? <span className="ml-auto">{badge}</span> : null}
      {external ? (
        <ArrowUpRight
          className={cn(
            'ml-auto h-3.5 w-3.5 flex-shrink-0 transition-colors',
            active ? 'text-indigo-500' : 'text-zinc-300 group-hover:text-zinc-500'
          )}
        />
      ) : null}
    </>
  );

  const classes = cn(
    'group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    active
      ? 'bg-indigo-50 text-indigo-700'
      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
  );

  if (href && external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={closeDrawer}
        className={classes}
      >
        {content}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} onClick={closeDrawer} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        closeDrawer();
      }}
      className={cn(classes, 'text-left')}
    >
      {content}
    </button>
  );
}
