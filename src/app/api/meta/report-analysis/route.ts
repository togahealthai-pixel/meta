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
          temperature: 0.25,
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
// Based only on the ad's own metrics, no comparison to other ads.
function computeScore(spend: number, impressions: number, clicks: number, ctr: number, cpm: number): number {
  // Never served
  if (impressions === 0 && spend === 0) return 5;
  // Served but zero engagement
  if (clicks === 0) return impressions > 200 ? 12 : 8;

  // CTR-based base score (absolute thresholds)
  let ctrScore: number;
  if (ctr < 0.1)       ctrScore = 15 + (ctr / 0.1) * 10;                        // 15–25
  else if (ctr < 0.3)  ctrScore = 25 + ((ctr - 0.1) / 0.2) * 20;               // 25–45
  else if (ctr < 0.7)  ctrScore = 45 + ((ctr - 0.3) / 0.4) * 20;               // 45–65
  else if (ctr < 1.5)  ctrScore = 65 + ((ctr - 0.7) / 0.8) * 15;               // 65–80
  else                  ctrScore = 80 + Math.min(((ctr - 1.5) / 1.5) * 15, 15); // 80–95

  // Click volume bonus: up to +10
  const clickBonus = Math.min(clicks * 0.5, 10);

  // CPM efficiency bonus: ±5
  const cpmBonus = cpm > 0 && cpm < 2 ? 5 : cpm >= 2 && cpm < 5 ? 3 : cpm > 12 ? -3 : 0;

  return Math.max(5, Math.min(100, Math.round(ctrScore + clickBonus + cpmBonus)));
}

