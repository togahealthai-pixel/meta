import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppShell } from '@/components/layout/app-shell';
import { Sidebar } from '@/components/dashboard/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await getServerSession(authOptions);
  // Removed login wall as requested

  return <AppShell sidebar={<Sidebar />}>{children}</AppShell>;
}
