import { NextResponse } from "next/server";

const GRAPH = "https://graph.facebook.com/v21.0";

// Smart Run: activates a single ad while pausing all sibling ads in the same campaign.
// Steps (in order):
//   1. Fetch all non-archived ads in the campaign
//   2. Pause every ad except the target (at ad level)
//   3. Resume the parent adset to ACTIVE
//   4. Resume the parent campaign to ACTIVE
//   5. Set the target ad to ACTIVE
export async function POST(request: Request) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    return NextResponse.json({ error: "Missing Meta credentials" }, { status: 500 });
  }

  try {
    const { ad_id, campaign_id, adset_id } = await request.json();

    if (!ad_id || !campaign_id || !adset_id) {
      return NextResponse.json({ error: "ad_id, campaign_id, and adset_id are required" }, { status: 400 });
    }

    // Step 1: fetch all ads in this campaign
    const filter = encodeURIComponent(JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: campaign_id }]));
    const adsRes = await fetch(
      `${GRAPH}/act_${adAccountId}/ads?fields=id,name,status,effective_status&filtering=${filter}&limit=200&access_token=${accessToken}`
    );
    const adsData = await adsRes.json();
    const allAds: { id: string; name: string; status: string; effective_status: string }[] = adsData.data || [];

    // Step 2: pause siblings (skip already-paused, skip archived)
    const siblings = allAds.filter(
      (a) => a.id !== ad_id && a.status !== "PAUSED" && a.effective_status !== "ARCHIVED"
    );
    const pauseResults = await Promise.allSettled(
      siblings.map((a) =>
        fetch(`${GRAPH}/${a.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "PAUSED", access_token: accessToken }),
        }).then((r) => r.json())
      )
    );
    const pausedCount = pauseResults.filter((r) => r.status === "fulfilled").length;

    // Step 3: resume adset
    const adsetRes = await fetch(`${GRAPH}/${adset_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE", access_token: accessToken }),
    });
    const adsetData = await adsetRes.json();
    if (!adsetRes.ok && !adsetData.success) {
      console.warn(`smart-run: adset resume returned`, adsetData.error?.message);
    }

    // Step 4: resume campaign
    const campRes = await fetch(`${GRAPH}/${campaign_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE", access_token: accessToken }),
    });
    const campData = await campRes.json();
    if (!campRes.ok && !campData.success) {
      return NextResponse.json({ error: campData.error?.message || "Failed to resume campaign" }, { status: 400 });
    }

    // Step 5: activate the target ad
    const adRes = await fetch(`${GRAPH}/${ad_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE", access_token: accessToken }),
    });
    const adData = await adRes.json();
    if (!adRes.ok && !adData.success) {
      return NextResponse.json({ error: adData.error?.message || "Failed to activate ad" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      pausedSiblings: pausedCount,
      message: `Paused ${pausedCount} sibling ad(s), resumed campaign + adset, activated target ad.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("smart-run error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
