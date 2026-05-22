import type { NextRequest } from 'next/server';

interface MetaStatusPayload {
  id?: string;
  status?: string;
  action?: string;
}

interface MetaApiResponse {
  error?: { message?: string };
}

export async function POST(request: NextRequest) {
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!accessToken) {
    return Response.json({ error: 'Missing Meta credentials' }, { status: 500 });
  }

  try {
    const { id, status, action } = (await request.json()) as MetaStatusPayload;

    if (!id) {
      return Response.json({ error: 'ID is required' }, { status: 400 });
    }

    let url = `https://graph.facebook.com/v21.0/${id}?access_token=${accessToken}`;
    let method: 'POST' | 'DELETE' = 'POST';

    if (action === 'delete') {
      method = 'DELETE';
    } else if (status) {
      url += `&status=${status}`;
    } else {
      return Response.json({ error: 'No action or status provided' }, { status: 400 });
    }

    const response = await fetch(url, { method });
    const data = (await response.json()) as MetaApiResponse;

    if (!response.ok) {
      return Response.json(
        { error: data.error?.message || 'Meta API Error' },
        { status: response.status }
      );
    }

    return Response.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
