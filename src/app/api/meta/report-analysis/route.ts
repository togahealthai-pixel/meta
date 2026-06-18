import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TOKEN = process.env.META_ACCESS_TOKEN!;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
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

async function callOpenAI(prompt: string, maxTokens: number, label: string): Promise<Record<string, unknown>> {
  const errors: string[] = [];
  for (const model of ["gpt-4o", "gpt-4-turbo"]) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: maxTokens,
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 150)}`);
      }
      const d = await r.json();
      const content = d.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response from model");
      return JSON.parse(content);
    } catch (e) {
      errors.push(`[${label}/${model}] ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(errors.join(" | "));
}

// ── Absolute, deterministic score — same ad always gets same score regardless of filter ──
function computeScore(spend: number, impressions: number, clicks: number, ctr: number, cpm: number): number {
  if (impressions === 0 && spend === 0) return 5;
  if (clicks === 0) return impressions > 200 ? 12 : 8;

  let ctrScore: number;
  if (ctr < 0.1)       ctrScore = 15 + (ctr / 0.1) * 10;
  else if (ctr < 0.3)  ctrScore = 25 + ((ctr - 0.1) / 0.2) * 20;
  else if (ctr < 0.7)  ctrScore = 45 + ((ctr - 0.3) / 0.4) * 20;
  else if (ctr < 1.5)  ctrScore = 65 + ((ctr - 0.7) / 0.8) * 15;
  else                  ctrScore = 80 + Math.min(((ctr - 1.5) / 1.5) * 15, 15);

  const clickBonus = Math.min(clicks * 0.5, 10);
  const cpmBonus = cpm > 0 && cpm < 2 ? 5 : cpm >= 2 && cpm < 5 ? 3 : cpm > 12 ? -3 : 0;
  return Math.max(5, Math.min(100, Math.round(ctrScore + clickBonus + cpmBonus)));
}

