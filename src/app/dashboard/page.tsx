import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Header } from '@/components/dashboard/header';
import { StatsCard } from '@/components/dashboard/stats-card';
import { RecentExecutions, type ExecutionItem } from '@/components/dashboard/recent-executions';
import { Mail, Search, Trash2, TrendingUp, ArrowRight } from 'lucide-react';

async function getDashboardStats(userId: string) {
  const [campaigns, scraperJobs, cleanupLogs, recentExecutions] = await Promise.all([
    prisma.campaign.count({ where: { execution: { userId } } }),
    prisma.scraperJob.aggregate({
      where: { execution: { userId } },
      _sum: { totalScraped: true, validEmails: true },
    }),
    prisma.cleanupLog.aggregate({
      where: { execution: { userId } },
      _sum: { deletedCount: true },
      _count: true,
    }),
    prisma.workflowExecution.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        campaign: { select: { id: true } },
      },
    }),
  ]);

  const successCount = await prisma.workflowExecution.count({
    where: { userId, status: 'SUCCESS' },
  });
  const totalCount = await prisma.workflowExecution.count({ where: { userId } });

  return {
    totalCampaigns: campaigns,
    totalLeadsScraped: scraperJobs._sum.totalScraped ?? 0,
    validLeads: scraperJobs._sum.validEmails ?? 0,
    totalCleanups: cleanupLogs._count ?? 0,
    totalDeleted: cleanupLogs._sum.deletedCount ?? 0,
    successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0,
    recentExecutions,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? "cmo8ubhgi0000difwp4jsua3t";

  const stats = await getDashboardStats(userId);

  const executions: ExecutionItem[] = stats.recentExecutions.map((exec) => ({
    id: exec.id,
    workflowType: exec.workflowType,
    workflowName: exec.workflowName,
    status: exec.status,
    createdAt: exec.createdAt,
    campaignId: exec.campaign?.id ?? null,
  }));

  return (
    <div>
      <Header title="Dashboard" description="Overview of your automation workflows" />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard
            title="Total Campaigns"
            value={stats.totalCampaigns}
            subtitle="AI-generated email campaigns"
            icon={Mail}
          />
          <StatsCard
            title="Leads Scraped"
            value={stats.totalLeadsScraped.toLocaleString()}
            subtitle={`${stats.validLeads.toLocaleString()} valid emails`}
            icon={Search}
          />
          <StatsCard
            title="Contacts Cleaned"
            value={stats.totalDeleted.toLocaleString()}
            subtitle={`${stats.totalCleanups} cleanup runs`}
            icon={Trash2}
          />
          <StatsCard
            title="Success Rate"
            value={`${stats.successRate}%`}
            subtitle="Across all workflows"
            icon={TrendingUp}
          />
        </div>

        <RecentExecutions initialExecutions={executions} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              href: '/dashboard/campaigns/new',
              icon: Mail,
              title: 'New Campaign',
              desc: 'AI-generate & send emails',
            },
            {
              href: '/dashboard/scraper',
              icon: Search,
              title: 'Scrape Leads',
              desc: 'Find leads on Google Maps',
            },
            {
              href: '/dashboard/cleanup',
              icon: Trash2,
              title: 'Run Cleanup',
              desc: 'Remove old Instantly contacts',
            },
          ].map(({ href, icon: Icon, title, desc }) => (
            <a
              key={href}
              href={href}
              className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900">{title}</p>
                <p className="text-xs text-zinc-500">{desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-indigo-600" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
