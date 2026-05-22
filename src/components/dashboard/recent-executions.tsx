'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Search, Trash2, Copy, CheckCircle, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { formatRelativeTime } from '@/lib/utils';

export interface ExecutionItem {
  id: string;
  workflowType: string;
  workflowName: string | null;
  status: string;
  createdAt: Date;
  campaignId: string | null;
}

const statusColors: Record<string, 'success' | 'destructive' | 'secondary' | 'warning'> = {
  SUCCESS:   'success',
  FAILED:    'destructive',
  RUNNING:   'secondary',
  PENDING:   'warning',
  CANCELLED: 'secondary',
};

export function RecentExecutions({ initialExecutions }: { initialExecutions: ExecutionItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [executions, setExecutions] = useState<ExecutionItem[]>(initialExecutions);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reusingId, setReusingId] = useState<string | null>(null);

  async function handleDelete(exec: ExecutionItem) {
    const name = exec.workflowName || 'this campaign';
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    setDeletingId(exec.id);
    try {
      const url = exec.campaignId
        ? `/api/campaigns/${exec.campaignId}`
        : `/api/executions/${exec.id}`;

      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');

      setExecutions((prev) => prev.filter((e) => e.id !== exec.id));
      toast({ title: 'Deleted', description: `"${name}" has been removed.` });
    } catch {
      toast({ title: 'Error', description: 'Could not delete. Try again.', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReuse(exec: ExecutionItem) {
    if (!exec.campaignId) return;
    setReusingId(exec.id);
    try {
      const res = await fetch(`/api/campaigns/${exec.campaignId}`);
      const json = await res.json();
      if (!res.ok) throw new Error('Failed to load campaign');
      sessionStorage.setItem('reuse_campaign', JSON.stringify(json.originalInput));
      router.push('/dashboard/campaigns/new');
    } catch {
      toast({ title: 'Error', description: 'Could not load campaign data.', variant: 'destructive' });
      setReusingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-600" />
          Recent Workflow Executions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <CheckCircle className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No workflows run yet. Start by creating a campaign!</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {executions.map((exec) => {
              const isCampaignExec = exec.workflowType === 'CAMPAIGN';
              const canReuse = isCampaignExec && !!exec.campaignId;
              const isDeleting = deletingId === exec.id;
              const isReusing = reusingId === exec.id;

              return (
                <div
                  key={exec.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-zinc-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50">
                      {exec.workflowType === 'CAMPAIGN' && <Mail className="h-4 w-4 text-indigo-600" />}
                      {exec.workflowType === 'SCRAPER' && <Search className="h-4 w-4 text-indigo-600" />}
                      {(exec.workflowType === 'CLEANUP' || exec.workflowType === 'CAMPAIGN_APPROVAL') && (
                        <Trash2 className="h-4 w-4 text-indigo-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {exec.workflowName || exec.workflowType}
                      </p>
                      <p className="text-xs text-zinc-500">{formatRelativeTime(exec.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={statusColors[exec.status] ?? 'secondary'}>
                      {exec.status}
                    </Badge>

                    {canReuse && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isReusing}
                        onClick={() => handleReuse(exec)}
                        className="h-7 px-2 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 gap-1"
                        title="Reuse this campaign"
                      >
                        <Copy className="h-3 w-3" />
                        Reuse
                      </Button>
                    )}

                    {isCampaignExec && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isDeleting}
                        onClick={() => handleDelete(exec)}
                        className="h-7 px-2 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 gap-1"
                        title="Delete this campaign"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
