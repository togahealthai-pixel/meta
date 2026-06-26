import { NextResponse } from "next/server";

export async function GET() {
  const pageId    = process.env.META_PAGE_ID;
  const pageToken = process.env.META_PAGE_TOKEN;

  if (!pageId || !pageToken) {
    return NextResponse.json({ error: "META_PAGE_ID or META_PAGE_TOKEN not configured" }, { status: 500 });
  }

  try {
    // Step 1: fetch all forms
    const formsRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/leadgen_forms?fields=id,name,status&access_token=${pageToken}`
    );
    const formsData = await formsRes.json();
    if (!formsRes.ok) {
      return NextResponse.json({ error: formsData.error?.message || "Failed to fetch forms" }, { status: 500 });
    }

    const forms: { id: string; name: string }[] = formsData.data || [];

    // Step 2: fetch leads from each form in parallel
    const results = await Promise.all(
      forms.map(async (form) => {
        try {
          const res = await fetch(
            `https://graph.facebook.com/v21.0/${form.id}/leads?fields=id,created_time,field_data&limit=100&access_token=${pageToken}`
          );
          const data = await res.json();
          const leads = (data.data || []).map((lead: any) => ({
            id: lead.id,
            created_time: lead.created_time,
            form_id: form.id,
            form_name: form.name,
            fields: Object.fromEntries(
              (lead.field_data || []).map((f: any) => [f.name, f.values?.[0] || ""])
            ),
          }));
          return leads;
        } catch {
          return [];
        }
      })
    );

    // Step 3: merge, sort newest first, collect all unique field keys
    const allLeads = results.flat().sort(
      (a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime()
    );

    const fieldKeys = Array.from(
      new Set(allLeads.flatMap((l) => Object.keys(l.fields)))
    );

    return NextResponse.json({ leads: allLeads, fieldKeys });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
