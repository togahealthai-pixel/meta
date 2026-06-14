import { NextResponse } from "next/server";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET() {
  const token = process.env.META_ACCESS_TOKEN;
  const account = process.env.META_AD_ACCOUNT_ID;

  if (!token || !account) {
    return NextResponse.json({ error: "Missing Meta credentials" }, { status: 500 });
  }

  try {
    // Fetch only ACTIVE ads
    const adFields = "id,name,effective_status,campaign_id,adset_id,creative{thumbnail_url,image_url}";
    const adsUrl = `${GRAPH}/act_${account}/ads?fields=${adFields}&effective_status=["ACTIVE"]&limit=100&access_token=${token}`;
    const adsRes = await fetch(adsUrl);
    const adsData = await adsRes.json();

    if (!adsRes.ok) {
      return NextResponse.json({ error: adsData.error?.message || "Meta API error" }, { status: adsRes.status });
    }

    const ads: Record<string, unknown>[] = adsData.data || [];
    if (ads.length === 0) return NextResponse.json({ ads: [] });

    // Fetch insights for these ads (last 30 days)
    const insightFields = "ad_id,spend,impressions,inline_link_clicks,inline_link_click_ctr,cpm,cpc";
    const insUrl = `${GRAPH}/act_${account}/insights?level=ad&fields=${insightFields}&date_preset=last_30_d&limit=200&access_token=${token}`;
    const insRes = await fetch(insUrl);
    const insData = await insRes.json();
    const insightMap = new Map<string, Record<string, unknown>>(
      ((insData.data || []) as Record<string, unknown>[]).map((i) => [i.ad_id as string, i])
    );

    // Fetch campaign names
    const campUrl = `${GRAPH}/act_${account}/campaigns?fields=id,name&limit=200&access_token=${token}`;
    const campRes = await fetch(campUrl);
    const campData = await campRes.json();
    const campMap = new Map<string, string>(
      ((campData.data || []) as Record<string, unknown>[]).map((c) => [c.id as string, c.name as string])
    );

    const result = ads.map((ad) => {
      const ins = insightMap.get(ad.id as string) || {};
      const creative = (ad.creative as Record<string, unknown>) || {};
      return {
        id: ad.id,
        name: ad.name,
        status: "ACTIVE",
        campaign_name: campMap.get(ad.campaign_id as string) || "",
        thumbnail_url: (creative.thumbnail_url || creative.image_url || "") as string,
        spend: parseFloat((ins.spend as string) || "0"),
        impressions: parseInt((ins.impressions as string) || "0", 10),
        clicks: parseInt((ins.inline_link_clicks as string) || "0", 10),
        ctr: parseFloat((ins.inline_link_click_ctr as string) || "0"),
        cpm: parseFloat((ins.cpm as string) || "0"),
        cpc: parseFloat((ins.cpc as string) || "0"),
      };
    });

    return NextResponse.json({ ads: result });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
