import { NextResponse } from "next/server";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET() {
  const token = process.env.META_ACCESS_TOKEN;
  const account = process.env.META_AD_ACCOUNT_ID;

  if (!token || !account) {
    return NextResponse.json({ error: "Missing Meta credentials" }, { status: 500 });
  }

  try {
    const fields = "id,name,status,effective_status,objective,daily_budget,lifetime_budget";
    const url = `${GRAPH}/act_${account}/campaigns?fields=${fields}&limit=200&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || "Meta API error" }, { status: res.status });
    }

    const campaigns = (data.data || []).map((c: Record<string, unknown>) => ({
      id: c.id,
      name: c.name,
      status: ((c.effective_status || c.status || "") as string).toUpperCase(),
    }));

    return NextResponse.json({ campaigns });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
