'use client';

import * as React from 'react';
import { Menu, Monitor, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SidebarContext = React.createContext<SidebarContextValue>({
  open: false,
  setOpen: () => {},
});

export function useSidebar() {
  return React.useContext(SidebarContext);
}

export interface AppShellProps {
  sidebar: React.ReactNode;
  topBar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ sidebar, topBar, children, className }: AppShellProps) {
  const [open, setOpen] = React.useState(false);

  // Close drawer when viewport grows past lg breakpoint so static sidebar takes over cleanly
  React.useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Lock background scroll while drawer open (tablet)
  React.useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      {/* Mobile blocker (< md / < 768px) */}
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white px-6 text-center md:hidden">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Monitor size={26} />
        </div>
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-zinc-900">
          Desktop required
        </h1>
        <p className="max-w-xs text-sm leading-relaxed text-zinc-500">
          Togahh is designed for desktop and tablet screens. Open this on a larger device to
          continue.
        </p>
        <p className="mt-6 text-xs text-zinc-400">Minimum width: 768px</p>
      </div>

      {/* App shell (md+) */}
      <div className={cn('hidden h-screen overflow-hidden bg-zinc-50 md:flex', className)}>
        {/* Drawer backdrop on tablet */}
        {open ? (
          <div
            className="fixed inset-0 z-30 bg-zinc-900/40 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
        ) : null}

        {/* Sidebar — fixed drawer below lg, static at lg+ */}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out lg:relative lg:translate-x-0',
            open ? 'translate-x-0 shadow-xl lg:shadow-none' : '-translate-x-full lg:translate-x-0'
          )}
        >
          {/* Close button — only visible while drawer is open on < lg */}
          <button
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 lg:hidden"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
          {sidebar}
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {topBar ?? (
            // Fallback: callers that don't pass a topBar still need a hamburger on tablet
            <header className="sticky top-0 z-20 flex h-12 items-center border-b border-zinc-200 bg-white/80 px-4 backdrop-blur lg:hidden">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
            </header>
          )}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
