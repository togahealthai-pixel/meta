import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    return NextResponse.json({ error: "Missing Meta credentials" }, { status: 500 });
  }

  try {
    const fields = "id,name,status,effective_status,objective,daily_budget,lifetime_budget,adsets{id,name,status,effective_status,daily_budget,lifetime_budget,start_time,end_time,insights.date_preset(today){spend},ads{id,name,status,effective_status,creative{id,thumbnail_url},insights.date_preset(maximum){spend,inline_link_click_ctr,clicks,impressions,actions}}}";
    const response = await fetch(
      `https://graph.facebook.com/v21.0/act_${adAccountId}/campaigns?fields=${fields}&limit=50&access_token=${accessToken}`
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || "Meta API Error" }, { status: response.status });
    }

    return NextResponse.json(data.data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    return NextResponse.json({ error: "Missing Meta credentials" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { name, objective = "OUTCOME_TRAFFIC", status = "PAUSED" } = body;

    if (!name) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/act_${adAccountId}/campaigns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          objective,
          status,
          special_ad_categories: ["NONE"],
          access_token: accessToken,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || "Meta API Error" }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
