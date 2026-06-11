import { NextRequest, NextResponse } from "next/server";

const META_TOKEN = process.env.META_ACCESS_TOKEN!;
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;
const GRAPH = "https://graph.facebook.com/v21.0";

async function metaGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH}/${path}`);
  url.searchParams.set("access_token", META_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `Meta API error on ${path}`);
  return json;
}

async function fetchAllPages(path: string, params: Record<string, string> = {}) {
  const results: Record<string, unknown>[] = [];
  let nextUrl: string | null = null;

  const first = await metaGet(path, params);
  results.push(...(first.data || []));
  nextUrl = first.paging?.next || null;

  while (nextUrl) {
    const res = await fetch(nextUrl);
    const json = await res.json();
    results.push(...(json.data || []));
    nextUrl = json.paging?.next || null;
    if (results.length > 500) break; // safety cap
  }
  return results;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const filter = searchParams.get("filter") || "both"; // live | paused | both
    const note = searchParams.get("note") || "";
    const datePreset = searchParams.get("date_preset") || "last_30d";

    // Effective statuses to include
    const statusFilter: string[] = [];
    if (filter === "live") statusFilter.push("ACTIVE");
    else if (filter === "paused") statusFilter.push("PAUSED");
    else statusFilter.push("ACTIVE", "PAUSED");

    // 1. Fetch campaigns
    const campaigns = await fetchAllPages(`act_${META_ACCOUNT}/campaigns`, {
      fields: "id,name,status,objective,daily_budget,lifetime_budget",
      effective_status: JSON.stringify(statusFilter),
      limit: "100",
    });

    if (!campaigns.length) {
      return NextResponse.json({
        summary: { total_ads: 0, total_spend: 0, total_impressions: 0, total_clicks: 0, avg_ctr: 0, avg_cpm: 0, avg_cpc: 0 },
        top_performers: [],
        underperformers: [],
        all_ads: [],
        ai_overview: "No campaigns found for the selected filter.",
      });
    }

    // 2. Fetch ads with insights + creative for each campaign
    const insightFields = "spend,impressions,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,cpm,reach,frequency";
    const adFields = `id,name,status,effective_status,creative{id,title,body,call_to_action_type},insights.date_preset(${datePreset}){${insightFields}}`;

    const allAds: Record<string, unknown>[] = [];
    for (const campaign of campaigns) {
      const ads = await fetchAllPages(`act_${META_ACCOUNT}/ads`, {
        fields: adFields,
        campaign_id: campaign.id as string,
        effective_status: JSON.stringify(statusFilter),
        limit: "100",
      }).catch(() => []);
      for (const ad of ads) {
        allAds.push({ ...ad, campaign_name: campaign.name, campaign_status: campaign.status });
      }
    }

    if (!allAds.length) {
      return NextResponse.json({
        summary: { total_ads: 0, total_spend: 0, total_impressions: 0, total_clicks: 0, avg_ctr: 0, avg_cpm: 0, avg_cpc: 0 },
        top_performers: [],
        underperformers: [],
        all_ads: [],
        ai_overview: "No ads found for the selected filter.",
      });
    }

    // 3. Normalise metrics
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
    }

    const normalisedAds: NormalisedAd[] = allAds.map((ad) => {
      const ins = (ad.insights as { data?: Record<string, string>[] } | undefined)?.data?.[0] || {};
      const creative = (ad.creative as Record<string, string> | undefined) || {};
      return {
        id: ad.id as string,
        name: ad.name as string,
        status: (ad.effective_status as string) || (ad.status as string),
        campaign_name: ad.campaign_name as string,
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

    // 4. Compute summary
    const totalSpend = normalisedAds.reduce((s, a) => s + a.spend, 0);
    const totalImpressions = normalisedAds.reduce((s, a) => s + a.impressions, 0);
    const totalClicks = normalisedAds.reduce((s, a) => s + a.clicks, 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpm = normalisedAds.length > 0 ? normalisedAds.reduce((s, a) => s + a.cpm, 0) / normalisedAds.length : 0;
    const avgCpc = normalisedAds.filter((a) => a.cpc > 0).length > 0
      ? normalisedAds.filter((a) => a.cpc > 0).reduce((s, a) => s + a.cpc, 0) / normalisedAds.filter((a) => a.cpc > 0).length
      : 0;

    // 5. Score ads (composite: high CTR good, low CPC good, high spend coverage)
    const maxCtr = Math.max(...normalisedAds.map((a) => a.ctr), 0.001);
    const maxClicks = Math.max(...normalisedAds.map((a) => a.clicks), 1);
    const minCpc = Math.min(...normalisedAds.filter((a) => a.cpc > 0).map((a) => a.cpc), 999);

    const scoredAds = normalisedAds.map((ad) => {
      const ctrScore = (ad.ctr / maxCtr) * 40;
      const clickScore = (ad.clicks / maxClicks) * 30;
      const cpcScore = ad.cpc > 0 ? ((minCpc / ad.cpc) * 30) : 0;
      const score = Math.round(ctrScore + clickScore + cpcScore);
      return { ...ad, score };
    }).sort((a, b) => b.score - a.score);

    const topPerformers = scoredAds.slice(0, Math.min(3, Math.ceil(scoredAds.length / 2)));
    const underperformers = scoredAds.slice(-Math.min(3, Math.ceil(scoredAds.length / 2))).filter(
      (a) => !topPerformers.find((t) => t.id === a.id)
    );

    // 6. OpenAI analysis
    const prompt = `You are a Meta Ads performance analyst. Analyse the following ad data and return a JSON report.

Filter applied: ${filter} ads | Date range: ${datePreset}${note ? ` | Analyst note: ${note}` : ""}

Account Summary:
- Total ads: ${normalisedAds.length}
- Total spend: $${totalSpend.toFixed(2)}
- Total impressions: ${totalImpressions.toLocaleString()}
- Total clicks: ${totalClicks.toLocaleString()}
- Avg CTR: ${avgCtr.toFixed(2)}%
- Avg CPM: $${avgCpm.toFixed(2)}
- Avg CPC: $${avgCpc.toFixed(2)}

Ads Data (JSON):
${JSON.stringify(scoredAds, null, 2)}

Return ONLY a valid JSON object with this exact structure:
{
  "ai_overview": "2-3 sentence executive summary of account performance",
  "key_insights": ["insight 1", "insight 2", "insight 3"],
  "top_performer_notes": [
    {
      "ad_id": "<id>",
      "ad_name": "<name>",
      "why_performing": "Short reason why this ad performs well"
    }
  ],
  "underperformer_suggestions": [
    {
      "ad_id": "<id>",
      "ad_name": "<name>",
      "issue": "Main performance issue",
      "headline_suggestion": "Suggested headline text",
      "body_suggestion": "Suggested ad body/description text",
      "cta_suggestion": "Suggested CTA type e.g. LEARN_MORE",
      "targeting_suggestion": "Suggestion for audience targeting change",
      "budget_suggestion": "Suggestion for budget adjustment"
    }
  ],
  "overall_recommendation": "1-2 sentence recommendation on what to do next"
}`;

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 2000,
      }),
    });

    const openAiData = await openAiRes.json();
    let aiReport: Record<string, unknown> = {};
    try {
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
      key_insights: aiReport.key_insights || [],
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
