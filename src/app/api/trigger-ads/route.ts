import { supabase } from '@/lib/supabase';
import dns from 'node:dns';
import type { NextRequest } from 'next/server';

// Force IPv4 to prevent connection timeouts on some networks
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

interface TriggerAdsPayload {
  report_id?: string;
  report_data?: unknown;
  ads_config?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const { report_id, report_data, ads_config } = (await request.json()) as TriggerAdsPayload;

    if (!report_id || !report_data) {
      return Response.json(
        { success: false, error: 'Missing report_id or report_data' },
        { status: 400 }
      );
    }

    // Reset status_table for polling
    try {
      console.log('Resetting status_table for id: 1');
      const { error: statusError } = await supabase
        .from('status_table')
        .update({
          status: 'Triggering...',
          time: new Date().toISOString(),
        })
        .eq('id', 1);

      if (statusError) {
        console.error('Status reset DB error:', statusError);
      } else {
        console.log('Status table reset to Triggering...');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('Status reset failed:', message);
    }

    // Call external webhook with full report data
    const webhookUrl = 'https://n8n.srv881198.hstgr.cloud/webhook/generate_ad';
    console.log('Triggering webhook:', webhookUrl);

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          report_id,
          report_data,
          ads_config: ads_config || {},
          action: 'generate_ad',
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Webhook failed:', res.status, errorText);
        return Response.json(
          {
            success: false,
            error: `Webhook failed with status ${res.status}: ${errorText.slice(0, 100)}`,
          },
          { status: 502 }
        );
      }
      console.log('Webhook triggered successfully');
    } catch (webhookError) {
      const message = webhookError instanceof Error ? webhookError.message : String(webhookError);
      console.error('Webhook initial call failed:', message);
      return Response.json(
        { success: false, error: `Connection failed: ${message}` },
        { status: 500 }
      );
    }

    return Response.json({ success: true, message: 'Workflow triggered', report_id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
