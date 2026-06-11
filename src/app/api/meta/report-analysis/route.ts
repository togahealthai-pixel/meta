import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TOKEN = process.env.META_ACCESS_TOKEN!;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;
const GRAPH = "https://graph.facebook.com/v21.0";

async function g(path: string, params: Record<string, string> = {}) {
  const u = new URL(`${GRAPH}/${path}`);
  u.searchParams.set("access_token", TOKEN);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u.toString());
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || `Meta error on ${path}`);
  return d;
}

async function allPages(path: string, params: Record<string, string> = {}) {
  const items: Record<string, unknown>[] = [];
  let next: string | null = null;
  const first = await g(path, params);
  items.push(...(first.data || []));
  next = first.paging?.next || null;
  while (next && items.length < 500) {
    const r = await fetch(next);
    const d = await r.json();
    items.push(...(d.data || []));
    next = d.paging?.next || null;
  }
  return items;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const filter = searchParams.get("filter") || "both";
    const note = searchParams.get("note") || "";
    const datePreset = searchParams.get("date_preset") || "last_30d";

    if (!TOKEN || !ACCOUNT) {
      return NextResponse.json({ error: "Missing Meta credentials" }, { status: 500 });
    }

    // ── Step 1: Fetch ALL ads (flat, no nesting issues) ──
    const adsRaw = await allPages(`act_${ACCOUNT}/ads`, {
      fields: "id,name,status,effective_status,campaign_id,adset_id,creative{id,title,body,call_to_action_type,image_url,thumbnail_url,video_id}",
      limit: "200",
    });

    // ── Step 2: Fetch campaigns for name lookup ──
    const campaignsRaw = await allPages(`act_${ACCOUNT}/campaigns`, {
      fields: "id,name,status,effective_status",
      limit: "200",
    });
    const campMap = new Map(campaignsRaw.map((c) => [c.id as string, c.name as string]));

    // ── Step 3: Fetch ad-level insights ──
    const insightFields = "ad_id,ad_name,spend,impressions,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,cpm,cpc,reach,frequency";
    let insightsRaw: Record<string, unknown>[] = [];
    try {
      insightsRaw = await allPages(`act_${ACCOUNT}/insights`, {
        level: "ad",
        fields: insightFields,
        date_preset: datePreset,
        limit: "200",
      });
    } catch {
      // insights may be empty if no spend in period — continue
    }
    const insightMap = new Map(insightsRaw.map((i) => [i.ad_id as string, i]));

    // ── Step 4: Filter by status ──
    const filtered = adsRaw.filter((ad) => {
      const s = ((ad.effective_status || ad.status || "") as string).toUpperCase();
      if (filter === "live") return s === "ACTIVE";
      if (filter === "paused") return s === "PAUSED";
      return ["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"].includes(s);
    });

    if (!filtered.length && adsRaw.length === 0) {
      return NextResponse.json({
        summary: { total_ads: 0, total_spend: 0, total_impressions: 0, total_clicks: 0, avg_ctr: 0, avg_cpm: 0, avg_cpc: 0 },
        top_performers: [], underperformers: [], all_ads: [],
        ai_overview: "No ads found in your Meta account. Make sure your access token has ads_read permission.",
        key_insights: [], top_performer_notes: [], underperformer_suggestions: [], overall_recommendation: "",
      });
    }

    // Use all ads if filter returns none but there are ads (show all statuses)
    const adsToAnalyse = filtered.length > 0 ? filtered : adsRaw;

    // ── Step 5: Fetch Supabase creative data ──
    // Use select("*") so we don't break if optional columns (story) don't exist yet
    interface SbRow {
      id: string;
      text: string;
      story?: string | null;
      Story?: string | null;  // handle capitalised variant
      format: string;
      "json data": string | Record<string, unknown> | null;
      [key: string]: unknown;
    }
    let sbRows: SbRow[] = [];
    try {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data } = await sb
        .from("your_name_table")
        .select("*")
        .order("time", { ascending: false })
        .limit(300);
      sbRows = (data as SbRow[]) || [];
    } catch { /* non-fatal */ }

    // Build Supabase lookup by ad name (most reliable key)
    const sbByName = new Map<string, SbRow>();
    for (const row of sbRows) {
      try {
        const jd = typeof row["json data"] === "string" ? JSON.parse(row["json data"]) : (row["json data"] || {});
        const n = ((jd?.ad?.name || jd?.ads?.[0]?.name || "") as string).toLowerCase().trim();
        if (n) sbByName.set(n, row);
      } catch { /* skip */ }
    }

    // ── Step 6: Normalise ──
    interface Ad {
      id: string;
      name: string;
      status: string;
      campaign_name: string;
      campaign_id: string;
      headline: string;
      body: string;
      cta: string;
      image_url: string;
      media_url: string;  // supabase or meta thumbnail
      story: string;
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

    const ads: Ad[] = adsToAnalyse.map((ad) => {
      const ins = insightMap.get(ad.id as string) || {};
      const creative = (ad.creative as Record<string, unknown>) || {};
      const sbRow = sbByName.get((ad.name as string).toLowerCase().trim());

      let sbJson: Record<string, unknown> = {};
      if (sbRow) {
        try { sbJson = typeof sbRow["json data"] === "string" ? JSON.parse(sbRow["json data"]) : (sbRow["json data"] as Record<string, unknown>) || {}; } catch { /**/ }
      }
      const sbAd = (sbJson?.ad || (sbJson?.ads as unknown[])?.[0] || {}) as Record<string, unknown>;

      return {
        id: ad.id as string,
        name: ad.name as string,
        status: ((ad.effective_status || ad.status || "") as string).toUpperCase(),
        campaign_name: campMap.get(ad.campaign_id as string) || (ad.campaign_id as string) || "",
        campaign_id: ad.campaign_id as string,
        headline: (sbAd.headline as string) || (creative.title as string) || "",
        body: (sbAd.primary_text as string) || (creative.body as string) || "",
        cta: (sbAd.call_to_action_type as string) || (creative.call_to_action_type as string) || "",
        image_url: (creative.image_url as string) || (creative.thumbnail_url as string) || "",
        media_url: sbRow?.text || (creative.thumbnail_url as string) || (creative.image_url as string) || "",
        story: (sbRow?.story || sbRow?.Story || sbRow?.["Story"] || "") as string,
        spend: parseFloat((ins.spend as string) || "0"),
        impressions: parseInt((ins.impressions as string) || "0", 10),
        clicks: parseInt((ins.inline_link_clicks as string) || "0", 10),
        ctr: parseFloat((ins.inline_link_click_ctr as string) || "0"),
        cpc: parseFloat((ins.cost_per_inline_link_click as string) || (ins.cpc as string) || "0"),
        cpm: parseFloat((ins.cpm as string) || "0"),
        reach: parseInt((ins.reach as string) || "0", 10),
        frequency: parseFloat((ins.frequency as string) || "0"),
      };
    });

    // ── Step 7: Summary ──
    const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
    const totalImpressions = ads.reduce((s, a) => s + a.impressions, 0);
    const totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpmAds = ads.filter((a) => a.cpm > 0);
    const avgCpm = cpmAds.length > 0 ? cpmAds.reduce((s, a) => s + a.cpm, 0) / cpmAds.length : 0;
    const cpcAds = ads.filter((a) => a.cpc > 0);
    const avgCpc = cpcAds.length > 0 ? cpcAds.reduce((s, a) => s + a.cpc, 0) / cpcAds.length : 0;

    // ── Step 8: Score ──
    const maxCtr = Math.max(...ads.map((a) => a.ctr), 0.001);
    const maxClicks = Math.max(...ads.map((a) => a.clicks), 1);
    const minCpc = cpcAds.length > 0 ? Math.min(...cpcAds.map((a) => a.cpc)) : 1;

    const scored = ads.map((ad) => ({
      ...ad,
      score: Math.round(
        (ad.ctr / maxCtr) * 40 +
        (ad.clicks / maxClicks) * 30 +
        (ad.cpc > 0 ? Math.min((minCpc / ad.cpc) * 30, 30) : 10)
      ),
    })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const half = Math.max(1, Math.ceil(scored.length / 2));
    const top = scored.slice(0, Math.min(3, half));
    const topIds = new Set(top.map((a) => a.id));
    const under = scored.filter((a) => !topIds.has(a.id)).slice(-Math.min(3, half));

    // ── Step 9: GPT ──
    const gptAds = scored.map((a) => ({
      id: a.id,
      name: a.name,
      score: a.score,
      status: a.status,
      campaign: a.campaign_name,
      headline: a.headline || "(none)",
      body: a.body || "(none)",
      cta: a.cta || "(none)",
      story: a.story || "(none)",
      media_url: a.media_url || "(not linked)",
      metrics: {
        spend: `$${a.spend.toFixed(2)}`,
        impressions: a.impressions,
        clicks: a.clicks,
        ctr: `${a.ctr.toFixed(2)}%`,
        cpc: a.cpc > 0 ? `$${a.cpc.toFixed(2)}` : "N/A",
        cpm: a.cpm > 0 ? `$${a.cpm.toFixed(2)}` : "N/A",
        reach: a.reach,
        frequency: a.frequency.toFixed(2),
      },
    }));

    const prompt = `You are a senior Meta Ads strategist. Analyse all ${scored.length} ads below and return a detailed JSON report.

Context: filter=${filter} | period=${datePreset}${note ? ` | analyst note: ${note}` : ""}

Account totals: spend=$${totalSpend.toFixed(2)} | impressions=${totalImpressions.toLocaleString()} | clicks=${totalClicks.toLocaleString()} | avg_ctr=${avgCtr.toFixed(2)}% | avg_cpm=$${avgCpm.toFixed(2)} | avg_cpc=$${avgCpc.toFixed(2)}

ALL ADS (best → worst by composite score):
${JSON.stringify(gptAds, null, 2)}

Each ad has:
- "headline" / "body": actual ad copy (may be empty if not retrieved)
- "story": creative brief / story angle behind the ad
- "metrics": performance data for the reporting period
- "score": 0–100 composite score (CTR 40% + clicks 30% + CPC efficiency 30%)

Write highly specific suggestions referencing the actual headline/body/story content where available.

Return ONLY valid JSON — no markdown, no extra text:
{
  "ai_overview": "2-3 sentences summarising account health, top opportunity, and biggest issue",
  "key_insights": [
    "Insight referencing specific ad names and numbers",
    "Insight about spend efficiency or audience behaviour",
    "Insight about creative patterns that work vs don't"
  ],
  "top_performer_notes": [
    {
      "ad_id": "<id>",
      "ad_name": "<name>",
      "why_performing": "Specific reason — mention the headline/story/angle if available, explain what's driving the CTR or low CPC"
    }
  ],
  "underperformer_suggestions": [
    {
      "ad_id": "<id>",
      "ad_name": "<name>",
      "issue": "Root cause of poor performance — be specific",
      "headline_suggestion": "Rewritten headline that would resonate better (based on what the ad is about)",
      "body_suggestion": "Rewritten primary text / description",
      "cta_suggestion": "Best CTA enum e.g. LEARN_MORE / SHOP_NOW / BOOK_TRAVEL / SIGN_UP",
      "targeting_suggestion": "Specific audience or placement adjustment",
      "budget_suggestion": "Specific action: pause it / reduce budget to $X/day / reallocate to [top ad name]"
    }
  ],
  "overall_recommendation": "Single most impactful action to take right now, with specific ad name and dollar amount if relevant"
}`;

    let ai: Record<string, unknown> = {};
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 2500,
        }),
      });
      const d = await r.json();
      ai = JSON.parse(d.choices?.[0]?.message?.content || "{}");
    } catch {
      ai = { ai_overview: "AI analysis unavailable.", key_insights: [], underperformer_suggestions: [], top_performer_notes: [], overall_recommendation: "" };
    }

    return NextResponse.json({
      summary: {
        total_ads: ads.length,
        total_spend: parseFloat(totalSpend.toFixed(2)),
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        avg_ctr: parseFloat(avgCtr.toFixed(2)),
        avg_cpm: parseFloat(avgCpm.toFixed(2)),
        avg_cpc: parseFloat(avgCpc.toFixed(2)),
      },
      top_performers: top,
      underperformers: under,
      all_ads: scored,
      ai_overview: (ai.ai_overview as string) || "",
      key_insights: (ai.key_insights as string[]) || [],
      top_performer_notes: ai.top_performer_notes || [],
      underperformer_suggestions: ai.underperformer_suggestions || [],
      overall_recommendation: (ai.overall_recommendation as string) || "",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[report-analysis]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
