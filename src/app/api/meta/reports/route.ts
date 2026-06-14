import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    return NextResponse.json({ error: "Missing Meta credentials" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const datePreset = searchParams.get("date_preset") || "maximum";
  const campaignId = searchParams.get("campaign_id") || "";

  try {
    let accountInsightsUrl: string;
    if (campaignId) {
      // When filtering by campaign, get that campaign's insights as account-level totals
      accountInsightsUrl = `https://graph.facebook.com/v21.0/${campaignId}/insights?fields=spend,impressions,reach,clicks,inline_link_click_ctr,cpc,cpm,actions&date_preset=${datePreset}&access_token=${accessToken}`;
    } else {
      accountInsightsUrl = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?fields=spend,impressions,reach,clicks,inline_link_click_ctr,cpc,cpm,actions&date_preset=${datePreset}&access_token=${accessToken}`;
    }

    const accountRes = await fetch(accountInsightsUrl);
    const accountData = await accountRes.json();

    // Campaign-level breakdown
    const fields = `id,name,status,effective_status,objective,insights.date_preset(${datePreset}){spend,impressions,reach,clicks,inline_link_click_ctr,actions},adsets{id,name,ads{id,name,status,effective_status,creative{thumbnail_url,image_url},insights.date_preset(${datePreset}){spend,impressions,clicks,inline_link_click_ctr,actions}}}`;
    let campaignInsightsUrl: string;
    if (campaignId) {
      campaignInsightsUrl = `https://graph.facebook.com/v21.0/${campaignId}?fields=${fields}&access_token=${accessToken}`;
    } else {
      campaignInsightsUrl = `https://graph.facebook.com/v21.0/act_${adAccountId}/campaigns?fields=${fields}&limit=50&access_token=${accessToken}`;
    }

    const campaignRes = await fetch(campaignInsightsUrl);
    const campaignData = await campaignRes.json();

    if (!accountRes.ok || !campaignRes.ok) {
      return NextResponse.json({
        error: accountData.error?.message || campaignData.error?.message || "Meta API Error"
      }, { status: 400 });
    }

    const processInsights = (insight: Record<string, unknown> | null | undefined) => {
      if (!insight) return insight;
      const actions = (insight.actions as Array<{ action_type: string; value: string }>) || [];
      const leads = actions.find(a => a.action_type === 'lead')?.value || 0;
      const linkClicks = actions.find(a => a.action_type === 'link_click')?.value || 0;
      return { ...insight, leads, linkClicks };
    };

    const processedAccount = processInsights(accountData.data?.[0]);

    // Handle single campaign response vs array
    const rawCampaigns = campaignId
      ? (campaignData.id ? [campaignData] : [])
      : (campaignData.data || []);

    const processedCampaigns = rawCampaigns.map((c: Record<string, unknown>) => {
      let adsets: unknown[] = [];
      const cAdsets = c.adsets as { data?: Record<string, unknown>[] } | undefined;
      if (cAdsets?.data) {
        adsets = cAdsets.data.map((adset: Record<string, unknown>) => {
          let ads: unknown[] = [];
          const adsetAds = adset.ads as { data?: Record<string, unknown>[] } | undefined;
          if (adsetAds?.data) {
            ads = adsetAds.data.map((ad: Record<string, unknown>) => ({
              ...ad,
              insights: processInsights((ad.insights as { data?: Record<string, unknown>[] })?.data?.[0])
            }));
          }
          return { ...adset, ads };
        });
      }
      return {
        ...c,
        insights: processInsights((c.insights as { data?: Record<string, unknown>[] })?.data?.[0]),
        adsets
      };
    });

    return NextResponse.json({
      account: processedAccount || null,
      campaigns: processedCampaigns
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
