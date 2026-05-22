import { NextResponse } from 'next/server';

interface MetaApiError {
  error?: { message?: string };
}

interface InsightAction {
  action_type?: string;
  value?: string | number;
}

interface MetaInsight {
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_click_ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: InsightAction[];
  [key: string]: unknown;
}

interface ProcessedInsight extends MetaInsight {
  leads?: string | number;
  linkClicks?: string | number;
}

interface MetaAd {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  creative?: { thumbnail_url?: string; image_url?: string };
  insights?: { data?: MetaInsight[] };
  [key: string]: unknown;
}

interface MetaAdSet {
  id?: string;
  name?: string;
  ads?: { data?: MetaAd[] };
}

interface MetaCampaign {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  objective?: string;
  insights?: { data?: MetaInsight[] };
  adsets?: { data?: MetaAdSet[] };
  [key: string]: unknown;
}

interface AccountInsightsResponse extends MetaApiError {
  data?: MetaInsight[];
}

interface CampaignInsightsResponse extends MetaApiError {
  data?: MetaCampaign[];
}

export async function GET() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    return NextResponse.json({ error: 'Missing Meta credentials' }, { status: 500 });
  }

  try {
    // 1. Fetch Account-Level Insights (Aggregated)
    // Using date_preset=maximum to get all-time performance
    const accountInsightsUrl = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?fields=spend,impressions,reach,clicks,inline_link_click_ctr,cpc,cpm,actions&date_preset=maximum&access_token=${accessToken}`;
    const accountRes = await fetch(accountInsightsUrl);
    const accountData = (await accountRes.json()) as AccountInsightsResponse;

    // 2. Fetch Campaign-Level Breakdown with nested insights and ad structures
    const fields =
      'id,name,status,effective_status,objective,insights.date_preset(maximum){spend,impressions,reach,clicks,inline_link_click_ctr,actions},adsets{id,name,ads{id,name,status,effective_status,creative{thumbnail_url,image_url},insights.date_preset(maximum){spend,impressions,clicks,inline_link_click_ctr,actions}}}';
    const campaignInsightsUrl = `https://graph.facebook.com/v21.0/act_${adAccountId}/campaigns?fields=${fields}&limit=50&access_token=${accessToken}`;
    const campaignRes = await fetch(campaignInsightsUrl);
    const campaignData = (await campaignRes.json()) as CampaignInsightsResponse;

    if (!accountRes.ok || !campaignRes.ok) {
      return NextResponse.json(
        {
          error:
            accountData.error?.message ||
            campaignData.error?.message ||
            'Meta API Error',
        },
        { status: 400 }
      );
    }

    // Process actions to find leads if possible
    const processInsights = (insight: MetaInsight | undefined): ProcessedInsight | undefined => {
      if (!insight) return insight;
      const leads = insight.actions?.find((a) => a.action_type === 'lead')?.value || 0;
      const linkClicks =
        insight.actions?.find((a) => a.action_type === 'link_click')?.value || 0;
      return { ...insight, leads, linkClicks };
    };

    const processedAccount = processInsights(accountData.data?.[0]);
    const processedCampaigns = (campaignData.data || []).map((c) => {
      const adsets = (c.adsets?.data ?? []).map((adset) => {
        const ads = (adset.ads?.data ?? []).map((ad) => ({
          ...ad,
          insights: processInsights(ad.insights?.data?.[0]),
        }));
        return { ...adset, ads };
      });
      return {
        ...c,
        insights: processInsights(c.insights?.data?.[0]),
        adsets,
      };
    });

    return NextResponse.json({
      account: processedAccount || null,
      campaigns: processedCampaigns,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
