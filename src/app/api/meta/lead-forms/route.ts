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

export async function POST(request: Request) {
  const pageId    = process.env.META_PAGE_ID;
  const pageToken = process.env.META_PAGE_TOKEN;

  if (!pageId || !pageToken) {
    return NextResponse.json({ error: "META_PAGE_ID or META_PAGE_TOKEN not configured" }, { status: 500 });
  }

  try {
    const { name, redirectType, redirectUrl, presetQuestions, customQuestions } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Form name is required" }, { status: 400 });
    }

    // Build questions array
    const PRESET_TYPE_MAP: Record<string, string> = {
      FULL_NAME: "FULL_NAME",
      EMAIL: "EMAIL",
      PHONE: "PHONE",
    };
    const questions: any[] = [];
    const selectedPresets: string[] = Array.isArray(presetQuestions) ? presetQuestions : ["FULL_NAME", "EMAIL", "PHONE"];
    for (const pid of selectedPresets) {
      if (PRESET_TYPE_MAP[pid]) questions.push({ type: PRESET_TYPE_MAP[pid] });
    }
    if (Array.isArray(customQuestions)) {
      for (const text of customQuestions) {
        if (text?.trim()) questions.push({ type: "CUSTOM", label: text.trim() });
      }
    }
    if (questions.length === 0) {
      return NextResponse.json({ error: "At least one question is required" }, { status: 400 });
    }

    const thankYouPage = redirectUrl?.trim()
      ? {
          title: "Thank you!",
          body: redirectType === "whatsapp"
            ? "Click below to chat with us on WhatsApp."
            : "We will be in touch soon.",
          website_url: redirectUrl.trim(),
          button_type: "VIEW_WEBSITE",
          button_text: redirectType === "whatsapp" ? "Chat on WhatsApp" : "Visit Website",
        }
      : undefined;

    const body: any = {
      name: name.trim(),
      questions,
      privacy_policy: {
        url: "https://togahhealth.ai/privacy-policy",
        link_text: "Privacy Policy",
      },
      locale: "EN_US",
      access_token: pageToken,
    };

    if (thankYouPage) body.thank_you_page = thankYouPage;

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/leadgen_forms`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || "Failed to create form" }, { status: 500 });
    }
    return NextResponse.json({ id: data.id, name: name.trim(), status: "ACTIVE" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const pageToken = process.env.META_PAGE_TOKEN;

  if (!pageToken) {
    return NextResponse.json({ error: "META_PAGE_TOKEN not configured" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const formId = searchParams.get("formId");

    if (!formId) {
      return NextResponse.json({ error: "formId is required" }, { status: 400 });
    }

    // Meta doesn't support HTTP DELETE on lead gen forms — archive instead
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${formId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: true, access_token: pageToken }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || "Failed to delete form" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
