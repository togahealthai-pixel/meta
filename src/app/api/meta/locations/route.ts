import type { NextRequest } from 'next/server';

interface MetaApiError {
  error?: { message?: string };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return Response.json([]);
  }

  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: 'Missing META_ACCESS_TOKEN' }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/search?type=adgeolocation&q=${encodeURIComponent(q)}&access_token=${token}`
    );
    const data = (await res.json()) as MetaApiError & { data?: unknown[] };

    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to fetch locations from Meta');
    }

    return Response.json(data.data || []);
  } catch (error) {
    console.error('Meta Location Search Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
