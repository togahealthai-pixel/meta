import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TOKEN = process.env.META_ACCESS_TOKEN!;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID!;
const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. List campaigns (no filter)
  try {
    const r = await fetch(`${GRAPH}/act_${ACCOUNT}/campaigns?fields=id,name,status,effective_status,objective&limit=20&access_token=${TOKEN}`);
    const d = await r.json();
    results.campaigns = d;
  } catch (e: unknown) { results.campaigns_error = String(e); }

  // 2. List ads directly from account (no nested, no filter)
  try {
    const r = await fetch(`${GRAPH}/act_${ACCOUNT}/ads?fields=id,name,status,effective_status&limit=20&access_token=${TOKEN}`);
    const d = await r.json();
    results.ads_flat = d;
  } catch (e: unknown) { results.ads_flat_error = String(e); }

  // 3. Try one ad's insights if any exist
  const adsFlat = (results.ads_flat as { data?: {id:string}[] })?.data;
  if (adsFlat && adsFlat.length > 0) {
    const firstId = adsFlat[0].id;
    try {
      const r = await fetch(`${GRAPH}/${firstId}?fields=id,name,effective_status,creative{id,title,body,call_to_action_type},insights.date_preset(last_30d){spend,impressions,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,cpm,reach}&access_token=${TOKEN}`);
      const d = await r.json();
      results.first_ad_full = d;
    } catch (e: unknown) { results.first_ad_error = String(e); }
  }

  // 4. Campaigns with nested adsets->ads (what the report uses)
  try {
    const fields = "id,name,status,effective_status,adsets{id,name,ads{id,name,status,effective_status}}";
    const r = await fetch(`${GRAPH}/act_${ACCOUNT}/campaigns?fields=${fields}&limit=10&access_token=${TOKEN}`);
    const d = await r.json();
    results.campaigns_nested = d;
  } catch (e: unknown) { results.campaigns_nested_error = String(e); }

  // 5. Supabase your_name_table sample
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await sb
      .from("your_name_table")
      .select(`id, text, story, format, "Approved", "json data"`)
      .order("time", { ascending: false })
      .limit(5);
    results.supabase_sample = { data, error };
  } catch (e: unknown) { results.supabase_error = String(e); }

  return NextResponse.json(results, { status: 200 });
}