// ── What is editable in Meta Ads after publishing ──
const META_ADS_CONTEXT = `
## META ADS FUNDAMENTALS

### Auction Mechanics
Total Value = Bid × Estimated Action Rate × Ad Quality.
Higher CTR → higher estimated action rate → cheaper CPM. A 2× CTR improvement often halves CPM.
CTR is the single biggest lever — fix it before touching anything else.

### CTR Benchmarks (Healthcare / Medical Tourism)
  < 0.1%  → hook is completely failing. Rewrite headline first.
  0.1–0.3% → below average. Body or audience needs work.
  0.3–0.7% → average. Optimise CTA and audience.
  0.7–1.5% → good. Scale carefully, watch frequency.
  > 1.5%  → excellent. Double budget, build lookalikes.

### CPM Benchmarks
  < $2 CPM  → very efficient but may need more qualified audience
  $2–6 CPM  → healthy range
  > $10 CPM → audience too narrow or low quality score

### Diagnosis Patterns
  PATTERN A — spend=0, impressions=0:
    Root: ad/campaign/adset is paused or budget=$0. Creative changes are USELESS until delivery is fixed.
    Suggest: delivery fix only (budget + status). NO headline/body/cta suggestions.

  PATTERN B — impressions>200, spend>0, clicks=0, CTR=0%:
    Root: creative hook failing. Audience sees the ad but does not click.
    Suggest: headline rewrite, body rewrite. Use real data from headline/body fields.

  PATTERN C — clicks>0 but CTR<0.3%, high CPC:
    Root: wrong audience or weak body. Creative is partially working.
    Suggest: audience (location/age/interest), placement changes.

  PATTERN D — CTR>0.5% but impressions<500:
    Root: budget or audience too narrow — delivery is starved.
    Suggest: budget increase, audience broadening. NOT a creative problem.

  PATTERN E — decent CTR, CPC high vs account average:
    Root: CTA mismatch or audience not ready for conversion.
    Suggest: softer CTA, audience refinement.

### EDITABLE Parameters After Publishing
These are the ONLY things a user can change after an ad goes live:

AD LEVEL (edit without resetting learning):
  - Headline: change the hook text
  - Primary Text (body): change body copy
  - Description: supporting line below headline
  - CTA Button: LEARN_MORE / GET_QUOTE / BOOK_TRAVEL / CONTACT_US / SIGN_UP / WATCH_MORE
  - Destination URL / UTM parameters
  - Ad Name (no delivery impact)
  NOTE: Editing headline/body loses social proof (likes/comments/shares)
  CANNOT EDIT: ad format (image→video), connected Page, Instagram account

AD SET LEVEL (editing resets learning phase):
  - Budget: daily or lifetime (>20% change resets learning)
  - Location: add/remove countries, cities, radius
  - Age range: min/max age
  - Gender: all / men / women
  - Interests & behaviors
  - Custom audiences / Lookalike audiences
  - Exclusions
  - Placements: Facebook Feed, Instagram Feed, Stories, Reels, Audience Network
  - Bid amount / Cost cap / Bid cap
  - Schedule / Dayparting
  - Attribution window

CAMPAIGN LEVEL:
  - Campaign budget (CBO)
  - Bid strategy
  - Start/end dates
  CANNOT EDIT: Campaign objective, buying type (locked after creation)

### Hook Writing Rules
Scroll-stopping hooks use: specific number | bold question | surprising stat | direct pain.
Good: "5 Canadians cut surgery cost by 70% — here's how" | "Are you overpaying 3× for [procedure]?"
Bad: "We offer..." / "Our clinic provides..." — loses 90% of viewers immediately.

### Creative Mismatch Detection
If the body copy mentions a procedure (e.g. belly fat, liposuction) that does not match the headline
(e.g. hair restoration, rhinoplasty), flag this as CRITICAL MISMATCH — it kills relevance score.
This is the first thing to fix.

### ABSOLUTE ANTI-HALLUCINATION RULES
1. NEVER invent: procedures, prices, countries, clinic names, statistics, or patient stories
   unless they appear VERBATIM in the ad's headline/body/story fields provided in the data.
2. If headline=null AND body=null: output null for all creative suggestions.
   Do NOT guess what the ad might say from its name.
3. NEVER output bracket templates like [amount] or [procedure] as your final suggestion.
   If you cannot write a specific suggestion without invented data, output null for that field.
4. Only use actual numbers from the metrics object. Never round up or exaggerate.
`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const filter     = searchParams.get("filter")      || "both";
    const note       = searchParams.get("note")        || "";
    const datePreset = searchParams.get("date_preset") || "last_30_d";
    const dateFrom   = searchParams.get("date_from");
    const dateTo     = searchParams.get("date_to");
    const campaignId = searchParams.get("campaign_id") || "";

    if (!TOKEN || !ACCOUNT) {
      return NextResponse.json({ error: "Missing Meta credentials" }, { status: 500 });
    }

    const adsRaw = await allPages(`act_${ACCOUNT}/ads`, {
      fields: "id,name,status,effective_status,campaign_id,adset_id,creative{id,title,body,call_to_action_type,image_url,thumbnail_url,video_id}",
      limit: "200",
    });

    const campaignsRaw = await allPages(`act_${ACCOUNT}/campaigns`, {
      fields: "id,name,status,effective_status",
      limit: "200",
    });
    const campMap = new Map(campaignsRaw.map((c) => [c.id as string, c.name as string]));

    const insightFields = "ad_id,ad_name,spend,impressions,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,cpm,cpc,reach,frequency";
    const insightParams: Record<string, string> = { level: "ad", fields: insightFields, limit: "200" };
    if (dateFrom && dateTo) {
      insightParams.time_range = JSON.stringify({ since: dateFrom, until: dateTo });
    } else {
      insightParams.date_preset = datePreset;
    }

    let insightsRaw: Record<string, unknown>[] = [];
    try { insightsRaw = await allPages(`act_${ACCOUNT}/insights`, insightParams); } catch { /**/ }
    const insightMap = new Map(insightsRaw.map((i) => [i.ad_id as string, i]));

    interface SbRow {
      id: string; text: string; story?: string | null; Story?: string | null;
      format: string; "json data": string | Record<string, unknown> | null; [key: string]: unknown;
    }
    let sbRows: SbRow[] = [];
    try {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data } = await sb.from("your_name_table").select("*").order("time", { ascending: false }).limit(300);
      sbRows = (data as SbRow[]) || [];
    } catch { /**/ }

    const sbByName = new Map<string, SbRow>();
    for (const row of sbRows) {
      try {
        const jd = typeof row["json data"] === "string" ? JSON.parse(row["json data"]) : (row["json data"] || {});
        const n = ((jd?.ad?.name || jd?.ads?.[0]?.name || "") as string).toLowerCase().trim();
        if (n) sbByName.set(n, row);
      } catch { /**/ }
    }

    interface Ad {
      id: string; name: string; status: string; campaign_name: string; campaign_id: string;
      headline: string; body: string; cta: string; image_url: string; media_url: string;
      story: string; spend: number; impressions: number; clicks: number; ctr: number;
      cpc: number; cpm: number; reach: number; frequency: number; score: number;
    }

    const VALID_STATUSES = ["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"];

    const allNormalized: Ad[] = adsRaw
      .filter((ad) => VALID_STATUSES.includes(((ad.effective_status || ad.status || "") as string).toUpperCase()))
      .map((ad) => {
        const ins = insightMap.get(ad.id as string) || {};
        const creative = (ad.creative as Record<string, unknown>) || {};
        const sbRow = sbByName.get((ad.name as string).toLowerCase().trim());
        let sbJson: Record<string, unknown> = {};
        if (sbRow) {
          try { sbJson = typeof sbRow["json data"] === "string" ? JSON.parse(sbRow["json data"]) : (sbRow["json data"] as Record<string, unknown>) || {}; } catch { /**/ }
        }
        const sbAd = (sbJson?.ad || (sbJson?.ads as unknown[])?.[0] || {}) as Record<string, unknown>;

        const spend       = parseFloat((ins.spend as string) || "0");
        const impressions = parseInt((ins.impressions as string) || "0", 10);
        const clicks      = parseInt((ins.inline_link_clicks as string) || "0", 10);
        const ctr         = parseFloat((ins.inline_link_click_ctr as string) || "0");
        const cpm         = parseFloat((ins.cpm as string) || "0");
        const cpc         = parseFloat((ins.cost_per_inline_link_click as string) || (ins.cpc as string) || "0");

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
          story: (sbRow?.story || sbRow?.Story || "") as string,
          spend, impressions, clicks, ctr, cpc, cpm,
          reach: parseInt((ins.reach as string) || "0", 10),
          frequency: parseFloat((ins.frequency as string) || "0"),
          score: computeScore(spend, impressions, clicks, ctr, cpm),
        };
      });

    const adsToDisplay = allNormalized.filter((ad) => {
      if (filter === "live"   && ad.status !== "ACTIVE") return false;
      if (filter === "paused" && !["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"].includes(ad.status)) return false;
      if (campaignId && ad.campaign_id !== campaignId) return false;
      return true;
    });

    if (adsToDisplay.length === 0) {
      const msg = filter === "live" ? "No active ads found." : filter === "paused" ? "No paused ads found." : "No ads found.";
      return NextResponse.json({
        summary: { total_ads: 0, total_spend: 0, total_impressions: 0, total_clicks: 0, avg_ctr: 0, avg_cpm: 0, avg_cpc: 0 },
        top_performers: [], underperformers: [], all_ads: [],
        ai_overview: msg, key_insights: [], top_performer_notes: [], underperformer_suggestions: [], overall_recommendation: "",
        has_strong_performers: false,
      });
    }

    const sorted = [...adsToDisplay].sort((a, b) => b.score - a.score);

    // Top performers: ONLY if score >= 40. If none qualify, show empty section.
    const qualifiedTop = sorted.filter((a) => a.score >= 40).slice(0, 3);
    const hasStrongPerformers = qualifiedTop.length > 0;
    const topPerformers = qualifiedTop;
    const topIds = new Set(topPerformers.map((a) => a.id));
    const underperformers = sorted.filter((a) => !topIds.has(a.id));

    const totalSpend       = adsToDisplay.reduce((s, a) => s + a.spend, 0);
    const totalImpressions = adsToDisplay.reduce((s, a) => s + a.impressions, 0);
    const totalClicks      = adsToDisplay.reduce((s, a) => s + a.clicks, 0);
    const avgCtr           = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpmAds           = adsToDisplay.filter((a) => a.cpm > 0);
    const avgCpm           = cpmAds.length > 0 ? cpmAds.reduce((s, a) => s + a.cpm, 0) / cpmAds.length : 0;
    const cpcAds           = adsToDisplay.filter((a) => a.cpc > 0);
    const avgCpc           = cpcAds.length > 0 ? cpcAds.reduce((s, a) => s + a.cpc, 0) / cpcAds.length : 0;

    const gptData = sorted.map((a) => ({
      id: a.id,
      name: a.name,
      score: a.score,
      classification: topIds.has(a.id) ? "top_performer" : "underperformer",
      status: a.status,
      campaign: a.campaign_name,
      headline: a.headline || null,
      body: a.body || null,
      cta: a.cta || null,
      story: a.story || null,
      has_creative_data: !!(a.headline || a.body),
      metrics: {
        spend: parseFloat(a.spend.toFixed(2)),
        impressions: a.impressions,
        clicks: a.clicks,
        ctr_pct: parseFloat(a.ctr.toFixed(4)),
        cpc: a.cpc > 0 ? parseFloat(a.cpc.toFixed(2)) : null,
        cpm: a.cpm > 0 ? parseFloat(a.cpm.toFixed(2)) : null,
        reach: a.reach,
        frequency: parseFloat(a.frequency.toFixed(2)),
      },
    }));

    function ruleBasedAnalysis(): Record<string, unknown> {
      const best = sorted[0];
      const overview = `${adsToDisplay.length} ads analysed. Total spend $${totalSpend.toFixed(2)}, ${totalImpressions.toLocaleString()} impressions, ${totalClicks} clicks, avg CTR ${avgCtr.toFixed(2)}%. ${hasStrongPerformers ? `"${best.name}" leads with CTR ${best.ctr.toFixed(2)}%.` : "No ad has reached a score of 40 — all need improvement before scaling budget."}`;
      const insights = [
        hasStrongPerformers
          ? `"${best.name}" achieves CTR ${best.ctr.toFixed(2)}% with CPM $${best.cpm.toFixed(2)} — concentrate budget here.`
          : "No ad is generating reliable clicks. All need hook rewrites before scaling.",
        `${underperformers.filter((a) => a.spend === 0 && a.impressions === 0).length} ads have never served — check campaign status and budget before editing copy.`,
        avgCtr < 0.3
          ? "Average CTR is below 0.3%. The first line/frame of every ad needs a stronger hook."
          : "CTR is at benchmark — scale top performers.",
      ];
      const topNotes = topPerformers.map((a) => ({
        ad_id: a.id, ad_name: a.name,
        why_performing: `CTR ${a.ctr.toFixed(2)}%, CPM $${a.cpm.toFixed(2)}, ${a.clicks} clicks. ${a.headline ? `Headline "${a.headline.slice(0, 60)}" is resonating.` : ""} Increase budget to $15–20/day.`,
      }));
      const underSugg = underperformers.map((a) => {
        const noDelivery = a.impressions === 0 && a.spend === 0;
        const zeroClick = a.ctr === 0 && a.spend > 0 && a.impressions > 0;
        return {
          ad_id: a.id, ad_name: a.name,
          pattern: noDelivery ? "A" : zeroClick ? "B" : "C",
          issue: noDelivery
            ? `Ad has never served ($0 spend, 0 impressions). Campaign is paused or budget is $0. Fix delivery first — creative changes are useless until the ad runs.`
            : zeroClick
            ? `Spent $${a.spend.toFixed(2)} with ${a.impressions.toLocaleString()} impressions and 0 clicks. The hook is not stopping the scroll.`
            : `CTR ${a.ctr.toFixed(2)}% with ${a.clicks} clicks — below benchmark. Audience match or body copy needs improvement.`,
          headline_suggestion: noDelivery ? null : (zeroClick && a.headline ? `Current headline: "${a.headline.slice(0, 80)}" — open with a specific number or question instead.` : null),
          body_suggestion: noDelivery ? null : (zeroClick && a.body ? `Current: "${a.body.slice(0, 60)}..." — lead with the transformation result, not the service description.` : null),
          cta_suggestion: noDelivery ? null : (a.cta === "CONTACT_US" ? "Change to LEARN_MORE — lower friction for cold audiences" : null),
          location_suggestion: noDelivery ? null : "Confirm geo targets Canada only if copy references Canadian pricing.",
          age_gender_suggestion: noDelivery ? null : null,
          placement_suggestion: noDelivery ? null : (zeroClick ? "Restrict to Facebook Feed + Instagram Feed only — remove Stories/Reels until CTR improves." : null),
          bid_strategy_suggestion: null,
          targeting_suggestion: noDelivery ? "Once active: use Advantage+ audience, Feed placement, $5/day minimum." : (!zeroClick ? "Switch to 1% lookalike of website visitors or video viewers." : null),
          budget_suggestion: noDelivery
            ? "Set minimum $5/day and activate the campaign. Evaluate creative after 500 impressions."
            : `Pause. Redirect budget to "${topPerformers[0]?.name || "top performer"}" while fixing the hook.`,
          url_suggestion: null,
        };
      });
      return {
        ai_overview: overview, key_insights: insights,
        top_performer_notes: topNotes, underperformer_suggestions: underSugg,
        overall_recommendation: hasStrongPerformers
          ? `Increase "${best.name}" budget to $15–20/day immediately. Pause all zero-CTR ads and apply the hook rewrites above before reactivating at $5/day each.`
          : "No ad is generating reliable clicks. Apply hook rewrites to all ads, set $5/day each, measure CTR after 500 impressions before deciding which to scale.",
      };
    }

    const analysisPrompt = `${META_ADS_CONTEXT}

---
## YOUR TASK

Analyse this Meta Ads account (medical tourism / healthcare brand).
Ads have been scored by a deterministic formula. DO NOT change scores or classifications.
Write analysis text and suggestions only.

Filter: ${filter} | Period: ${datePreset} | Analyst note: ${note || "none"}
Account totals: spend=$${totalSpend.toFixed(2)} | impressions=${totalImpressions.toLocaleString()} | clicks=${totalClicks} | avg_ctr=${avgCtr.toFixed(4)}% | avg_cpm=$${avgCpm.toFixed(2)}

ADS DATA:
${JSON.stringify(gptData, null, 2)}

---
## RULES PER SUGGESTION FIELD

For each underperformer, use ONLY the fields relevant to its diagnosis pattern:

PATTERN A (spend=0, impressions=0 — never served):
  → issue, targeting_suggestion, budget_suggestion ONLY
  → headline/body/cta/location/placement/bid_strategy/url = null
  → DO NOT suggest creative changes for an ad that has never run

PATTERN B (impressions>0, clicks=0, CTR=0% — hook failing):
  → issue, headline_suggestion, body_suggestion, placement_suggestion, budget_suggestion
  → ONLY rewrite headline/body if has_creative_data=true (real data exists)
  → If has_creative_data=false: headline_suggestion=null, body_suggestion=null
  → Check for creative mismatch: if body mentions a different procedure than headline, flag as CRITICAL MISMATCH

PATTERN C (clicks>0, CTR<0.3% — audience/relevance problem):
  → issue, location_suggestion, age_gender_suggestion, targeting_suggestion, cta_suggestion
  → headline/body = null (creative is partially working)

PATTERN D (CTR>0.5%, impressions<500 — delivery starved):
  → issue, budget_suggestion, targeting_suggestion only

PATTERN E (decent CTR, high CPC):
  → issue, cta_suggestion, bid_strategy_suggestion, targeting_suggestion

ANTI-HALLUCINATION — ABSOLUTE RULES:
1. If headline=null AND body=null → all creative fields (headline_suggestion, body_suggestion) = null. PERIOD.
2. DO NOT read the ad name and invent what the headline/body might say.
3. DO NOT output bracket placeholders like [amount] or [procedure] as final suggestions — output null instead.
4. Every metric you reference must come from the metrics object. No rounding up.

---
## REQUIRED JSON

{
  "ai_overview": "2–3 sentences using real numbers: total spend, avg CTR, biggest single opportunity",
  "key_insights": [
    "insight with real ad name and metric",
    "why top performer outperforms — actual CTR/CPM numbers",
    "shared problem across underperformers"
  ],
  "top_performer_notes": [
    {
      "ad_id": "<id>",
      "ad_name": "<name>",
      "why_performing": "specific CTR %, clicks, CPM — reference actual headline if available"
    }
  ],
  "underperformer_suggestions": [
    {
      "ad_id": "<id>",
      "ad_name": "<name>",
      "pattern": "A|B|C|D|E",
      "issue": "Root cause with actual numbers from metrics",
      "headline_suggestion": "<rewrite using real headline data OR null>",
      "body_suggestion": "<rewrite using real body data OR null>",
      "cta_suggestion": "<LEARN_MORE|GET_QUOTE|BOOK_TRAVEL|CONTACT_US|SIGN_UP|WATCH_MORE OR null>",
      "location_suggestion": "<specific geo action OR null>",
      "age_gender_suggestion": "<specific demographic action OR null>",
      "placement_suggestion": "<specific placement action OR null>",
      "bid_strategy_suggestion": "<specific bid action OR null>",
      "targeting_suggestion": "<audience action OR null>",
      "budget_suggestion": "<concrete $ action OR null>",
      "url_suggestion": "<UTM or URL fix OR null>"
    }
  ],
  "overall_recommendation": "single highest-ROI action with specific ad name and exact $ move"
}

HARD RULES:
- top_performer_notes: exactly ${topPerformers.length} entries
- underperformer_suggestions: exactly ${underperformers.length} entries
- null fields are correct — only fill if it directly addresses the pattern's root cause
- never invent data not present in the ads data above`;

    let ai: Record<string, unknown> = {};
    let aiError = "";

    if (OPENAI_KEY) {
      try {
        ai = await callOpenAI(analysisPrompt, 4500, "analysis");
      } catch (e) {
        aiError = `GPT failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    } else {
      aiError = "OPENAI_API_KEY not configured — using rule-based analysis";
    }

    if (!ai.ai_overview) {
      ai = ruleBasedAnalysis();
      if (aiError) aiError += " (rule-based fallback applied)";
    }

    // Patch any missing underperformer suggestions
    const existingSuggIds = new Set(
      (ai.underperformer_suggestions as Array<{ ad_id: string }> || []).map((s) => s.ad_id)
    );
    const missedUnder = underperformers.filter((a) => !existingSuggIds.has(a.id));
    if (missedUnder.length > 0) {
      const fbSugg = (ruleBasedAnalysis().underperformer_suggestions as Array<{ ad_id: string }> || []);
      const fbMap = new Map(fbSugg.map((s) => [s.ad_id, s]));
      ai.underperformer_suggestions = [
        ...(ai.underperformer_suggestions as unknown[] || []),
        ...missedUnder.map((a) => fbMap.get(a.id)).filter(Boolean),
      ];
    }

    return NextResponse.json({
      summary: {
        total_ads: adsToDisplay.length,
        total_spend: parseFloat(totalSpend.toFixed(2)),
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        avg_ctr: parseFloat(avgCtr.toFixed(2)),
        avg_cpm: parseFloat(avgCpm.toFixed(2)),
        avg_cpc: parseFloat(avgCpc.toFixed(2)),
      },
      top_performers: topPerformers,
      underperformers,
      all_ads: sorted,
      has_strong_performers: hasStrongPerformers,
      ai_overview: (ai.ai_overview as string) || "",
      key_insights: (ai.key_insights as string[]) || [],
      top_performer_notes: (ai.top_performer_notes as unknown[]) || [],
      underperformer_suggestions: (ai.underperformer_suggestions as unknown[]) || [],
      overall_recommendation: (ai.overall_recommendation as string) || "",
      ai_error: aiError,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
