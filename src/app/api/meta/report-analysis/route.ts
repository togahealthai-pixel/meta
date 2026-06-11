import { NextRequest, NextResponse } from "next/server";

const META_TOKEN = process.env.META_ACCESS_TOKEN!;
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;
const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const filter = searchParams.get("filter") || "both"; // live | paused | both
    const note = searchParams.get("note") || "";
    const datePreset = searchParams.get("date_preset") || "last_30d";

    if (!META_TOKEN || !META_ACCOUNT) {
      return NextResponse.json({ error: "Missing Meta credentials" }, { status: 500 });
    }

    // Fetch ALL campaigns with nested adsets → ads → insights + creative
    // (no effective_status filter — filter client-side to avoid Meta API quirks)
    const insightFields = `spend,impressions,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,cpm,reach,frequency`;
    const fields = [
      "id", "name", "status", "effective_status",
      `adsets{id,name,status,effective_status,ads{id,name,status,effective_status,creative{id,title,body,call_to_action_type},insights.date_preset(${datePreset}){${insightFields}}}}`
    ].join(",");

    const url = `${GRAPH}/act_${META_ACCOUNT}/campaigns?fields=${fields}&limit=50&access_token=${META_TOKEN}`;
    const campRes = await fetch(url);
    const campData = await campRes.json();

    if (!campRes.ok) {
      return NextResponse.json({ error: campData.error?.message || "Failed to fetch campaigns from Meta" }, { status: 400 });
    }

    const campaigns: Record<string, unknown>[] = campData.data || [];

    // Flatten all ads from nested structure
    interface RawAd {
      id: string;
      name: string;
      status: string;
      effective_status: string;
      campaign_name: string;
      creative?: { title?: string; body?: string; call_to_action_type?: string };
      insights?: { data?: Record<string, string>[] };
    }

    const rawAds: RawAd[] = [];
    for (const campaign of campaigns) {
      const adsets = (campaign.adsets as { data?: Record<string, unknown>[] } | undefined)?.data || [];
      for (const adset of adsets) {
        const ads = (adset.ads as { data?: Record<string, unknown>[] } | undefined)?.data || [];
        for (const ad of ads) {
          rawAds.push({
            ...(ad as RawAd),
            campaign_name: campaign.name as string,
          });
        }
      }
    }

    // Apply filter
    const filteredAds = rawAds.filter((ad) => {
      const status = (ad.effective_status || ad.status || "").toUpperCase();
      if (filter === "live") return status === "ACTIVE";
      if (filter === "paused") return status === "PAUSED";
      return status === "ACTIVE" || status === "PAUSED";
    });

    if (!filteredAds.length) {
      return NextResponse.json({
        summary: { total_ads: 0, total_spend: 0, total_impressions: 0, total_clicks: 0, avg_ctr: 0, avg_cpm: 0, avg_cpc: 0 },
        top_performers: [],
        underperformers: [],
        all_ads: [],
        ai_overview: `No ${filter === "both" ? "" : filter + " "}ads found in your Meta account.`,
        key_insights: [],
        top_performer_notes: [],
        underperformer_suggestions: [],
        overall_recommendation: "",
      });
    }

    // Normalise metrics
    interface NormalisedAd {
      id: string;
      name: string;
      status: string;
      campaign_name: string;
      headline: string;
      body: string;
      cta: string;
      spend: number;
      impressions: number;
      clicks: number;
      ctr: number;
      cpc: number;
      cpm: number;
      reach: number;
      frequency: number;
      score?: number;
    }

    const normalisedAds: NormalisedAd[] = filteredAds.map((ad) => {
      const ins = ad.insights?.data?.[0] || {};
      const creative = ad.creative || {};
      return {
        id: ad.id,
        name: ad.name,
        status: (ad.effective_status || ad.status || "").toUpperCase(),
        campaign_name: ad.campaign_name,
        headline: creative.title || "",
        body: creative.body || "",
        cta: creative.call_to_action_type || "",
        spend: parseFloat(ins.spend || "0"),
        impressions: parseInt(ins.impressions || "0", 10),
        clicks: parseInt(ins.inline_link_clicks || "0", 10),
        ctr: parseFloat(ins.inline_link_click_ctr || "0"),
        cpc: parseFloat(ins.cost_per_inline_link_click || "0"),
        cpm: parseFloat(ins.cpm || "0"),
        reach: parseInt(ins.reach || "0", 10),
        frequency: parseFloat(ins.frequency || "0"),
      };
    });

    // Summary
    const totalSpend = normalisedAds.reduce((s, a) => s + a.spend, 0);
    const totalImpressions = normalisedAds.reduce((s, a) => s + a.impressions, 0);
    const totalClicks = normalisedAds.reduce((s, a) => s + a.clicks, 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const adsWithCpm = normalisedAds.filter((a) => a.cpm > 0);
    const avgCpm = adsWithCpm.length > 0 ? adsWithCpm.reduce((s, a) => s + a.cpm, 0) / adsWithCpm.length : 0;
    const adsWithCpc = normalisedAds.filter((a) => a.cpc > 0);
    const avgCpc = adsWithCpc.length > 0 ? adsWithCpc.reduce((s, a) => s + a.cpc, 0) / adsWithCpc.length : 0;

    // Score ads
    const maxCtr = Math.max(...normalisedAds.map((a) => a.ctr), 0.001);
    const maxClicks = Math.max(...normalisedAds.map((a) => a.clicks), 1);
    const minCpc = adsWithCpc.length > 0 ? Math.min(...adsWithCpc.map((a) => a.cpc)) : 1;

    const scoredAds = normalisedAds.map((ad) => {
      const ctrScore = (ad.ctr / maxCtr) * 40;
      const clickScore = (ad.clicks / maxClicks) * 30;
      const cpcScore = ad.cpc > 0 ? Math.min((minCpc / ad.cpc) * 30, 30) : 0;
      const score = Math.round(ctrScore + clickScore + cpcScore);
      return { ...ad, score };
    }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const half = Math.max(1, Math.ceil(scoredAds.length / 2));
    const topPerformers = scoredAds.slice(0, Math.min(3, half));
    const topIds = new Set(topPerformers.map((a) => a.id));
    const underperformers = scoredAds.filter((a) => !topIds.has(a.id)).slice(-Math.min(3, half));

    // OpenAI analysis
    const prompt = `You are a Meta Ads performance analyst. Analyse the following ad data and return a JSON report.

Filter: ${filter} ads | Date range: ${datePreset}${note ? ` | Analyst note: ${note}` : ""}

Account Summary:
- Total ads: ${normalisedAds.length}
- Total spend: $${totalSpend.toFixed(2)}
- Total impressions: ${totalImpressions.toLocaleString()}
- Total clicks: ${totalClicks.toLocaleString()}
- Avg CTR: ${avgCtr.toFixed(2)}%
- Avg CPM: $${avgCpm.toFixed(2)}
- Avg CPC: $${avgCpc.toFixed(2)}

Ads (sorted best→worst):
${JSON.stringify(scoredAds.map(a => ({ id: a.id, name: a.name, score: a.score, ctr: a.ctr, spend: a.spend, clicks: a.clicks, cpc: a.cpc, cpm: a.cpm, headline: a.headline, body: a.body, cta: a.cta })), null, 2)}

Return ONLY a valid JSON object:
{
  "ai_overview": "2-3 sentence executive summary",
  "key_insights": ["insight 1", "insight 2", "insight 3"],
  "top_performer_notes": [
    { "ad_id": "<id>", "ad_name": "<name>", "why_performing": "Why this ad works well" }
  ],
  "underperformer_suggestions": [
    {
      "ad_id": "<id>",
      "ad_name": "<name>",
      "issue": "Main problem",
      "headline_suggestion": "New headline to try",
      "body_suggestion": "New ad body/text to try",
      "cta_suggestion": "e.g. LEARN_MORE",
      "targeting_suggestion": "Audience targeting change",
      "budget_suggestion": "Budget adjustment advice"
    }
  ],
  "overall_recommendation": "1-2 sentence next step"
}`;

    let aiReport: Record<string, unknown> = {};
    try {
      const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
          max_tokens: 2000,
        }),
      });
      const openAiData = await openAiRes.json();
      aiReport = JSON.parse(openAiData.choices?.[0]?.message?.content || "{}");
    } catch {
      aiReport = { ai_overview: "AI analysis unavailable.", key_insights: [], underperformer_suggestions: [], top_performer_notes: [], overall_recommendation: "" };
    }

    return NextResponse.json({
      summary: {
        total_ads: normalisedAds.length,
        total_spend: parseFloat(totalSpend.toFixed(2)),
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        avg_ctr: parseFloat(avgCtr.toFixed(2)),
        avg_cpm: parseFloat(avgCpm.toFixed(2)),
        avg_cpc: parseFloat(avgCpc.toFixed(2)),
      },
      top_performers: topPerformers,
      underperformers,
      all_ads: scoredAds,
      ai_overview: aiReport.ai_overview || "",
      key_insights: (aiReport.key_insights as string[]) || [],
      top_performer_notes: aiReport.top_performer_notes || [],
      underperformer_suggestions: aiReport.underperformer_suggestions || [],
      overall_recommendation: aiReport.overall_recommendation || "",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Report Analysis Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
