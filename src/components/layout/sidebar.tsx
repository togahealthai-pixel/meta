'use client';

import * as React from 'react';
import { Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarNavItem } from './sidebar-nav-item';

export interface SidebarItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  external?: boolean;
  active?: boolean;
  badge?: React.ReactNode;
}

export interface SidebarSection {
  label?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  sections: SidebarSection[];
  brand?: string;
  brandSubtitle?: string;
  footer?: React.ReactNode;
  className?: string;
}

export function Sidebar({
  sections,
  brand = 'Togahh',
  brandSubtitle = 'Meta Ads & Content',
  footer,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full w-64 flex-shrink-0 flex-col border-r border-zinc-200 bg-white',
        className
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-zinc-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold tracking-tight text-zinc-900">
            {brand}
          </span>
          {brandSubtitle ? (
            <span className="truncate text-[11px] text-zinc-500">{brandSubtitle}</span>
          ) : null}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section, idx) => (
          <div key={idx} className={cn(idx > 0 && 'mt-6')}>
            {section.label ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {section.label}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarNavItem
                  key={item.key}
                  label={item.label}
                  icon={item.icon}
                  href={item.href}
                  onClick={item.onClick}
                  external={item.external}
                  active={item.active}
                  badge={item.badge}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {footer ? (
        <div className="border-t border-zinc-200 p-3">{footer}</div>
      ) : null}
    </aside>
  );
}
