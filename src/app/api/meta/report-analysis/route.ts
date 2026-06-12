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

async function callOpenAI(
  prompt: string,
  maxTokens: number,
  label: string
): Promise<Record<string, unknown>> {
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

// ─────────────────────────────────────────────
// Deep Meta Ads context injected into every GPT call
// ─────────────────────────────────────────────
const META_ADS_CONTEXT = `
## META ADS FUNDAMENTALS YOU MUST APPLY

### The Auction
Facebook runs a real-time auction for every impression. Your ad wins based on:
  Total Value = (Bid) × (Estimated Action Rate) × (Ad Quality Score)
Higher CTR → higher estimated action rate → wins more auctions → lower effective CPM.
A 2× CTR improvement often halves your CPM — that is why CTR is the #1 lever.

### Quality Ranking (Relevance Diagnostics)
Meta scores each ad against others targeting the same audience:
  - Quality Ranking: perceived quality vs competing ads
  - Engagement Rate Ranking: expected engagement vs similar ads
  - Conversion Rate Ranking: expected conversion rate
Below average on any of these = ad shown less, CPM rises. Fix: refresh creative or tighten audience.

### CTR Benchmarks (Healthcare / Medical Tourism)
  - < 0.3% CTR  → poor. Hook is not stopping the scroll. Rewrite first line / first frame.
  - 0.3–0.7% CTR → average. Room to improve copy and audience targeting.
  - 0.7–1.5% CTR → good. Scale budget carefully, monitor frequency.
  - > 1.5% CTR  → excellent. Double budget, build lookalikes from clickers.

### CPM Benchmarks (Healthcare)
  - < $3 CPM  → great delivery, broad/cheap audience. May need more qualified targeting.
  - $3–8 CPM  → healthy range.
  - > $12 CPM → audience too narrow or low quality ranking. Widen targeting or refresh creative.

### The Learning Phase
New ads need ~50 optimization events in 7 days. During learning:
  - Performance fluctuates — do NOT judge before 500 impressions minimum
  - Avoid editing the ad or budget (resets learning)
  - If learning is stuck: increase budget or broaden audience

### Diagnosing by Metric Pattern
  PATTERN A — spend=0, impressions=0:
    Root cause: campaign/ad set is paused OR budget is $0 OR ad is disapproved.
    Fix: check campaign status and budget first. Do NOT suggest copy rewrites — the ad hasn't run.

  PATTERN B — impressions>0, spend>0, clicks=0, CTR=0%:
    Root cause: creative hook is failing in first 3 seconds (video) or thumb-stop (image).
    Fix: rewrite the hook / headline. The audience IS seeing the ad but scrolling past.

  PATTERN C — CTR 0.01–0.3%, clicks>0 but CPC very high:
    Root cause: wrong audience (low relevance) or weak body copy (interest but no action).
    Fix: tighten audience targeting + strengthen the CTA / body copy.

  PATTERN D — CTR>0.3% but low total clicks (low impressions):
    Root cause: budget is too low or audience is too narrow — ad is starved of delivery.
    Fix: increase daily budget or broaden audience (not a creative problem).

  PATTERN E — good CTR but high CPC (>$2 for healthcare):
    Root cause: landing page or CTA mismatch, or audience not ready to click through.
    Fix: align CTA with audience intent, test a softer ask (LEARN_MORE vs BOOK_TRAVEL).

### What Actually Moves Results (in priority order)
  1. Hook / First Line — 80% of CTR is determined by the first sentence or first 3 seconds
  2. Audience Match — wrong audience = no clicks regardless of creative quality
  3. Budget — ads need minimum $5–10/day to exit learning phase and get real data
  4. CTA Alignment — mismatch between ad promise and button creates friction
  5. Creative Format — video outperforms image for awareness; image can win for direct response
  6. Bid Strategy — only matters after CTR and audience are optimised

### CTA Selection Guide
  - LEARN_MORE → lowest friction, best for cold audiences who don't know your brand
  - GET_QUOTE → works for high-consideration services (medical, insurance)
  - BOOK_TRAVEL → strong for medical tourism / travel verticals
  - CONTACT_US → good for local or premium services where relationship matters
  - SIGN_UP → only use when there is a clear form or lead magnet
  - SHOP_NOW → e-commerce only

### Hook Writing Principles
  Scroll-stopping hooks use one of:
  - Specific number: "5 Canadians cut their surgery cost by 70% doing this"
  - Bold question: "Are you paying 3× too much for dental work abroad?"
  - Surprising stat: "The #1 reason medical tourists choose [Country] isn't price"
  - Direct pain: "Tired of waiting 6 months for a specialist? There's another way."
  Avoid generic openers like "We offer..." or "Our clinic provides..." — these lose 90% of viewers.
`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const filter = searchParams.get("filter") || "both";
    const note = searchParams.get("note") || "";
    const datePreset = searchParams.get("date_preset") || "last_30d";

    if (!TOKEN || !ACCOUNT) {
      return NextResponse.json({ error: "Missing Meta credentials" }, { status: 500 });
    }

    // ── Fetch ads ──
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
    let insightsRaw: Record<string, unknown>[] = [];
    try {
      insightsRaw = await allPages(`act_${ACCOUNT}/insights`, {
        level: "ad",
        fields: insightFields,
        date_preset: datePreset,
        limit: "200",
      });
    } catch { /* no spend in period */ }
    const insightMap = new Map(insightsRaw.map((i) => [i.ad_id as string, i]));

    // ── Filter ──
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
        ai_overview: "No ads found. Make sure your access token has ads_read permission.",
        key_insights: [], top_performer_notes: [], underperformer_suggestions: [], overall_recommendation: "",
      });
    }
    const adsToAnalyse = filtered.length > 0 ? filtered : adsRaw;

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

    // ── Normalise ──
    interface Ad {
      id: string; name: string; status: string; campaign_name: string; campaign_id: string;
      headline: string; body: string; cta: string; image_url: string; media_url: string;
      story: string; spend: number; impressions: number; clicks: number; ctr: number;
      cpc: number; cpm: number; reach: number; frequency: number; score?: number;
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
        id: ad.id as string, name: ad.name as string,
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

    // ── Summary ──
    const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
    const totalImpressions = ads.reduce((s, a) => s + a.impressions, 0);
    const totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpmAds = ads.filter((a) => a.cpm > 0);
    const avgCpm = cpmAds.length > 0 ? cpmAds.reduce((s, a) => s + a.cpm, 0) / cpmAds.length : 0;
    const cpcAds = ads.filter((a) => a.cpc > 0);
    const avgCpc = cpcAds.length > 0 ? cpcAds.reduce((s, a) => s + a.cpc, 0) / cpcAds.length : 0;

    // ── Build raw data for GPT (no code-side scoring) ──
    const rawForGpt = ads.map((a) => ({
      id: a.id,
      name: a.name,
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
        cpc_dollars: a.cpc > 0 ? parseFloat(a.cpc.toFixed(2)) : null,
        cpm_dollars: a.cpm > 0 ? parseFloat(a.cpm.toFixed(2)) : null,
        reach: a.reach,
        frequency: parseFloat(a.frequency.toFixed(2)),
      },
    }));

    // ── Rule-based fallback (used when OpenAI unavailable) ──
    function ruleBasedAnalysis(): Record<string, unknown> {
      const maxCtr2 = Math.max(...ads.map((a) => a.ctr), 0.001);
      const maxClicks2 = Math.max(...ads.map((a) => a.clicks), 1);
      const cpcList = ads.filter((a) => a.cpc > 0);
      const minCpc2 = cpcList.length > 0 ? Math.min(...cpcList.map((a) => a.cpc)) : 1;

      const fbScored = ads.map((a) => {
        let score = 5;
        if (a.impressions > 0 || a.spend > 0) {
          score = Math.round(
            (a.ctr / maxCtr2) * 50 +
            (a.clicks / maxClicks2) * 30 +
            (a.cpc > 0 ? Math.min((minCpc2 / a.cpc) * 20, 20) : 3)
          );
          score = Math.max(6, score);
        }
        return { ...a, score };
      }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      const fbTop = fbScored.filter((a) => (a.score ?? 0) >= 25 && (a.impressions > 0 || a.spend > 0)).slice(0, 3);
      const safeTop = fbTop.length > 0 ? fbTop : fbScored.slice(0, 1);
      const fbTopIds = new Set(safeTop.map((a) => a.id));
      const fbUnder = fbScored.filter((a) => !fbTopIds.has(a.id));

      const scoredAds = fbScored.map((a) => ({
        ad_id: a.id,
        score: a.score,
        classification: fbTopIds.has(a.id) ? "top_performer" : "underperformer",
      }));

      const topName = safeTop[0]?.name || "your top ad";
      const overview = `Your account has ${ads.length} ads with $${totalSpend.toFixed(2)} total spend and an avg CTR of ${avgCtr.toFixed(2)}%. "${topName}" is the strongest performer. The ${fbUnder.length} underperforming ads need creative and targeting improvements before additional spend.`;
      const insights = [
        safeTop[0]?.ctr > 0
          ? `"${safeTop[0].name}" achieves a ${safeTop[0].ctr.toFixed(2)}% CTR — the only ad generating real engagement. Concentrate budget here.`
          : "No ad is generating clicks yet — all ads need hook rewrites before scaling budget.",
        `${fbUnder.filter((a) => a.spend === 0 && a.impressions === 0).length} ads have never served. Check campaign status and budget before editing copy.`,
        avgCtr < 0.3
          ? "Average CTR is critically low (<0.3%). The first sentence of every ad needs a stronger hook — a number, question, or specific pain point."
          : "CTR is at benchmark — focus on converting impressions by tightening the audience and CTA.",
      ];
      const topNotes = safeTop.map((a) => ({
        ad_id: a.id, ad_name: a.name,
        why_performing: a.ctr > 0
          ? `CTR of ${a.ctr.toFixed(2)}% is the strongest in the account. ${a.headline ? `The headline "${a.headline.slice(0, 60)}" is resonating.` : "Creative format is matching audience expectations."} Increase budget to $15–20/day.`
          : `Highest composite score. Increase to $15/day to exit the learning phase and get reliable CTR data.`,
      }));

      const underSugg = fbUnder.map((a) => {
        const camp = a.campaign_name.split(" ")[0] || "health";
        // Only return suggestions relevant to the actual problem
        if (a.impressions === 0 && a.spend === 0) {
          return {
            ad_id: a.id, ad_name: a.name,
            issue: "Ad has never served — campaign or ad set is paused / budget is $0. Fix delivery first before any creative changes.",
            headline_suggestion: null,
            body_suggestion: null,
            cta_suggestion: null,
            targeting_suggestion: "Once active: start with Advantage+ audience, Reels + Feed placement, age 30–55. Let Meta optimise delivery for 3 days.",
            budget_suggestion: "Set a minimum $5/day budget and activate the campaign. Judge creative only after 500 impressions.",
          };
        } else if (a.ctr === 0 && a.spend > 0) {
          return {
            ad_id: a.id, ad_name: a.name,
            issue: `Spent $${a.spend.toFixed(2)} with 0 clicks — the hook is not stopping the scroll. First 3 seconds / first line is the problem.`,
            headline_suggestion: a.headline
              ? `Current: "${a.headline.slice(0, 60)}" → try: "Are you paying 3× too much for ${camp}?" or "How [City] patients save 70% on ${camp} abroad"`
              : `Try a specific number or question: "5 ${camp} patients who saved $8,000 — here's exactly what they did"`,
            body_suggestion: a.body
              ? `Current opens with: "${a.body.slice(0, 50)}..." — rewrite to lead with the outcome, not the service. Example: "Sarah saved $9,000 on her surgery. No compromises. JCI-accredited care. Here's how."`
              : "Lead with the viewer's desired result. Sentence 2: one specific proof point or stat. Sentence 3: soft ask (LEARN_MORE, not BOOK NOW).",
            cta_suggestion: "LEARN_MORE — lowest friction for a cold audience that hasn't clicked yet.",
            targeting_suggestion: null,
            budget_suggestion: `Pause this ad. Redirect its budget to "${safeTop[0]?.name || "top performer"}" while you rewrite the hook. Reactivate only after creative update.`,
          };
        } else {
          return {
            ad_id: a.id, ad_name: a.name,
            issue: "Below-average CTR — ad is serving but audience relevance or body copy is weak.",
            headline_suggestion: `Add urgency or specificity: "Only [X] consultation slots this month for ${camp} patients abroad"`,
            body_suggestion: "Open with the viewer's desired outcome. Add one line of social proof. End with a benefit-focused CTA, not a generic one.",
            cta_suggestion: "GET_QUOTE or BOOK_TRAVEL — stronger intent signal than LEARN_MORE for this stage.",
            targeting_suggestion: "Narrow to 1% lookalike of website visitors or video viewers. Test age 30–55. Reels-only placement often outperforms Feed for healthcare video.",
            budget_suggestion: `Hold current budget for 5 more days. If CTR stays below 0.3%, pause and refresh the creative.`,
          };
        }
      });

      const rec = safeTop[0]
        ? `Increase "${safeTop[0].name}" to $15–20/day immediately — it is your only converting ad. Pause all ${fbUnder.filter((a) => a.ctr === 0).length} zero-CTR ads, rewrite their hooks using the suggestions above, then reactivate at $5/day each to re-enter the learning phase.`
        : "No ad is generating clicks. Rewrite hooks across all ads, activate with $5/day each, and measure CTR after 500 impressions before deciding which to scale.";

      return { scored_ads: scoredAds, ai_overview: overview, key_insights: insights, top_performer_notes: topNotes, underperformer_suggestions: underSugg, overall_recommendation: rec };
    }

    // ── GPT Analysis Prompt ──
    const underList = rawForGpt.filter((a) => a.metrics.spend === 0 && a.metrics.impressions === 0
      ? true  // definitely underperformer
      : true  // include all — GPT will classify
    );

    const analysisPrompt = `${META_ADS_CONTEXT}

---
## YOUR TASK

You are analysing a Meta Ads account for a medical tourism / healthcare brand.
Analyse every ad below, score it, classify it, and — for every underperformer — provide ONLY the changes that will actually move the metrics for that specific ad's problem pattern.

Filter: ${filter} | Period: ${datePreset} | Ads: ${ads.length}${note ? ` | Analyst note: ${note}` : ""}

Account totals:
- Total spend: $${totalSpend.toFixed(2)}
- Total impressions: ${totalImpressions.toLocaleString()}
- Total clicks: ${totalClicks}
- Avg CTR: ${avgCtr.toFixed(4)}%
- Avg CPM: $${avgCpm.toFixed(2)}
- Avg CPC: $${avgCpc.toFixed(2)}

ALL ADS (raw — no pre-scoring applied):
${JSON.stringify(rawForGpt, null, 2)}

---
## SCORING RULES (apply the Meta fundamentals above)

Score 0–100 based on ACTUAL metrics only:
- spend=0 AND impressions=0 → score 5 max, MUST be "underperformer"
- spend>0, impressions>0, clicks=0, CTR=0% → score 8–25 max, likely "underperformer"
- CTR 0.01–0.29% → score 26–50
- CTR 0.3–0.69% → score 51–75
- CTR ≥ 0.7% → score 76–100
- Adjust ±10 for CPM and CPC efficiency relative to account average
- "top_performer" requires: score ≥ 40 AND (clicks > 0 OR CTR > 0.2%) AND impressions > 0

---
## SUGGESTION RULES (critical — read carefully)

For each underperformer, identify the PRIMARY PROBLEM using the diagnostic patterns in the fundamentals section above.
Then return ONLY the suggestions that are directly relevant to that problem:

- PATTERN A (never served): return ONLY targeting_suggestion + budget_suggestion. Set headline_suggestion and body_suggestion and cta_suggestion to null.
- PATTERN B (0 clicks despite spend): return headline_suggestion + body_suggestion + budget_suggestion. Set targeting_suggestion and cta_suggestion to null UNLESS cta is clearly wrong.
- PATTERN C (low CTR, high CPC): return headline_suggestion + targeting_suggestion + cta_suggestion. Set body_suggestion to null unless body is clearly the issue.
- PATTERN D (good CTR but low impressions): return budget_suggestion + targeting_suggestion ONLY. Do not suggest copy changes.
- PATTERN E (good CTR, high CPC): return cta_suggestion + targeting_suggestion ONLY.

Suggestions must be SPECIFIC and ACTIONABLE — reference the actual ad name, current headline/body text, and give concrete rewrites. Do not give generic advice.

---
## REQUIRED JSON OUTPUT (return ONLY valid JSON, no markdown)

{
  "scored_ads": [
    { "ad_id": "<id>", "score": <0-100>, "classification": "top_performer" | "underperformer", "pattern": "A|B|C|D|E|top" }
  ],
  "ai_overview": "2-3 sentences: account health, single biggest CTR lever, what is holding performance back",
  "key_insights": [
    "Specific insight referencing ad names and real metric numbers",
    "Why the top ad works (or why all are struggling) — reference its actual hook/copy",
    "The one pattern across all underperforming ads that, if fixed, would lift the whole account"
  ],
  "top_performer_notes": [
    {
      "ad_id": "<id>",
      "ad_name": "<name>",
      "why_performing": "Specific reason — name the psychological trigger, reference the actual headline/hook, explain the metric outcome"
    }
  ],
  "underperformer_suggestions": [
    {
      "ad_id": "<id>",
      "ad_name": "<name>",
      "pattern": "A|B|C|D|E",
      "issue": "The single root cause — be specific, reference metrics and ad name",
      "headline_suggestion": "<rewritten headline OR null>",
      "body_suggestion": "<rewritten body copy OR null>",
      "cta_suggestion": "<best CTA button OR null>",
      "targeting_suggestion": "<specific audience change OR null>",
      "budget_suggestion": "<concrete $ action OR null>"
    }
  ],
  "overall_recommendation": "The #1 highest-ROI action right now — name the specific ad, exact $ move, expected CTR outcome"
}

HARD RULES:
1. scored_ads MUST have exactly ${ads.length} entries — one per ad, no duplicates, no omissions
2. underperformer_suggestions MUST have one entry for EVERY ad_id classified as "underperformer"
3. top_performer_notes MUST have one entry for EVERY ad_id classified as "top_performer"
4. null fields are fine — only fill a suggestion field if it will genuinely help for that ad's pattern
5. Do NOT suggest headline/body rewrites for an ad that has never served (Pattern A) — fix delivery first`;

    // ── Validation Prompt ──
    function buildValidationPrompt(analysis: Record<string, unknown>): string {
      const classified = (analysis.scored_ads as Array<{ ad_id: string; score: number; classification: string; pattern: string }> || []);
      const underIds = classified.filter((s) => s.classification === "underperformer").map((s) => s.ad_id);
      const topIds = classified.filter((s) => s.classification === "top_performer").map((s) => s.ad_id);
      const suggIds = (analysis.underperformer_suggestions as Array<{ ad_id: string }> || []).map((s) => s.ad_id);
      const missingSugg = underIds.filter((id) => !suggIds.includes(id));
      const missingTop = topIds.filter((id) => !(analysis.top_performer_notes as Array<{ ad_id: string }> || []).map((n) => n.ad_id).includes(id));

      return `${META_ADS_CONTEXT}

---
## VALIDATION TASK

You are a quality-control agent. The analysis below was produced by another GPT instance. Fix any issues.

ORIGINAL AD DATA (for reference):
${JSON.stringify(rawForGpt.map((a) => ({ id: a.id, name: a.name, metrics: a.metrics })), null, 2)}

ANALYSIS TO VALIDATE:
${JSON.stringify(analysis, null, 2)}

ISSUES TO FIX:
${classified.length !== ads.length ? `1. scored_ads has ${classified.length} entries but there are ${ads.length} ads. Add missing ads with score=5, classification="underperformer", pattern="A".` : "1. scored_ads count OK."}
${missingSugg.length > 0 ? `2. underperformer_suggestions is MISSING entries for these ad_ids: ${missingSugg.join(", ")}. Add them now using the pattern rules.` : "2. underperformer_suggestions complete."}
${missingTop.length > 0 ? `3. top_performer_notes is MISSING entries for these ad_ids: ${missingTop.join(", ")}. Add them.` : "3. top_performer_notes complete."}
4. Verify: any ad with spend=0 AND impressions=0 must be "underperformer". Fix if wrong.
5. Verify: suggestion fields for Pattern A ads must be null for headline/body/cta. Fix if wrong.
6. Verify: all non-null suggestion fields have actual content (not empty strings). Fill if blank.

Return the COMPLETE corrected JSON in the exact same structure. Do not remove any data that is already correct.`;
    }

    // ── Run GPT ──
    let ai: Record<string, unknown> = {};
    let aiError = "";

    if (OPENAI_KEY) {
      // Call 1: Full analysis with scoring + suggestions
      try {
        ai = await callOpenAI(analysisPrompt, 5000, "analysis");
      } catch (e) {
        aiError = `Analysis: ${e instanceof Error ? e.message : String(e)}`;
        console.error("[report-analysis]", aiError);
      }

      // Call 2: Validator agent — only if analysis call succeeded
      if (ai.scored_ads) {
        try {
          const validated = await callOpenAI(buildValidationPrompt(ai), 4000, "validator");
          if (validated.scored_ads) {
            ai = validated;
          }
        } catch (e) {
          // Non-fatal — use the unvalidated analysis
          console.warn("[report-analysis/validator]", e instanceof Error ? e.message : String(e));
        }
      }
    } else {
      aiError = "OPENAI_API_KEY not configured — using rule-based analysis";
      console.warn("[report-analysis]", aiError);
    }

    // Fall back if GPT failed completely
    if (!ai.scored_ads) {
      ai = ruleBasedAnalysis();
      if (aiError) aiError += " (rule-based fallback applied)";
    }

    // ── Merge GPT scores back into ad objects ──
    const scoreMap = new Map<string, { score: number; classification: string }>();
    for (const sa of (ai.scored_ads as Array<{ ad_id: string; score: number; classification: string }> || [])) {
      if (sa?.ad_id) scoreMap.set(sa.ad_id, { score: Math.round(sa.score ?? 5), classification: sa.classification ?? "underperformer" });
    }

    const allAdsScored = ads.map((a) => {
      const gs = scoreMap.get(a.id) || { score: 5, classification: "underperformer" };
      return { ...a, score: gs.score, _classification: gs.classification };
    }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    type ScoredAd = Ad & { score: number; _classification: string };
    const topAds = (allAdsScored as ScoredAd[]).filter((a) => a._classification === "top_performer");
    const underAds = (allAdsScored as ScoredAd[]).filter((a) => a._classification !== "top_performer");

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
      top_performers: topAds,
      underperformers: underAds,
      all_ads: allAdsScored,
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