// ─────────────────────────────────────────────
// Deep Meta Ads context for GPT text analysis
// ─────────────────────────────────────────────
const META_ADS_CONTEXT = `
## META ADS FUNDAMENTALS

### The Auction
Facebook runs a real-time auction for every impression:
  Total Value = Bid × Estimated Action Rate × Ad Quality
Higher CTR → higher estimated action rate → wins more auctions → lower effective CPM.
A 2× CTR improvement often halves CPM — CTR is the #1 lever.

### CTR Benchmarks (Healthcare / Medical Tourism)
  < 0.1%  CTR → poor. Hook is not stopping the scroll.
  0.1–0.3% CTR → below average. Hook needs improvement.
  0.3–0.7% CTR → average. Optimise copy and audience.
  0.7–1.5% CTR → good. Scale carefully, watch frequency.
  > 1.5%  CTR → excellent. Double budget, build lookalikes.

### CPM Benchmarks (Healthcare)
  < $3 CPM  → efficient delivery. May need more qualified targeting.
  $3–8 CPM  → healthy range.
  > $12 CPM → audience too narrow or low quality ranking.

### Diagnosing by Metric Pattern
  PATTERN A — spend=0, impressions=0:
    Root cause: campaign/ad set is paused OR budget is $0 OR ad is disapproved.
    Fix: check campaign status and budget FIRST. Copy rewrites are meaningless until the ad runs.

  PATTERN B — impressions>0, spend>0, clicks=0, CTR=0%:
    Root cause: creative hook is failing in first 3 seconds (video) or thumb-stop (image).
    Fix: rewrite the headline/hook. The audience IS seeing the ad but scrolling past.

  PATTERN C — clicks>0 but CTR below average, high CPC:
    Root cause: wrong audience (low relevance) or weak body copy.
    Fix: tighten targeting + strengthen CTA / body.

  PATTERN D — decent CTR but low total impressions:
    Root cause: budget too low or audience too narrow — delivery is starved.
    Fix: increase budget or broaden audience. NOT a creative problem.

  PATTERN E — decent CTR, high CPC relative to account:
    Root cause: CTA mismatch or audience not ready for direct conversion.
    Fix: soften the ask (LEARN_MORE vs BOOK_TRAVEL) or tighten lookalike.

### What Moves Results (priority order)
  1. Hook / First Line — 80% of CTR is the first sentence or first 3 seconds
  2. Audience Match — wrong audience = no clicks regardless of creative
  3. Budget — minimum $5–10/day to exit learning phase
  4. CTA Alignment — mismatch between ad promise and button creates friction
  5. Bid Strategy — only matters after CTR and audience are optimised

### Hook Writing (use when suggesting rewrites)
  Scroll-stopping hooks use: specific number | bold question | surprising stat | direct pain
  Examples: "5 Canadians cut surgery cost by 70% doing this" | "Are you paying 3× too much?"
  Avoid: "We offer..." / "Our clinic provides..." — lose 90% of viewers immediately.

### Anti-Hallucination Rule
  NEVER invent: specific procedures, prices, countries, clinic names, or statistics
  unless they appear in the ad's headline/body/story data.
  When data is null → use structural templates in [square brackets]:
  e.g. "[Open with: 'X patients saved [amount] on [procedure] — here's how']"
`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const filter     = searchParams.get("filter")      || "both";
    const note       = searchParams.get("note")        || "";
    const datePreset = searchParams.get("date_preset") || "last_30_d";
    const dateFrom   = searchParams.get("date_from");   // custom range start (YYYY-MM-DD)
    const dateTo     = searchParams.get("date_to");     // custom range end   (YYYY-MM-DD)
    const campaignId = searchParams.get("campaign_id") || ""; // filter to specific campaign

    if (!TOKEN || !ACCOUNT) {
      return NextResponse.json({ error: "Missing Meta credentials" }, { status: 500 });
    }

    // ── Fetch ALL ads (status filter applied later, after scoring) ──
    const adsRaw = await allPages(`act_${ACCOUNT}/ads`, {
      fields: "id,name,status,effective_status,campaign_id,adset_id,creative{id,title,body,call_to_action_type,image_url,thumbnail_url,video_id}",
      limit: "200",
    });

    const campaignsRaw = await allPages(`act_${ACCOUNT}/campaigns`, {
      fields: "id,name,status,effective_status",
      limit: "200",
    });
    const campMap = new Map(campaignsRaw.map((c) => [c.id as string, c.name as string]));

    // ── Insights: use custom time_range if provided, else date_preset ──
    const insightFields = "ad_id,ad_name,spend,impressions,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,cpm,cpc,reach,frequency";
    const insightParams: Record<string, string> = {
      level: "ad", fields: insightFields, limit: "200",
    };
    if (dateFrom && dateTo) {
      insightParams.time_range = JSON.stringify({ since: dateFrom, until: dateTo });
    } else {
      insightParams.date_preset = datePreset;
    }

    let insightsRaw: Record<string, unknown>[] = [];
    try {
      insightsRaw = await allPages(`act_${ACCOUNT}/insights`, insightParams);
    } catch { /* no spend in period */ }
    const insightMap = new Map(insightsRaw.map((i) => [i.ad_id as string, i]));

    // ── Supabase creative data ──
    interface SbRow {
      id: string; text: string; story?: string | null; Story?: string | null;
      format: string; "json data": string | Record<string, unknown> | null; [key: string]: unknown;
    }
    let sbRows: SbRow[] = [];
    try {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data } = await sb.from("your_name_table").select("*").order("time", { ascending: false }).limit(300);
      sbRows = (data as SbRow[]) || [];
    } catch { /* non-fatal */ }

    const sbByName = new Map<string, SbRow>();
    for (const row of sbRows) {
      try {
        const jd = typeof row["json data"] === "string" ? JSON.parse(row["json data"]) : (row["json data"] || {});
        const n = ((jd?.ad?.name || jd?.ads?.[0]?.name || "") as string).toLowerCase().trim();
        if (n) sbByName.set(n, row);
      } catch { /**/ }
    }

    // ── Normalise and score ALL ads upfront ──
    // Filter to recognised statuses, then score every ad with the absolute formula.
    // The filter param is applied AFTER scoring so scores never change between views.
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

        const spend      = parseFloat((ins.spend as string) || "0");
        const impressions = parseInt((ins.impressions as string) || "0", 10);
        const clicks     = parseInt((ins.inline_link_clicks as string) || "0", 10);
        const ctr        = parseFloat((ins.inline_link_click_ctr as string) || "0");
        const cpm        = parseFloat((ins.cpm as string) || "0");
        const cpc        = parseFloat((ins.cost_per_inline_link_click as string) || (ins.cpc as string) || "0");

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
          spend, impressions, clicks, ctr, cpc, cpm,
          reach: parseInt((ins.reach as string) || "0", 10),
          frequency: parseFloat((ins.frequency as string) || "0"),
          score: computeScore(spend, impressions, clicks, ctr, cpm),
        };
      });

    // ── Apply filter for display (scores already locked in above) ──
    // Filters are applied in order: status → campaign
    const adsToDisplay = allNormalized.filter((ad) => {
      // Status filter
      if (filter === "live"   && ad.status !== "ACTIVE") return false;
      if (filter === "paused" && !["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"].includes(ad.status)) return false;
      // Campaign filter (empty string = all campaigns)
      if (campaignId && ad.campaign_id !== campaignId) return false;
      return true;
    });

    if (adsToDisplay.length === 0) {
      const msg = filter === "live"
        ? "No active ads found. All ads may be paused."
        : filter === "paused"
        ? "No paused ads found. All ads may be active."
        : "No ads found. Make sure your access token has ads_read permission.";
      return NextResponse.json({
        summary: { total_ads: 0, total_spend: 0, total_impressions: 0, total_clicks: 0, avg_ctr: 0, avg_cpm: 0, avg_cpc: 0 },
        top_performers: [], underperformers: [], all_ads: [],
        ai_overview: msg, key_insights: [], top_performer_notes: [], underperformer_suggestions: [], overall_recommendation: "",
      });
    }

    // ── Sort by score (descending) ──
    const sorted = [...adsToDisplay].sort((a, b) => b.score - a.score);

    // ── Classify top / under IN CODE (not GPT) ──
    // Top performers: score >= 40, up to 3 ads
    // If no ad qualifies, take the single best-scored ad with actual impressions
    const qualifiedTop = sorted.filter((a) => a.score >= 40).slice(0, 3);
    const topPerformers = qualifiedTop.length > 0
      ? qualifiedTop
      : sorted.filter((a) => a.impressions > 0).slice(0, 1).length > 0
        ? sorted.filter((a) => a.impressions > 0).slice(0, 1)
        : sorted.slice(0, 1);
    const topIds = new Set(topPerformers.map((a) => a.id));
    const underperformers = sorted.filter((a) => !topIds.has(a.id));

    // ── Summary ──
    const totalSpend      = adsToDisplay.reduce((s, a) => s + a.spend, 0);
    const totalImpressions = adsToDisplay.reduce((s, a) => s + a.impressions, 0);
    const totalClicks     = adsToDisplay.reduce((s, a) => s + a.clicks, 0);
    const avgCtr          = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpmAds          = adsToDisplay.filter((a) => a.cpm > 0);
    const avgCpm          = cpmAds.length > 0 ? cpmAds.reduce((s, a) => s + a.cpm, 0) / cpmAds.length : 0;
    const cpcAds          = adsToDisplay.filter((a) => a.cpc > 0);
    const avgCpc          = cpcAds.length > 0 ? cpcAds.reduce((s, a) => s + a.cpc, 0) / cpcAds.length : 0;

    // ── Build data for GPT (text only — scoring already done) ──
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

    // ── Rule-based fallback ──
    function ruleBasedAnalysis(): Record<string, unknown> {
      const topName = topPerformers[0]?.name || "your top ad";
      const overview = `Your account shows ${adsToDisplay.length} ads with $${totalSpend.toFixed(2)} spend and avg CTR ${avgCtr.toFixed(2)}%. "${topName}" is the strongest performer (score ${topPerformers[0]?.score ?? 0}). The ${underperformers.length} underperforming ads need creative or delivery improvements before additional spend.`;
      const insights = [
        topPerformers[0]?.ctr > 0
          ? `"${topPerformers[0].name}" has the highest CTR at ${topPerformers[0].ctr.toFixed(2)}% with ${topPerformers[0].clicks} clicks — concentrate budget here.`
          : "No ad is generating clicks yet — all need hook rewrites before scaling budget.",
        `${underperformers.filter((a) => a.spend === 0 && a.impressions === 0).length} ads have never served. Check campaign status and set a minimum $5/day budget before editing copy.`,
        avgCtr < 0.3
          ? "Average CTR is below 0.3%. The first sentence/frame of every ad needs a stronger hook — use a number, question, or direct pain point."
          : "CTR is at benchmark — scale top performers and pause ads that haven't generated clicks in 7 days.",
      ];
      const topNotes = topPerformers.map((a) => ({
        ad_id: a.id,
        ad_name: a.name,
        why_performing: a.ctr > 0
          ? `CTR ${a.ctr.toFixed(2)}% is the strongest in this set. ${a.headline ? `Headline "${a.headline.slice(0, 60)}" is resonating with the audience.` : "Creative format is matching audience expectations."} CPM $${a.cpm.toFixed(2)} shows efficient delivery. Increase budget to $15–20/day.`
          : `Highest score in the set. Increase to $15/day to gather enough data for a reliable CTR read.`,
      }));
      const underSugg = underperformers.map((a) => {
        if (a.impressions === 0 && a.spend === 0) {
          return {
            ad_id: a.id, ad_name: a.name, pattern: "A",
            issue: `Ad "${a.name}" has never served ($0 spend, 0 impressions). Campaign or ad set is paused, or budget is $0. Fix delivery before any copy changes.`,
            headline_suggestion: null, body_suggestion: null, cta_suggestion: null,
            targeting_suggestion: "Once active: use Advantage+ audience, Reels + Feed placement, age 30–55. Let Meta optimise for 3 days.",
            budget_suggestion: "Set a minimum $5/day budget and activate the campaign. Evaluate creative only after 500 impressions.",
          };
        } else if (a.ctr === 0 && a.spend > 0) {
          return {
            ad_id: a.id, ad_name: a.name, pattern: "B",
            issue: `"${a.name}" spent $${a.spend.toFixed(2)} with ${a.impressions.toLocaleString()} impressions and 0 clicks. The hook is not stopping the scroll.`,
            headline_suggestion: a.headline
              ? `Current: "${a.headline.slice(0, 60)}" — rewrite to open with a specific number or question: "[X patients saved [amount] on [procedure] — here's how]"`
              : "[Open with a bold question or specific number. Example: 'Are you overpaying for [procedure]? Here's how patients save [amount]']",
            body_suggestion: a.body
              ? `Current: "${a.body.slice(0, 50)}..." — rewrite to lead with the outcome, not the service. "[State the transformation first. Add one proof point. End with a low-friction ask.]"`
              : "[Lead with viewer's desired result. Sentence 2: one specific proof point. Sentence 3: soft CTA.]",
            cta_suggestion: "LEARN_MORE",
            targeting_suggestion: null,
            budget_suggestion: `Pause now. Redirect budget to "${topPerformers[0]?.name || "top performer"}" while rewriting the hook. Reactivate only after creative update.`,
          };
        } else {
          return {
            ad_id: a.id, ad_name: a.name, pattern: "C",
            issue: `"${a.name}" has CTR ${a.ctr.toFixed(2)}% with ${a.clicks} clicks — below account average. Audience match or body copy needs improvement.`,
            headline_suggestion: null,
            body_suggestion: null,
            cta_suggestion: a.cta && !["LEARN_MORE", "GET_QUOTE"].includes(a.cta) ? "LEARN_MORE — lower friction for a cold audience" : null,
            targeting_suggestion: "Switch to 1% lookalike of website visitors or video viewers. Test age 30–55. Reels-only placement often outperforms Feed for healthcare video.",
            budget_suggestion: `Hold current budget for 5 more days. If CTR stays below 0.3%, pause and refresh creative.`,
          };
        }
      });
      const rec = topPerformers[0]
        ? `Increase "${topPerformers[0].name}" budget to $15–20/day immediately — it is the only converting ad. Pause the ${underperformers.filter((a) => a.ctr === 0).length} zero-CTR ads, apply the suggestions above, then reactivate at $5/day each.`
        : "No ad is generating clicks. Apply hook rewrites to all ads, activate at $5/day each, and measure CTR after 500 impressions before deciding which to scale.";
      return { ai_overview: overview, key_insights: insights, top_performer_notes: topNotes, underperformer_suggestions: underSugg, overall_recommendation: rec };
    }

    // ── GPT prompt (text analysis only — scores and classification already determined) ──
    const analysisPrompt = `${META_ADS_CONTEXT}

---
## YOUR TASK

Write a text analysis for a Meta Ads account (medical tourism / healthcare brand).
The ads below have already been scored and classified by a deterministic formula.
DO NOT change the scores or classifications — they are final.
Your job: write the narrative text only.

Filter applied: ${filter} | Period: ${datePreset} | Ads shown: ${sorted.length}${note ? ` | Analyst note: ${note}` : ""}

Account totals: spend=$${totalSpend.toFixed(2)} | impressions=${totalImpressions.toLocaleString()} | clicks=${totalClicks} | avg_ctr=${avgCtr.toFixed(4)}% | avg_cpm=$${avgCpm.toFixed(2)} | avg_cpc=$${avgCpc.toFixed(2)}

ADS (pre-classified, sorted best → worst):
${JSON.stringify(gptData, null, 2)}

---
## SUGGESTION PATTERN RULES

For underperformers, follow these patterns (only fill fields relevant to the pattern):

PATTERN A (spend=0, impressions=0 — never served):
  → issue + targeting_suggestion + budget_suggestion only
  → headline/body/cta = null (ad hasn't run — copy changes are useless until delivery is fixed)

PATTERN B (impressions>0, spend>0, clicks=0 — hook failing):
  → issue + headline_suggestion + body_suggestion + budget_suggestion
  → If headline/body data is null: use structural [bracket templates], NOT invented content
  → targeting/cta = null unless CTA is clearly wrong

PATTERN C (clicks>0, CTR below 0.3%, high CPC):
  → issue + targeting_suggestion + cta_suggestion
  → headline/body = null (creative is working somewhat — audience is the problem)

PATTERN D (decent CTR but low impressions):
  → issue + budget_suggestion + targeting_suggestion only (NOT a creative problem)

PATTERN E (decent CTR, high CPC):
  → issue + cta_suggestion + targeting_suggestion only

ABSOLUTE RULE: Never invent specific procedures, prices, countries, or clinic names
unless they appear in the ad's headline/body/story data. Use [bracket templates] instead.

---
## REQUIRED JSON (return ONLY valid JSON, no markdown)

{
  "ai_overview": "2-3 sentences: account health using real numbers, single biggest opportunity, what is holding performance back",
  "key_insights": [
    "Specific insight with actual ad name and real metric numbers from the data",
    "Why the top performer is outperforming others — reference its actual metrics",
    "The shared problem across underperforming ads"
  ],
  "top_performer_notes": [
    {
      "ad_id": "<id>",
      "ad_name": "<name>",
      "why_performing": "Reference actual metrics (CTR %, clicks, CPM). Reference headline if available. No invented content."
    }
  ],
  "underperformer_suggestions": [
    {
      "ad_id": "<id>",
      "ad_name": "<name>",
      "pattern": "A|B|C|D|E",
      "issue": "Root cause — specific to this ad's actual metrics (spend $X, impressions Y, clicks Z)",
      "headline_suggestion": "<structural template in [brackets] OR null>",
      "body_suggestion": "<structural template in [brackets] OR null>",
      "cta_suggestion": "<specific CTA button name OR null>",
      "targeting_suggestion": "<specific audience action OR null>",
      "budget_suggestion": "<concrete $ action OR null>"
    }
  ],
  "overall_recommendation": "Single highest-ROI action — specific ad name, exact budget move, based on real numbers"
}

HARD RULES:
1. top_performer_notes must have exactly ${topPerformers.length} entries — one per top performer
2. underperformer_suggestions must have exactly ${underperformers.length} entries — one per underperformer
3. Every insight and suggestion must be grounded in the actual metric numbers provided
4. null fields are correct — only populate if it directly addresses that pattern's root cause`;

    // ── Run GPT (text only) ──
    let ai: Record<string, unknown> = {};
    let aiError = "";

    if (OPENAI_KEY) {
      try {
        ai = await callOpenAI(analysisPrompt, 4000, "analysis");
      } catch (e) {
        aiError = `GPT failed: ${e instanceof Error ? e.message : String(e)}`;
        console.error("[report-analysis]", aiError);
      }
    } else {
      aiError = "OPENAI_API_KEY not configured — using rule-based analysis";
      console.warn("[report-analysis]", aiError);
    }

    // Fall back to rule-based if GPT failed
    if (!ai.ai_overview) {
      ai = ruleBasedAnalysis();
      if (aiError) aiError += " (rule-based fallback applied)";
    }

    // ── Fill any suggestions GPT missed (code-side patch, no second GPT call) ──
    const existingSuggIds = new Set(
      (ai.underperformer_suggestions as Array<{ ad_id: string }> || []).map((s) => s.ad_id)
    );
    const missedUnder = underperformers.filter((a) => !existingSuggIds.has(a.id));
    if (missedUnder.length > 0) {
      const fbSugg = (ruleBasedAnalysis().underperformer_suggestions as Array<{ ad_id: string }> || []);
      const fbMap = new Map(fbSugg.map((s) => [s.ad_id, s]));
      const patched = missedUnder.map((a) => fbMap.get(a.id)).filter(Boolean);
      ai.underperformer_suggestions = [
        ...(ai.underperformer_suggestions as unknown[] || []),
        ...patched,
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
      underperformers: underperformers,
      all_ads: sorted,
      ai_overview: (ai.ai_overview as string) || "",
      key_insights: (ai.key_insights as string[]) || [],
      top_performer_notes: (ai.top_performer_notes as unknown[]) || [],
      underperformer_suggestions: (ai.underperformer_suggestions as unknown[]) || [],
      overall_recommendation: (ai.overall_recommendation as string) || "",
      ai_error: aiError,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[report-analysis]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
