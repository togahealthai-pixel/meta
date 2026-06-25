import { NextResponse } from "next/server";

export async function GET() {
  const pageId    = process.env.META_PAGE_ID;
  const pageToken = process.env.META_PAGE_TOKEN;

  if (!pageId || !pageToken) {
    return NextResponse.json({ error: "META_PAGE_ID or META_PAGE_TOKEN not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/leadgen_forms?fields=id,name,status&access_token=${pageToken}`
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || "Failed to fetch forms" }, { status: 500 });
    }
    return NextResponse.json(data.data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
