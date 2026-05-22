import dns from 'node:dns';
import type { NextRequest } from 'next/server';

// Force IPv4 to prevent connection timeouts on some networks
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// ============================================================
// API PROXY — /api/trigger-n8n
// Routes each action to its own n8n webhook URL (fixes CORS)
// ============================================================

const WEBHOOKS: Record<string, string> = {
  competitor_analysis:  'https://n8n.srv881198.hstgr.cloud/webhook/meta_ads_scraper',
  generate_ad:          'https://n8n.srv881198.hstgr.cloud/webhook/generate_ad',
  launch_meta_ad:       'https://n8n.srv881198.hstgr.cloud/webhook/launch_ad',
  stop_campaign:        'https://n8n.srv881198.hstgr.cloud/webhook/stop_campaign',
  generate_report:      'https://n8n.srv881198.hstgr.cloud/webhook/generate_report',
  generate_social_post: 'https://n8n.srv881198.hstgr.cloud/webhook/social_post',
};

interface N8nProxyPayload {
  action?: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as N8nProxyPayload;
    const { action } = body;

    const url = action ? WEBHOOKS[action] : undefined;
    if (!url) {
      return Response.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawResponse: text, ok: response.ok };
    }

    // If n8n itself returned an error status, wrap it in a 200 so the
    // client's catch block handles it gracefully instead of throwing.
    if (!response.ok) {
      const errorField =
        data && typeof data === 'object' && 'error' in data
          ? (data as { error?: string }).error
          : undefined;
      return Response.json(
        { error: errorField || `n8n returned ${response.status}`, rawResponse: text },
        { status: 200 }
      );
    }

    return Response.json(data, { status: 200 });
  } catch (err) {
    // Network / parse errors
    console.error('API Proxy Error:', err);

    return Response.json(
      {
        error: err instanceof Error ? err.message : 'Failed to reach n8n',
        isTimeout: true, // Hint to the frontend that it might still be running
        action: request.headers.get('x-action'),
      },
      { status: 200 }
    );
  }
}
