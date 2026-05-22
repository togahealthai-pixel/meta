'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { format } from 'date-fns';
import { Trash2, AlertCircle } from 'lucide-react';
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
import type { CleanupLog } from '@/types';

export function CleanupHistory() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cleanup-logs'],
    queryFn: async () => {
      const res = await axios.get<{ logs: CleanupLog[] }>('/api/cleanup/status');
      return res.data.logs ?? [];
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
        Failed to load cleanup history
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Trash2 className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-lg font-medium">No cleanup runs yet</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-indigo-600" />
          Cleanup History ({data.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Total Contacts</TableHead>
              <TableHead>Deleted</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium text-sm">
                  {format(new Date(log.cleanupDate), 'MMM dd, yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  <Badge variant={log.triggerType === 'manual' ? 'secondary' : 'outline'}>
                    {log.triggerType}
                  </Badge>
                </TableCell>
                <TableCell>{log.totalContacts}</TableCell>
                <TableCell className="font-medium text-red-600">{log.deletedCount}</TableCell>
                <TableCell>
                  <Badge variant={log.execution.status === 'SUCCESS' ? 'success' : 'destructive'}>
                    {log.execution.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
