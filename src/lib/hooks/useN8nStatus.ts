import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type N8nStatus = string | null;

export function useN8nStatus(): N8nStatus {
  const [status, setStatus] = useState<N8nStatus>(null);

  useEffect(() => {
    // 1. Fetch initial status (latest by ID)
    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('n8n')
          .select('status')
          .order('id', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error fetching initial status (details):', error);
        } else if (data && data.length > 0) {
          setStatus(data[0].status);
        } else {
          console.warn('No rows found in n8n table. Check RLS policies?');
        }
      } catch (err) {
        console.error('Unexpected error fetching status:', err);
      }
    };

    fetchStatus();

    // 2. Subscribe to real-time changes
    const channel = supabase
      .channel('n8n-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'n8n',
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          const next = payload.new as { status?: string } | null;
          if (next && 'status' in next && typeof next.status !== 'undefined') {
            setStatus(next.status);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return status;
}
