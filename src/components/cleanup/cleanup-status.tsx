'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Trash2, Loader2, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { formatRelativeTime } from '@/lib/utils';

interface CleanupStatus {
  lastCleanup: string | null;
  nextScheduled: string | null;
  totalDeleted: number;
  totalRuns: number;
}

export function CleanupStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['cleanup-status'],
    queryFn: async () => {
      const res = await axios.get<CleanupStatus>('/api/cleanup/status');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const triggerCleanup = useMutation({
    mutationFn: async () => {
      const res = await axios.post('/api/cleanup/trigger', { force_cleanup: true });
      return res.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Cleanup completed!',
        description: `Deleted ${data.n8nResponse?.results?.deleted_count || 0} contacts from Instantly`,
      });
      queryClient.invalidateQueries({ queryKey: ['cleanup-status'] });
      queryClient.invalidateQueries({ queryKey: ['cleanup-logs'] });
    },
    onError: () => {
      toast({
        title: 'Cleanup failed',
        description: 'Failed to trigger cleanup. Please try again.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* Status Card */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-indigo-600" />
            Cleanup Status
          </CardTitle>
          <CardDescription>
            Automatically removes old contacts from Instantly.ai every 10 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Last Cleanup
              </p>
              <p className="font-medium">
                {status?.lastCleanup
                  ? formatRelativeTime(status.lastCleanup)
                  : 'Never run'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Next Scheduled
              </p>
              <p className="font-medium">
                {status?.nextScheduled
                  ? formatRelativeTime(status.nextScheduled)
                  : 'Not scheduled'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Trash2 className="h-3 w-3" /> Total Deleted
              </p>
              <p className="text-2xl font-bold text-gray-900">{status?.totalDeleted ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Total Runs</p>
              <p className="text-2xl font-bold text-gray-900">{status?.totalRuns ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Trigger Card */}
      <Card className="border-dashed border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="text-base">Manual Trigger</CardTitle>
          <CardDescription>Run cleanup now without waiting for schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs text-amber-800">
              This will delete contacts older than 10 days from Instantly.ai and update Google Sheets.
            </p>
          </div>
          <Button
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            onClick={() => triggerCleanup.mutate()}
            disabled={triggerCleanup.isPending}
          >
            {triggerCleanup.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {triggerCleanup.isPending ? 'Cleaning up...' : 'Run Cleanup Now'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
