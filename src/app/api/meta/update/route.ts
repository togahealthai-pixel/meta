import { NextResponse } from 'next/server';

const GRAPH = "https://graph.facebook.com/v21.0";
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!;

async function metaPost(path: string, body: Record<string, unknown>, accessToken: string) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Meta error on ${path}`);
  return data;
}

export async function POST(request: Request) {
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json({ error: "Missing Meta credentials" }, { status: 500 });
  }

  try {
    const { campaignId, campaignData, adSetId, adSetData, adId, adData } = await request.json();
    const results: Record<string, unknown> = {};

    // ── 1. Update Campaign ──
    if (campaignId && campaignData && Object.keys(campaignData).length > 0) {
      // Strip undefined/null values and convert budget to int
      const payload: Record<string, unknown> = {};
      if (campaignData.name) payload.name = campaignData.name;
      if (campaignData.daily_budget) payload.daily_budget = Math.round(Number(campaignData.daily_budget));
      if (campaignData.lifetime_budget) payload.lifetime_budget = Math.round(Number(campaignData.lifetime_budget));
      if (campaignData.end_time) payload.end_time = campaignData.end_time;
      results.campaign = await metaPost(campaignId, payload, accessToken);
    }

    // ── 2. Update Ad Set ──
    if (adSetId && adSetData && Object.keys(adSetData).length > 0) {
      const payload: Record<string, unknown> = {};
      if (adSetData.name) payload.name = adSetData.name;
      if (adSetData.daily_budget) payload.daily_budget = Math.round(Number(adSetData.daily_budget));
      if (adSetData.lifetime_budget) payload.lifetime_budget = Math.round(Number(adSetData.lifetime_budget));
      if (adSetData.start_time) payload.start_time = adSetData.start_time;
      if (adSetData.end_time) payload.end_time = adSetData.end_time;
      if (adSetData.targeting) payload.targeting = adSetData.targeting;
      if (adSetData.bid_strategy) payload.bid_strategy = adSetData.bid_strategy;
      if (adSetData.bid_amount) payload.bid_amount = Math.round(Number(adSetData.bid_amount));
      if (adSetData.optimization_goal) payload.optimization_goal = adSetData.optimization_goal;
      results.adSet = await metaPost(adSetId, payload, accessToken);
    }

    // ── 3. Update Ad + Creative ──
    if (adId && adData) {
      const hasCreativeChange = adData.headline !== undefined || adData.body !== undefined ||
        adData.link_url !== undefined || adData.cta_type !== undefined;

      if (hasCreativeChange && adData.creative_id) {
        // Fetch existing creative to preserve media (video_id / image_hash)
        const creativeRes = await fetch(
          `${GRAPH}/${adData.creative_id}?fields=id,name,object_story_spec&access_token=${accessToken}`
        );
        const creativeData = await creativeRes.json();
        if (!creativeRes.ok) throw new Error("Failed to fetch creative: " + (creativeData.error?.message || ""));

        const spec = JSON.parse(JSON.stringify(creativeData.object_story_spec || {}));
        const isVideo = !!spec.video_data;

        if (isVideo) {
          if (adData.headline !== undefined) spec.video_data.title = adData.headline;
          if (adData.body !== undefined) spec.video_data.message = adData.body;
          if (adData.cta_type !== undefined || adData.link_url !== undefined) {
            const existingLink = spec.video_data?.call_to_action?.value?.link || "";
            spec.video_data.call_to_action = {
              type: adData.cta_type || spec.video_data?.call_to_action?.type || "LEARN_MORE",
              value: { link: adData.link_url || existingLink },
            };
          }
        } else {
          if (adData.headline !== undefined) spec.link_data.name = adData.headline;
          if (adData.body !== undefined) spec.link_data.message = adData.body;
          if (adData.link_url !== undefined) spec.link_data.link = adData.link_url;
          if (adData.cta_type !== undefined || adData.link_url !== undefined) {
            const existingLink = spec.link_data?.link || adData.link_url || "";
            spec.link_data.call_to_action = {
              type: adData.cta_type || spec.link_data?.call_to_action?.type || "LEARN_MORE",
              value: { link: adData.link_url || existingLink },
            };
          }
        }

        // Create new creative with updated text
        const newCreative = await metaPost(`act_${ACCOUNT}/adcreatives`, {
          name: `${creativeData.name || "Creative"}_edited_${Date.now()}`,
          object_story_spec: spec,
        }, accessToken);

        if (!newCreative.id) throw new Error("Failed to create updated creative");

        // Update ad to point to new creative (+ name if changed)
        const adPayload: Record<string, unknown> = { creative: { creative_id: newCreative.id } };
        if (adData.name) adPayload.name = adData.name;
        results.ad = await metaPost(adId, adPayload, accessToken);
        results.newCreativeId = newCreative.id;
      } else if (adData.name) {
        // Name-only update
        results.ad = await metaPost(adId, { name: adData.name }, accessToken);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Update Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
