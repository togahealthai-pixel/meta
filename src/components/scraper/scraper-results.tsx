'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { format } from 'date-fns';
import { Search, Mail, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
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
import { formatDuration } from '@/lib/utils';
import type { ScraperJob } from '@/types';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'success' | 'destructive' | 'secondary' | 'warning'> = {
    SUCCESS: 'success',
    FAILED: 'destructive',
    RUNNING: 'secondary',
    PENDING: 'warning',
  };
  return <Badge variant={map[status] || 'secondary'}>{status}</Badge>;
}

export function ScraperResults() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['scraper-jobs'],
    queryFn: async () => {
      const res = await axios.get<{ jobs: ScraperJob[] }>('/api/scraper/jobs');
      return res.data.jobs;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600 py-8 justify-center">
        <AlertCircle className="h-5 w-5" />
        Failed to load scraper history
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Search className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-lg font-medium">No scraper jobs yet</p>
        <p className="text-sm">Run a scraper to find leads from Google Maps</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4 text-indigo-600" />
          Scraper History ({data.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Niches</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Target Sheet</TableHead>
              <TableHead>
                <span className="flex items-center gap-1">Total</span>
              </TableHead>
              <TableHead>
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" /> Valid
                </span>
              </TableHead>
              <TableHead>
                <span className="flex items-center gap-1 text-red-500">
                  <XCircle className="h-3 w-3" /> Invalid
                </span>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium text-sm max-w-[150px] truncate">
                  {Array.isArray(job.niches) ? job.niches.join(', ') : job.niches}
                </TableCell>
                <TableCell className="text-sm">{job.location}</TableCell>
                <TableCell className="text-sm text-gray-600">{job.targetSheet}</TableCell>
                <TableCell className="font-medium">{job.totalScraped}</TableCell>
                <TableCell className="text-green-600 font-medium">{job.validEmails}</TableCell>
                <TableCell className="text-red-500">{job.invalidEmails}</TableCell>
                <TableCell>
                  <StatusBadge status={job.execution.status} />
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {formatDuration(job.execution.duration)}
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {format(new Date(job.createdAt), 'MMM dd, yyyy')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
