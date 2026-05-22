'use client';

import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Mail,
  Search,
  History,
  Trash2,
  BarChart3,
} from 'lucide-react';
import { Sidebar as SharedSidebar, type SidebarItem } from '@/components/layout/sidebar';

const items: Array<Omit<SidebarItem, 'active'>> = [
  { key: 'dashboard',        label: 'Dashboard',       icon: LayoutDashboard, href: '/dashboard' },
  { key: 'campaigns',        label: 'Campaigns',       icon: Mail,            href: '/dashboard/campaigns' },
  { key: 'scraper',          label: 'Lead Scraper',    icon: Search,          href: '/dashboard/scraper' },
  { key: 'scraper-history',  label: 'Scraper History', icon: History,         href: '/dashboard/scraper/history' },
  { key: 'cleanup',          label: 'Cleanup',         icon: Trash2,          href: '/dashboard/cleanup' },
  { key: 'analytics',        label: 'Analytics',       icon: BarChart3,       href: '/dashboard/analytics' },
];

function isActiveHref(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(href + '/');
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <SharedSidebar
      sections={[
        {
          label: 'Workflows',
          items: items.map((item) => ({
            ...item,
            active: isActiveHref(pathname, item.href ?? ''),
          })),
        },
      ]}
    />
  );
}
