import dns from 'node:dns';
import { request as httpsRequest } from 'node:https';

// Max 300s on Vercel Hobby plan
export const maxDuration = 300;

const WEBHOOKS: Record<string, string> = {
  competitor_analysis: process.env.N8N_COMPETITOR_ANALYSIS_URL || "https://n8n.srv1208919.hstgr.cloud/webhook/meta_ads_scraper",
  generate_ad: process.env.NEXT_PUBLIC_N8N_GENERATE_AD_URL || "https://n8n.srv1208919.hstgr.cloud/webhook/generate_ad",
};

// Fetch using explicit IPv4 + proper SNI so SSL cert validation still works
function fetchIPv4(urlStr: string, body: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);

    dns.lookup(parsed.hostname, { family: 4 }, (err, address) => {
      if (err) {
        // Fall back to normal connection if IPv4 lookup fails
        address = parsed.hostname;
      }

      const path = parsed.pathname + (parsed.search || '');
      const req = httpsRequest(
        {
          hostname: address,            // connect via IPv4
          port: 443,
          path,
          method: 'POST',
          servername: parsed.hostname,  // SNI — keeps SSL cert valid
          headers: {
            'Content-Type': 'application/json',
            'Host': parsed.hostname,
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 295_000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => resolve({ status: res.statusCode ?? 0, text: data }));
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
      req.write(body);
      req.end();
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    const url = WEBHOOKS[action];
    if (!url) {
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    console.log(`[trigger-n8n] ${action} → ${url}`);

    const bodyStr = JSON.stringify(body);
    let result: { status: number; text: string };

    try {
      result = await fetchIPv4(url, bodyStr);
    } catch (fetchErr: any) {
      console.error('[trigger-n8n] fetch error:', fetchErr.message);
      return Response.json(
        { error: fetchErr.message, isTimeout: true, action },
        { status: 200 }
      );
    }

    console.log(`[trigger-n8n] response ${result.status}:`, result.text.slice(0, 300));

    let data: any;
    try { data = JSON.parse(result.text); }
    catch { data = { rawResponse: result.text, ok: result.status < 400 }; }

    if (result.status >= 400) {
      return Response.json(
        { error: data?.error || data?.message || `n8n returned ${result.status}`, rawResponse: result.text },
        { status: 200 }
      );
    }

    return Response.json(data, { status: 200 });

  } catch (err: any) {
    console.error('[trigger-n8n] unexpected error:', err);
    return Response.json(
      { error: err.message || 'Failed to reach n8n', isTimeout: true },
      { status: 200 }
    );
  }
}
