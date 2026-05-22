import { NextResponse, type NextRequest } from 'next/server';

interface ProxyPayload {
  url?: string;
  body?: unknown;
  method?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { url, body, method = 'POST' } = (await request.json()) as ProxyPayload;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log(`Proxying ${method} request to: ${url}`);

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = body ? JSON.stringify(body) : JSON.stringify({});
    }

    const response = await fetch(url, fetchOptions);

    const data = await response.json().catch(() => ({ status: 'ok' }));

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
