import { NextResponse } from "next/server";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const adId = searchParams.get("adId");
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!accessToken || !adId) {
    return NextResponse.json({ error: "Missing credentials or adId" }, { status: 400 });
  }

  try {
    const fields = "id,name,status,creative{id,title,body,call_to_action_type,object_story_spec,image_url,thumbnail_url}";
    const res = await fetch(`${GRAPH}/${adId}?fields=${fields}&access_token=${accessToken}`);
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || "Meta API error" }, { status: res.status });
    }

    const creative = data.creative || {};
    const spec = creative.object_story_spec || {};
    const isVideo = !!spec.video_data;

    // Extract editable text fields from the appropriate spec branch
    const headline = isVideo
      ? (spec.video_data?.title || creative.title || "")
      : (spec.link_data?.name || creative.title || "");

    const body = isVideo
      ? (spec.video_data?.message || creative.body || "")
      : (spec.link_data?.message || creative.body || "");

    const linkUrl = isVideo
      ? (spec.video_data?.call_to_action?.value?.link || "")
      : (spec.link_data?.link || "");

    const ctaType = isVideo
      ? (spec.video_data?.call_to_action?.type || creative.call_to_action_type || "LEARN_MORE")
      : (spec.link_data?.call_to_action?.type || creative.call_to_action_type || "LEARN_MORE");

    return NextResponse.json({
      id: data.id,
      name: data.name,
      creative_id: creative.id,
      headline,
      body,
      link_url: linkUrl,
      cta_type: ctaType,
      is_video: isVideo,
      thumbnail_url: creative.thumbnail_url || creative.image_url || "",
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
