import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const META_TOKEN = process.env.META_ACCESS_TOKEN!;
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;
const GRAPH = "https://graph.facebook.com/v21.0";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const filter = searchParams.get("filter") || "both";
    const note = searchParams.get("note") || "";
    const datePreset = searchParams.get("date_preset") || "last_30d";

    if (!META_TOKEN || !META_ACCOUNT) {
      return NextResponse.json({ error: "Missing Meta credentials" }, { status: 500 });
    }

    // ── 1. Fetch all campaigns + nested ads + insights from Meta ──
    const insightFields = "spend,impressions,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,cpm,reach,frequency";
    const fields = [
      "id", "name", "status", "effective_status",
      `adsets{id,name,status,effective_status,ads{id,name,status,effective_status,creative{id,title,body,call_to_action_type},insights.date_preset(${datePreset}){${insightFields}}}}`
    ].join(",");

    const campRes = await fetch(`${GRAPH}/act_${META_ACCOUNT}/campaigns?fields=${fields}&limit=50&access_token=${META_TOKEN}`);
    const campData = await campRes.json();

    if (!campRes.ok) {
      return NextResponse.json({ error: campData.error?.message || "Failed to fetch campaigns from Meta" }, { status: 400 });
    }

    // ── 2. Flatten ads ──
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
    for (const campaign of (campData.data || []) as Record<string, unknown>[]) {
      const adsets = (campaign.adsets as { data?: Record<string, unknown>[] } | undefined)?.data || [];
      for (const adset of adsets) {
        const ads = (adset.ads as { data?: Record<string, unknown>[] } | undefined)?.data || [];
        for (const ad of ads) {
          rawAds.push({ ...(ad as unknown as RawAd), campaign_name: campaign.name as string });
        }
      }
    }

    // ── 3. Filter by live/paused/both ──
    const filteredAds = rawAds.filter((ad) => {
      const s = (ad.effective_status || ad.status || "").toUpperCase();
      if (filter === "live") return s === "ACTIVE";
      if (filter === "paused") return s === "PAUSED";
      return s === "ACTIVE" || s === "PAUSED";
    });

    if (!filteredAds.length) {
      return NextResponse.json({
        summary: { total_ads: 0, total_spend: 0, total_impressions: 0, total_clicks: 0, avg_ctr: 0, avg_cpm: 0, avg_cpc: 0 },
        top_performers: [], underperformers: [], all_ads: [],
        ai_overview: `No ${filter === "both" ? "" : filter + " "}ads found in your Meta account.`,
        key_insights: [], top_performer_notes: [], underperformer_suggestions: [], overall_recommendation: "",
      });
    }

    // ── 4. Fetch Supabase your_name_table (story + json data + text URL) ──
    interface SbRow {
      id: string;
      text: string;        // Supabase storage public URL (video/image)
      story: string | null; // story text or second URL
      format: string;
      Approved: string;
      "json data": string | Record<string, unknown> | null;
    }

    let sbRows: SbRow[] = [];
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from("your_name_table")
        .select(`id, text, story, format, "Approved", "json data"`)
        .order("time", { ascending: false })
        .limit(200);
      sbRows = (data as SbRow[]) || [];
    } catch {
      // Non-fatal — continue without Supabase enrichment
    }

    // Build lookup: meta ad id → supabase row
    // json data has structure: { ad: { id, name, headline, primary_text, call_to_action_type } }
    const sbByAdId = new Map<string, SbRow>();
    const sbByAdName = new Map<string, SbRow>();
    for (const row of sbRows) {
      try {
        const jd = typeof row["json data"] === "string"
          ? JSON.parse(row["json data"])
          : (row["json data"] || {});
        const adId = jd?.ad?.id || jd?.ads?.[0]?.id;
        const adName = jd?.ad?.name || jd?.ads?.[0]?.name;
        if (adId) sbByAdId.set(String(adId), row);
        if (adName) sbByAdName.set(String(adName).toLowerCase(), row);
      } catch { /* skip malformed rows */ }
    }

    // ── 5. Normalise + enrich with Supabase data ──
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
      media_url: string;
      story: string;
      score?: number;
    }

    const normalisedAds: NormalisedAd[] = filteredAds.map((ad) => {
      const ins = ad.insights?.data?.[0] || {};
      const creative = ad.creative || {};

      // Try to find matching Supabase row
      const sbRow = sbByAdId.get(ad.id) || sbByAdName.get(ad.name.toLowerCase());
      let sbJson: Record<string, unknown> = {};
      if (sbRow) {
        try {
          sbJson = typeof sbRow["json data"] === "string"
            ? JSON.parse(sbRow["json data"])
            : (sbRow["json data"] as Record<string, unknown>) || {};
        } catch { /* skip */ }
      }

      const sbAd = (sbJson?.ad || (sbJson?.ads as unknown[])?.[0] || {}) as Record<string, unknown>;

      return {
        id: ad.id,
        name: ad.name,
        status: (ad.effective_status || ad.status || "").toUpperCase(),
        campaign_name: ad.campaign_name,
        headline: (sbAd.headline as string) || creative.title || "",
        body: (sbAd.primary_text as string) || creative.body || "",
        cta: (sbAd.call_to_action_type as string) || creative.call_to_action_type || "",
        spend: parseFloat(ins.spend || "0"),
        impressions: parseInt(ins.impressions || "0", 10),
        clicks: parseInt(ins.inline_link_clicks || "0", 10),
        ctr: parseFloat(ins.inline_link_click_ctr || "0"),
        cpc: parseFloat(ins.cost_per_inline_link_click || "0"),
        cpm: parseFloat(ins.cpm || "0"),
        reach: parseInt(ins.reach || "0", 10),
        frequency: parseFloat(ins.frequency || "0"),
        media_url: sbRow?.text || "",
        story: sbRow?.story || "",
      };
    });

    // ── 6. Summary ──
    const totalSpend = normalisedAds.reduce((s, a) => s + a.spend, 0);
    const totalImpressions = normalisedAds.reduce((s, a) => s + a.impressions, 0);
    const totalClicks = normalisedAds.reduce((s, a) => s + a.clicks, 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const adsWithCpm = normalisedAds.filter((a) => a.cpm > 0);
    const avgCpm = adsWithCpm.length > 0 ? adsWithCpm.reduce((s, a) => s + a.cpm, 0) / adsWithCpm.length : 0;
    const adsWithCpc = normalisedAds.filter((a) => a.cpc > 0);
    const avgCpc = adsWithCpc.length > 0 ? adsWithCpc.reduce((s, a) => s + a.cpc, 0) / adsWithCpc.length : 0;

    // ── 7. Score ads ──
    const maxCtr = Math.max(...normalisedAds.map((a) => a.ctr), 0.001);
    const maxClicks = Math.max(...normalisedAds.map((a) => a.clicks), 1);
    const minCpc = adsWithCpc.length > 0 ? Math.min(...adsWithCpc.map((a) => a.cpc)) : 1;

    const scoredAds = normalisedAds.map((ad) => ({
      ...ad,
      score: Math.round(
        (ad.ctr / maxCtr) * 40 +
        (ad.clicks / maxClicks) * 30 +
        (ad.cpc > 0 ? Math.min((minCpc / ad.cpc) * 30, 30) : 0)
      ),
    })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const half = Math.max(1, Math.ceil(scoredAds.length / 2));
    const topPerformers = scoredAds.slice(0, Math.min(3, half));
    const topIds = new Set(topPerformers.map((a) => a.id));
    const underperformers = scoredAds.filter((a) => !topIds.has(a.id)).slice(-Math.min(3, half));

    // ── 8. OpenAI — enriched prompt with creative content ──
    const adsForGpt = scoredAds.map((a) => ({
      id: a.id,
      name: a.name,
      score: a.score,
      status: a.status,
      campaign: a.campaign_name,
      headline: a.headline,
      body: a.body,
      cta: a.cta,
      media_url: a.media_url || "(not linked)",
      story: a.story || "(none)",
      metrics: {
        spend: a.spend,
        impressions: a.impressions,
        clicks: a.clicks,
        ctr: `${a.ctr.toFixed(2)}%`,
        cpc: a.cpc > 0 ? `$${a.cpc.toFixed(2)}` : "N/A",
        cpm: a.cpm > 0 ? `$${a.cpm.toFixed(2)}` : "N/A",
        reach: a.reach,
        frequency: a.frequency,
      },
    }));

    const prompt = `You are a senior Meta Ads performance analyst. Analyse the ad data below and return a detailed JSON report.

Context: Filter=${filter} | Date range=${datePreset}${note ? ` | Note from analyst: ${note}` : ""}

Account Summary:
- Total ads: ${normalisedAds.length}
- Total spend: $${totalSpend.toFixed(2)}
- Impressions: ${totalImpressions.toLocaleString()} | Clicks: ${totalClicks.toLocaleString()}
- Avg CTR: ${avgCtr.toFixed(2)}% | Avg CPM: $${avgCpm.toFixed(2)} | Avg CPC: $${avgCpc.toFixed(2)}

Ads (sorted best → worst by composite score):
${JSON.stringify(adsForGpt, null, 2)}

Each ad may include:
- "headline" / "body": the actual ad copy used
- "story": the ad concept/story brief
- "media_url": direct link to the video or image used in this ad

Use all available creative data (headline, body, story, CTA) to give specific, actionable suggestions.

Return ONLY valid JSON:
{
  "ai_overview": "2-3 sentence executive summary of account health and spend efficiency",
  "key_insights": ["insight 1", "insight 2", "insight 3"],
  "top_performer_notes": [
    {
      "ad_id": "<id>",
      "ad_name": "<name>",
      "why_performing": "Specific reason this ad works — reference its actual headline/copy/story if available"
    }
  ],
  "underperformer_suggestions": [
    {
      "ad_id": "<id>",
      "ad_name": "<name>",
      "issue": "Specific problem causing poor performance",
      "headline_suggestion": "Rewritten headline based on what the ad is actually about",
      "body_suggestion": "Rewritten ad body/primary text",
      "cta_suggestion": "Best CTA type e.g. LEARN_MORE",
      "targeting_suggestion": "Specific audience targeting change",
      "budget_suggestion": "Specific budget action: pause, reduce, scale, or reallocate"
    }
  ],
  "overall_recommendation": "1-2 sentence top priority action right now"
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
          max_tokens: 2500,
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
