import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TOKEN = process.env.META_ACCESS_TOKEN!;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!;
const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET() {
  const out: Record<string, unknown> = {};

  // 1. Flat ads list
  try {
    const r = await fetch(`${GRAPH}/act_${ACCOUNT}/ads?fields=id,name,status,effective_status,campaign_id,creative{title,body,call_to_action_type,image_url,thumbnail_url}&limit=50&access_token=${TOKEN}`);
    const d = await r.json();
    out.ads = d;
  } catch (e) { out.ads_err = String(e); }

  // 2. Ad-level insights (last 30d)
  try {
    const r = await fetch(`${GRAPH}/act_${ACCOUNT}/insights?level=ad&fields=ad_id,ad_name,spend,impressions,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,cpm,reach,frequency&date_preset=last_30d&limit=50&access_token=${TOKEN}`);
    const d = await r.json();
    out.insights_30d = d;
  } catch (e) { out.insights_err = String(e); }

  // 3. Campaigns flat
  try {
    const r = await fetch(`${GRAPH}/act_${ACCOUNT}/campaigns?fields=id,name,status,effective_status&limit=20&access_token=${TOKEN}`);
    const d = await r.json();
    out.campaigns = d;
  } catch (e) { out.campaigns_err = String(e); }

  // 4. Supabase sample (3 rows, all columns)
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await sb
      .from("your_name_table")
      .select("*")
      .order("time", { ascending: false })
      .limit(3);
    out.supabase = { rows: data, error };
  } catch (e) { out.supabase_err = String(e); }

  return NextResponse.json(out);
}
