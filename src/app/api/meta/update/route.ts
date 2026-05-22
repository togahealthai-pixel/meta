import { NextResponse, type NextRequest } from 'next/server';

interface UpdatePayload {
  campaignId?: string;
  campaignData?: Record<string, unknown>;
  adSetId?: string;
  adSetData?: Record<string, unknown>;
}

interface MetaApiResponse {
  error?: { message?: string };
  [key: string]: unknown;
}

interface UpdateResults {
  campaign?: MetaApiResponse;
  adSet?: MetaApiResponse;
}

export async function POST(request: NextRequest) {
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json({ error: 'Missing Meta credentials' }, { status: 500 });
  }

  try {
    const { campaignId, campaignData, adSetId, adSetData } =
      (await request.json()) as UpdatePayload;

    const results: UpdateResults = {};

    // 1. Update Campaign
    if (campaignId && campaignData && Object.keys(campaignData).length > 0) {
      const campaignRes = await fetch(
        `https://graph.facebook.com/v21.0/${campaignId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...campaignData,
            access_token: accessToken,
          }),
        }
      );
      const campaignResData = (await campaignRes.json()) as MetaApiResponse;
      if (!campaignRes.ok) {
        throw new Error(
          'Campaign Update Error: ' + (campaignResData.error?.message || 'Unknown error')
        );
      }
      results.campaign = campaignResData;
    }

    // 2. Update Ad Set
    if (adSetId && adSetData && Object.keys(adSetData).length > 0) {
      const adSetRes = await fetch(
        `https://graph.facebook.com/v21.0/${adSetId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...adSetData,
            access_token: accessToken,
          }),
        }
      );
      const adSetResData = (await adSetRes.json()) as MetaApiResponse;
      if (!adSetRes.ok) {
        throw new Error(
          'Ad Set Update Error: ' + (adSetResData.error?.message || 'Unknown error')
        );
      }
      results.adSet = adSetResData;
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Update Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
