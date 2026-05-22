'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { format } from 'date-fns';
import { Mail, TrendingUp, Users, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatServiceType, formatDuration } from '@/lib/utils';
import type { Campaign } from '@/types';

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'success' | 'destructive' | 'secondary' | 'warning'> = {
    SUCCESS: 'success',
    FAILED: 'destructive',
    RUNNING: 'secondary',
    PENDING: 'warning',
    CANCELLED: 'secondary',
  };
  return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
}

export function CampaignList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await axios.get<{ campaigns: Campaign[] }>('/api/campaigns');
      return res.data.campaigns;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600 py-8 justify-center">
        <AlertCircle className="h-5 w-5" />
        <span>Failed to load campaigns</span>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Mail className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-lg font-medium">No campaigns yet</p>
        <p className="text-sm">Create your first campaign to get started</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-indigo-600" />
          Campaign History ({data.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> Sent
                </span>
              </TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Success
                </span>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell className="font-medium">{campaign.campaignName}</TableCell>
                <TableCell className="text-sm text-gray-600">
                  {formatServiceType(campaign.serviceType)}
                </TableCell>
                <TableCell className="text-sm">{campaign.targetRegion}</TableCell>
                <TableCell className="text-sm font-medium">{campaign.totalLeadsSent}</TableCell>
                <TableCell>
                  <span className="text-green-600 font-medium">{campaign.successfulSends}</span>
                  {campaign.failedSends > 0 && (
                    <span className="text-red-500 text-xs ml-1">(-{campaign.failedSends})</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={campaign.execution.status} />
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {formatDuration(campaign.execution.duration)}
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {format(new Date(campaign.createdAt), 'MMM dd, yyyy')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
