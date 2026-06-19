import { supabase } from '@/lib/supabase'
import dns from 'node:dns'

// Force IPv4 to prevent connection timeouts on some networks
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

export async function POST(request) {
  try {
    const { report_id, report_data, ads_config } = await request.json()

    if (!report_id || !report_data) {
      return Response.json(
        { success: false, error: 'Missing report_id or report_data' },
        { status: 400 }
      )
    }

    // Reset status_table for polling
    try {
      console.log('Resetting status_table for id: 1');
      const { error: statusError } = await supabase
        .from('status_table')
        .update({ 
          status: 'Triggering...',
          time: new Date().toISOString() 
        })
        .eq('id', 1);
      
      if (statusError) {
        console.error('Status reset DB error:', statusError);
      } else {
        console.log('Status table reset to Triggering...');
      }
    } catch (err) {
      console.warn('Status reset failed:', err.message);
    }

    // Call external webhook with full report data
    const webhookUrl = process.env.NEXT_PUBLIC_N8N_GENERATE_AD_URL || 'https://n8n.srv1208919.hstgr.cloud/webhook/generate_ad';
    console.log('Triggering webhook:', webhookUrl);

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({ 
          report_id, 
          report_data, 
          ads_config: ads_config || {},
          action: 'generate_ad'
        }),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Webhook failed:', res.status, errorText);
        return Response.json(
          { success: false, error: `Webhook failed with status ${res.status}: ${errorText.slice(0, 100)}` },
          { status: 502 }
        )
      }
      console.log('Webhook triggered successfully');
    } catch (webhookError) {
      console.error('Webhook initial call failed:', webhookError.message);
      return Response.json(
        { success: false, error: `Connection failed: ${webhookError.message}` },
        { status: 500 }
      )
    }

    return Response.json({ success: true, message: 'Workflow triggered', report_id })
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
