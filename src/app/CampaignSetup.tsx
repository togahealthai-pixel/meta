"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Spinner, Badge } from "./components";
import CustomSelect from "./CustomSelect";

// ─── TORONTO TIMEZONE HELPERS ────────────────────────────────────────────────
// All date/time in this form is locked to America/Toronto regardless of user's browser timezone.

/** Current Toronto time formatted as "YYYY-MM-DDTHH:MM" for datetime-local min attribute */
const getTorontoNow = (): string =>
  new Date().toLocaleString("sv-SE", { timeZone: "America/Toronto" }).replace(" ", "T").slice(0, 16);

/** Toronto UTC offset string e.g. "-04:00" (auto-handles DST: EDT vs EST) */
const getTorontoOffset = (): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    timeZoneName: "shortOffset",
    hour: "numeric",
  }).formatToParts(new Date());
  const tz = parts.find(p => p.type === "timeZoneName")?.value || "GMT-4";
  const m = tz.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!m) return "-04:00";
  return `${m[1]}${m[2].padStart(2, "0")}:${(m[3] || "0").padStart(2, "0")}`;
};

/** Convert stored value ("2026-06-23T04:02-04:00") → input display value ("2026-06-23T04:02") */
const toDisplayVal = (stored: string): string => stored ? stored.slice(0, 16) : "";

/** Convert input display value ("2026-06-23T04:02") → stored value with Toronto offset ("2026-06-23T04:02-04:00") */
const toStoredVal = (display: string): string => display ? `${display}${getTorontoOffset()}` : "";

/** Human-readable Toronto time e.g. "4:06 AM" */
const torontoTimeLabel = (): string =>
  new Date().toLocaleTimeString("en-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit" });

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const normalizeSupabaseUrl = (url: string | null | undefined) => {
  if (!url || typeof url !== "string") return url;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!base || !url.includes("/storage/v1/object/")) return url;
  const parts = url.split("/object/");
  if (parts.length < 2) return url;
  const path = parts[1].replace(/^(public\/|authenticated\/)/, "").split("/");
  return `${base}/storage/v1/object/public/${path[0]}/${path.slice(1).join("/")}`;
};

// ─── EMPTY CONFIG — all user-input fields are blank; only UI defaults kept ────
const DEFAULT_CONFIG: any = {
  campaign: {
    name: "",
    objective: "OUTCOME_TRAFFIC",
    buying_type: "AUCTION",
    special_ad_categories: ["NONE"],
    is_adset_budget_sharing_enabled: false,
  },
  ad_set: {
    name: "",
    daily_budget: 0,
    lifetime_budget: 0,
    budget_type: "LIFETIME",
    start_time: "",
    stop_time: "",
    has_end_date: false,
    publish_immediately: false,
    age_min: 18,
    age_max: 65,
    gender: 0,
    geo_locations: { location_types: ["home", "recent"] },
    optimization_goal: "LINK_CLICKS",
    publisher_platforms: ["facebook", "instagram"],
    facebook_positions: ["feed", "story", "reels"],
    instagram_positions: ["stream", "story", "reels"],
  },
  ad: {
    id: Date.now(),
    name: "",
    type: "video",
    media_type: "video",
    headline: "",
    description: "",
    primary_text: "",
    website_url: "",
    display_link: "",
    call_to_action_type: "LEARN_MORE",
    facebook_page: "",
    instagram_account: "",
  },
  link_data: "",
};

// ─── PERSISTENCE KEYS ────────────────────────────────────────────────────────
const STORE_CONFIG   = "toga_campaign_config";
const STORE_STEP     = "toga_campaign_step";
const STORE_SEL_AD   = "toga_campaign_sel_ad";
const STORE_LAST_AD  = "toga_campaign_last_ad_text";

const CAMPAIGN_OBJECTIVES = [
  { value: "OUTCOME_AWARENESS", label: "Awareness", icon: "📢" },
  { value: "OUTCOME_TRAFFIC", label: "Traffic", icon: "🌐" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement", icon: "💬" },
  { value: "OUTCOME_LEADS", label: "Leads", icon: "📋" },
  { value: "OUTCOME_SALES", label: "Sales", icon: "🛍️" },
];
const OPTIMIZATION_GOALS = [
  { value: "OFFSITE_CONVERSIONS", label: "Conversions" },
  { value: "LINK_CLICKS", label: "Link Clicks" },
  { value: "LANDING_PAGE_VIEWS", label: "Landing Page Views" },
  { value: "REACH", label: "Reach" },
  { value: "IMPRESSIONS", label: "Impressions" },
  { value: "POST_ENGAGEMENT", label: "Post Engagement" },
  { value: "LEAD_GENERATION", label: "Lead Generation" },
  { value: "QUALITY_LEAD", label: "Quality Lead" },
  { value: "THRUPLAY", label: "ThruPlay (Video)" },
];

// Valid optimization goals per campaign objective (Meta API rules)
const OBJECTIVE_GOAL_MAP: Record<string, string[]> = {
  OUTCOME_AWARENESS:  ["REACH", "IMPRESSIONS", "THRUPLAY"],
  OUTCOME_TRAFFIC:    ["LINK_CLICKS", "LANDING_PAGE_VIEWS", "REACH", "IMPRESSIONS"],
  OUTCOME_ENGAGEMENT: ["POST_ENGAGEMENT", "LINK_CLICKS", "REACH", "IMPRESSIONS"],
  OUTCOME_LEADS:      ["LEAD_GENERATION", "QUALITY_LEAD", "LINK_CLICKS"],
  OUTCOME_SALES:      ["OFFSITE_CONVERSIONS", "LINK_CLICKS"],
};
const BUDGET_TYPES = [
  { value: "DAILY", label: "Daily Budget" },
  { value: "LIFETIME", label: "Lifetime Budget" },
];

interface CampaignSetupProps {
  onSelect: (campaign: any) => void;
  selectedId: string | null | undefined;
  selectedAd: any;
  approvedAds?: any[];
}

const STEPS = [
  { num: 1, label: "Campaign", sub: "Objective & Strategy" },
  { num: 2, label: "Ad Set", sub: "Targeting & Budget" },
  { num: 3, label: "Ad Creative", sub: "Select & Configure" },
];

export default function CampaignSetup({ onSelect, selectedId, selectedAd, approvedAds: approvedAdsProp = [] }: CampaignSetupProps) {
  const [step, setStep] = useState(1);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [config, setConfig] = useState<any>(DEFAULT_CONFIG);
  const [launching, setLaunching] = useState(false);
  const [launchStep, setLaunchStep] = useState(0);
  const [launchError, setLaunchError] = useState("");
  const [launchSuccess, setLaunchSuccess] = useState(false);
  const [hasLaunchedThisSegment, setHasLaunchedThisSegment] = useState(false);
  const [selectedApprovedAd, setSelectedApprovedAd] = useState<any>(null);
  const [hydrated, setHydrated] = useState(false);
  const lastAppliedAdRef = useRef<string | null>(null);
  const [stepErrors, setStepErrors] = useState<string[]>([]);

  const setField = (section: string, key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
    setHasLaunchedThisSegment(false);
  };

  // Fetch live campaigns
  const fetchCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const res = await fetch("/api/meta/live-campaigns");
      const data = await res.json();
      if (res.ok) setCampaigns(data || []);
    } catch {}
    finally { setCampaignsLoading(false); }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // ── Restore persisted state on mount ──
  useEffect(() => {
    try {
      const c = localStorage.getItem(STORE_CONFIG);
      const s = localStorage.getItem(STORE_STEP);
      const a = localStorage.getItem(STORE_SEL_AD);
      const t = localStorage.getItem(STORE_LAST_AD);
      if (c) setConfig(JSON.parse(c));
      if (s) setStep(JSON.parse(s));
      if (a) setSelectedApprovedAd(JSON.parse(a));
      if (t) lastAppliedAdRef.current = t;
    } catch {}
    setHydrated(true);
  }, []);

  // ── Persist config, step, selectedApprovedAd ──
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORE_CONFIG, JSON.stringify(config)); } catch {}
  }, [config, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORE_STEP, JSON.stringify(step)); } catch {}
  }, [step, hydrated]);

  useEffect(() => {
    if (!hydrated || !selectedApprovedAd) return;
    try { localStorage.setItem(STORE_SEL_AD, JSON.stringify(selectedApprovedAd)); } catch {}
  }, [selectedApprovedAd, hydrated]);

  // Apply selectedAd from Approval tab — sets media URL + type, and auto-fills ad copy from "json data" column
  useEffect(() => {
    if (!selectedAd) return;
    if (!hydrated) return;
    // Same ad already applied — keep user edits
    if (lastAppliedAdRef.current === (selectedAd.text || "")) return;
    // New ad selected — reset to empty config, set media fields only
    lastAppliedAdRef.current = selectedAd.text || "";
    try { localStorage.setItem(STORE_LAST_AD, selectedAd.text || ""); } catch {}
    const isVideo = (selectedAd.format || "").toLowerCase() === "video";

    // Parse "json data" column for ad copy auto-fill
    let adMeta: any = {};
    try {
      const raw = selectedAd["json data"];
      if (raw) {
        adMeta = typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    } catch (e) {
      console.warn("[CampaignSetup] Failed to parse ad metadata from 'json data' column:", e);
    }

    const fresh: any = {
      ...DEFAULT_CONFIG,
      campaign: { ...DEFAULT_CONFIG.campaign },
      ad_set: { ...DEFAULT_CONFIG.ad_set },
      ad: {
        ...DEFAULT_CONFIG.ad,
        id: selectedAd.id || Date.now(),
        media_type: isVideo ? "video" : "image",
        type: isVideo ? "video" : "image",
        // Auto-fill from "json data" — fallback to empty string if not present
        name: adMeta.ad_name || DEFAULT_CONFIG.ad.name || "",
        primary_text: adMeta.primary_text || DEFAULT_CONFIG.ad.primary_text || "",
        headline: adMeta.headline || DEFAULT_CONFIG.ad.headline || "",
        description: adMeta.ad_description || DEFAULT_CONFIG.ad.description || "",
        website_url: adMeta.destination_url || DEFAULT_CONFIG.ad.website_url || "",
      },
      link_data: selectedAd.text || "",
    };
    setConfig(fresh);
    setStep(1);
    setStepErrors([]);
    setSelectedApprovedAd(selectedAd);
    // Clear stored state so fresh config persists
    try {
      localStorage.setItem(STORE_CONFIG, JSON.stringify(fresh));
      localStorage.setItem(STORE_STEP, JSON.stringify(1));
    } catch {}
  }, [selectedAd, hydrated]);

  useEffect(() => { setHasLaunchedThisSegment(false); }, [selectedId, selectedAd]);

  // Reset success banner when user navigates away from step 3 so the Launch button reappears on return
  useEffect(() => { if (step !== 3) { setLaunchSuccess(false); setHasLaunchedThisSegment(false); } }, [step]);

  const handleFullLaunch = async () => {
    setLaunching(true);
    setLaunchError("");
    setLaunchSuccess(false);
    setLaunchStep(1);
    try {
      const sanitizedConfig = {
        ...config,
        ad_set: {
          ...config.ad_set,
          age_min: Number(config.ad_set?.age_min) || 18,
          age_max: Number(config.ad_set?.age_max) || 65,
          daily_budget: Number(config.ad_set?.daily_budget) || 5000,
          lifetime_budget: Number(config.ad_set?.lifetime_budget) || 50000,
        },
      };
      const res = await fetch("/api/meta/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: sanitizedConfig, campaignId: selectedId || null }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`Server error: ${text.slice(0, 100)}`); }
      if (res.ok) {
        setLaunchStep(5);
        setLaunchSuccess(true);
        setHasLaunchedThisSegment(true);
        await fetchCampaigns();
      } else {
        let msg = data.error || "Launch failed";
        if (msg.includes("1885760")) msg = "Goal Mismatch: Click 'Reset Selection' to launch as a New Pathway, or match the existing campaign's goal.";
        setLaunchError(msg);
        setLaunchStep(0);
      }
    } catch (e: any) {
      setLaunchError(e.message || "Launch failed");
      setLaunchStep(0);
    } finally { setLaunching(false); }
  };

  const validateStep = (s: number): string[] => {
    const errs: string[] = [];
    if (s === 1) {
      // Campaign name only required when creating a new campaign, not when appending to existing
      if (!selectedId && !config.campaign?.name?.trim()) errs.push("Campaign Name is required.");
    }
    if (s === 2) {
      if (!config.ad_set?.name?.trim()) errs.push("Ad Set Name is required.");
      const geo = config.ad_set?.geo_locations;
      const hasGeo = (geo?.countries?.length > 0) || (geo?.cities?.length > 0) || (geo?.regions?.length > 0);
      if (!hasGeo) errs.push("At least one Target Location is required.");
      const budget = config.ad_set?.budget_type === "DAILY" ? config.ad_set?.daily_budget : config.ad_set?.lifetime_budget;
      if (!budget || Number(budget) <= 0) errs.push("Budget amount must be greater than 0.");
      // Daily budget: Meta enforces $1/day minimum (100 cents)
      if (config.ad_set?.budget_type === "DAILY" && Number(budget) > 0 && Number(budget) < 100) {
        errs.push("Daily budget too low. Minimum is $1.00 per day.");
      }
      if (config.ad_set?.budget_type === "LIFETIME" && !config.ad_set?.has_end_date) errs.push("Lifetime budget requires an End Date. Enable 'Has End Date' and set a date at least 24 hours after start.");
      if (config.ad_set?.budget_type === "LIFETIME" && config.ad_set?.has_end_date && config.ad_set?.stop_time) {
        const startRaw = config.ad_set?.publish_immediately ? new Date() : (config.ad_set?.start_time ? new Date(config.ad_set.start_time) : new Date());
        const startDay = new Date(startRaw.getFullYear(), startRaw.getMonth(), startRaw.getDate());
        const endRaw = new Date(config.ad_set.stop_time);
        const endDay = new Date(endRaw.getFullYear(), endRaw.getMonth(), endRaw.getDate());
        const days = Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)));
        // Meta minimum: $1/day, absolute floor $2 (matches Meta's actual enforcement ~$2.15)
        const minBudgetCents = Math.max(200, days * 100);
        const minDollars = (minBudgetCents / 100).toFixed(2);
        if (Number(budget) < minBudgetCents) errs.push(`Lifetime budget too low. Minimum is $${minDollars} for a ${days}-day campaign. Please increase the budget.`);
      }
      if (!config.ad_set?.publish_immediately && !config.ad_set?.start_time) errs.push("Start Date is required. Or tick 'Post Immediately' to go live now.");
      if (!config.ad_set?.publish_immediately && config.ad_set?.start_time) {
        const chosen = new Date(config.ad_set.start_time).getTime();
        if (chosen < Date.now()) errs.push("Start Date cannot be in the past. Please select a future date and time.");
      }
    }
    if (s === 3) {
      if (!config.ad?.name?.trim()) errs.push("Ad Name is required.");
      if (!config.ad?.primary_text?.trim()) errs.push("Primary Text is required.");
      if (!config.ad?.headline?.trim()) errs.push("Headline is required.");
      const url = config.ad?.website_url?.trim();
      if (!url) {
        errs.push("Destination URL is required.");
      } else {
        try { new URL(url); if (!/^https?:\/\/.+\..+/.test(url)) throw new Error(); }
        catch { errs.push("Destination URL is invalid. Must start with https:// or http:// (e.g. https://example.com)."); }
      }
    }
    return errs;
  };

  const handleNext = () => {
    const errs = validateStep(step);
    if (errs.length > 0) { setStepErrors(errs); return; }
    setStepErrors([]);
    setStep(step + 1);
  };

  const getStatusColor = (status: string) => {
    if (status === "ACTIVE") return { color: "#16a34a", bg: "#f0fdf4", border: "#86efac" };
    if (status === "PAUSED") return { color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
    return { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" };
  };

  const selectedCampaign = campaigns.find(c => c.id === selectedId);
  const isAdVideo = config.ad?.media_type === "video" || config.ad?.type === "video";
  const mediaUrl = config.link_data || "";

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", maxWidth: 900, margin: "0 auto" }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 28, paddingTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
          Meta Ads Manager
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>Campaign Setup</h2>
        <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Build and launch your Meta Ads campaign step by step.</p>
      </div>

      {/* ── No Ad Selected Gate ── */}
      {!selectedAd && (
        <div style={{
          background: "#fff", borderRadius: 16, border: "2px dashed #bfdbfe",
          padding: "40px 32px", marginBottom: 20, textAlign: "center",
          boxShadow: "0 2px 12px rgba(37,99,235,0.06)"
        }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 16px" }}>🎯</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>Select an Ad First</h3>
          <p style={{ fontSize: 13, color: "#475569", margin: "0 0 24px", lineHeight: 1.7, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            Before setting up a campaign, go to the <strong>Approval</strong> tab and click <strong>"Launch to Facebook Ads Manager →"</strong> on the ad you want to run.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#f1f5f9", borderRadius: 10, fontSize: 13, color: "#475569", fontWeight: 600 }}>
              <span>1️⃣</span> Go to <strong>Approval</strong> tab
            </div>
            <span style={{ color: "#cbd5e1", fontSize: 18 }}>→</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#f1f5f9", borderRadius: 10, fontSize: 13, color: "#475569", fontWeight: 600 }}>
              <span>2️⃣</span> Click <strong>Launch to Facebook →</strong>
            </div>
            <span style={{ color: "#cbd5e1", fontSize: 18 }}>→</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#eff6ff", borderRadius: 10, fontSize: 13, color: "#1d4ed8", fontWeight: 700, border: "1px solid #bfdbfe" }}>
              <span>3️⃣</span> Campaign Setup opens here ✓
            </div>
          </div>
        </div>
      )}

      {/* ── Stepper ── */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "20px 28px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", opacity: selectedAd ? 1 : 0.4, pointerEvents: selectedAd ? "auto" : "none" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {STEPS.map((s, i) => {
            const done = step > s.num;
            const active = step === s.num;
            return (
              <React.Fragment key={s.num}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: done ? "pointer" : "default" }} onClick={() => { if (done) setStep(s.num); }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, fontSize: 13, fontWeight: 800, transition: "all 0.2s",
                    background: done ? "#2563eb" : active ? "#2563eb" : "#f1f5f9",
                    color: done || active ? "#fff" : "#94a3b8",
                    boxShadow: active ? "0 0 0 4px rgba(37,99,235,0.15)" : "none",
                  }}>
                    {done ? "✓" : s.num}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: active ? "#1d4ed8" : "#0f172a" }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>{s.sub}</div>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 0, width: 60, height: 2, background: step > s.num ? "#2563eb" : "#e2e8f0", borderRadius: 2, transition: "background 0.3s", margin: "0 8px", flexShrink: 0 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          STEP 1 — CAMPAIGN
      ══════════════════════════════════════════════ */}
      {step === 1 && selectedAd && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Existing Campaigns */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Existing Campaigns</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>Select one to append a new Ad Set, or start fresh below.</div>
              </div>
              <button onClick={fetchCampaigns} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "#64748b" }}>
                ↻
              </button>
            </div>
            <div style={{ padding: "12px 16px", maxHeight: 240, overflowY: "auto" }}>
              {campaignsLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Spinner size={20} /></div>
              ) : campaigns.length === 0 ? (
                <div style={{ textAlign: "center", padding: 24, color: "#94a3b8", fontSize: 13 }}>No campaigns found</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {campaigns.map((c: any) => {
                    const isSelected = selectedId === c.id;
                    const { color, bg, border } = getStatusColor(c.effective_status);
                    return (
                      <div key={c.id} onClick={() => onSelect(isSelected ? null : c)}
                        style={{
                          padding: "12px 16px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, transition: "all 0.15s",
                          border: isSelected ? "1.5px solid #2563eb" : `1px solid ${border}`,
                          background: isSelected ? "#eff6ff" : bg,
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? "#1d4ed8" : "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                          <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", marginTop: 2 }}>ID: {c.id}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: "2px 8px", borderRadius: 20, border: `1px solid ${border}` }}>{c.effective_status}</span>
                          {isSelected && <span style={{ fontSize: 12, color: "#2563eb" }}>✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Campaign Fields */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", borderRadius: "16px 16px 0 0" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{selectedId ? "Appending to Selected Campaign" : "New Campaign"}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{selectedId ? "Campaign-level fields are locked when appending." : "Configure your new campaign."}</div>
            </div>
            {selectedId ? (
              <div style={{ padding: "16px 24px" }}>
                <div style={{ padding: 16, background: "#eff6ff", borderRadius: 10, border: "1px solid #bfdbfe" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Appending to</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{selectedCampaign?.name || selectedId}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>A new Ad Set will be added to this campaign.</div>
                </div>
              </div>
            ) : (
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <Label label="Campaign Name">
                  <input value={config.campaign?.name || ""} onChange={e => setField("campaign", "name", e.target.value)} style={inputSt} />
                </Label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Label label="Campaign Objective">
                    <CustomSelect
                      value={config.campaign?.objective || ""}
                      onChange={v => {
                        setField("campaign", "objective", v);
                        // Auto-reset optimization goal if it's not valid for the new objective
                        const allowed = OBJECTIVE_GOAL_MAP[v] || [];
                        const currentGoal = config.ad_set?.optimization_goal;
                        if (currentGoal && !allowed.includes(currentGoal)) {
                          setField("ad_set", "optimization_goal", allowed[0] || "LINK_CLICKS");
                        }
                      }}
                      options={CAMPAIGN_OBJECTIVES.map(o => ({ value: o.value, label: `${o.icon} ${o.label}` }))}
                    />
                  </Label>
                  <Label label="Buying Type">
                    <CustomSelect
                      value={config.campaign?.buying_type || "AUCTION"}
                      onChange={v => setField("campaign", "buying_type", v)}
                      options={[{ value: "AUCTION", label: "Auction" }, { value: "REACH", label: "Reach" }]}
                    />
                  </Label>
                </div>
              </div>
            )}
          </div>

          {/* Placements */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", borderRadius: "16px 16px 0 0" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Placements</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>Choose where your ads appear.</div>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <PlacementsSection config={config} setField={setField} />
            </div>
          </div>

          {stepErrors.length > 0 && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
              {stepErrors.map((e, i) => <div key={i} style={{ fontSize: 13, color: "#991b1b", display: "flex", gap: 6 }}><span>•</span>{e}</div>)}
            </div>
          )}
          <NavButtons step={step} setStep={setStep} onNext={handleNext} isFirst isLast={false} />
        </div>
      )}

      {/* ══════════════════════════════════════════════
          STEP 2 — AD SET
      ══════════════════════════════════════════════ */}
      {step === 2 && selectedAd && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "visible", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <SectionHeader title="Targeting" sub="Define your audience and locations." />
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <Label label="Ad Set Name">
                <input value={config.ad_set?.name || ""} onChange={e => setField("ad_set", "name", e.target.value)} style={inputSt} />
              </Label>
              <Label label="Target Locations">
                <LocationSearch geoLocations={config.ad_set?.geo_locations} onChange={v => setField("ad_set", "geo_locations", v)} />
              </Label>
              <Label label="Optimisation Goal">
                <CustomSelect
                  value={config.ad_set?.optimization_goal || ""}
                  onChange={v => setField("ad_set", "optimization_goal", v)}
                  options={(() => {
                    const objective = config.campaign?.objective || "OUTCOME_TRAFFIC";
                    const allowed = OBJECTIVE_GOAL_MAP[objective] || OPTIMIZATION_GOALS.map(g => g.value);
                    return OPTIMIZATION_GOALS.filter(g => allowed.includes(g.value)).map(g => ({ value: g.value, label: g.label }));
                  })()}
                />
              </Label>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <SectionHeader title="Budget & Schedule" sub="Set your spending limits and campaign dates." />
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
                <Label label="Budget Type">
                  <CustomSelect
                    value={config.ad_set?.budget_type || "DAILY"}
                    onChange={v => setField("ad_set", "budget_type", v)}
                    options={BUDGET_TYPES.map(b => ({ value: b.value, label: b.label }))}
                  />
                </Label>
                <Label label={`Amount (${config.ad_set?.budget_type === "DAILY" ? "Daily" : "Lifetime"}) USD`}>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b", fontWeight: 600 }}>$</span>
                    <input type="number" style={{ ...inputSt, paddingLeft: 26 }}
                      value={config.ad_set?.budget_type === "DAILY"
                        ? (config.ad_set?.daily_budget / 100 || "")
                        : (config.ad_set?.lifetime_budget / 100 || "")}
                      onChange={e => {
                        const key = config.ad_set?.budget_type === "DAILY" ? "daily_budget" : "lifetime_budget";
                        setField("ad_set", key, Math.round(Number(e.target.value) * 100));
                      }}
                    />
                  </div>
                </Label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Post Immediately toggle */}
                <div
                  onClick={() => setField("ad_set", "publish_immediately", !config.ad_set?.publish_immediately)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    borderRadius: 12, cursor: "pointer", userSelect: "none",
                    background: config.ad_set?.publish_immediately ? "#f0fdf4" : "#f8fafc",
                    border: `2px solid ${config.ad_set?.publish_immediately ? "#16a34a" : "#e2e8f0"}`,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${config.ad_set?.publish_immediately ? "#16a34a" : "#cbd5e1"}`,
                    background: config.ad_set?.publish_immediately ? "#16a34a" : "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}>
                    {config.ad_set?.publish_immediately && (
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                        <path d="M1 4.5L4 7.5L10 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: config.ad_set?.publish_immediately ? "#16a34a" : "#374151" }}>
                      Post Immediately
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                      Skip scheduling — ad goes directly to Meta review then live
                    </div>
                  </div>
                </div>

                <Label label="Start Date (Toronto ET)">
                  <input
                    type="datetime-local"
                    value={config.ad_set?.publish_immediately ? "" : toDisplayVal(config.ad_set?.start_time || "")}
                    onChange={e => setField("ad_set", "start_time", toStoredVal(e.target.value))}
                    disabled={!!config.ad_set?.publish_immediately}
                    min={getTorontoNow()}
                    style={{
                      ...inputSt, width: "100%", boxSizing: "border-box",
                      opacity: config.ad_set?.publish_immediately ? 0.4 : 1,
                      cursor: config.ad_set?.publish_immediately ? "not-allowed" : "text",
                    }}
                  />
                  {!config.ad_set?.publish_immediately && (
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                      Toronto now: {torontoTimeLabel()} · Must be a future time
                    </div>
                  )}
                </Label>
                <Label label="End Date (Toronto ET)">
                  {config.ad_set?.has_end_date ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="datetime-local"
                        value={toDisplayVal(config.ad_set?.stop_time || "")}
                        onChange={e => setField("ad_set", "stop_time", toStoredVal(e.target.value))}
                        min={config.ad_set?.start_time ? toDisplayVal(config.ad_set.start_time) : getTorontoNow()}
                        style={{ ...inputSt, flex: 1, boxSizing: "border-box" }}
                      />
                      <button
                        type="button"
                        onClick={() => { setField("ad_set", "has_end_date", false); setField("ad_set", "stop_time", ""); }}
                        style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "#f1f5f9", border: "1.5px solid #e2e8f0", color: "#94a3b8", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                        title="Remove end date"
                      >×</button>
                    </div>
                  ) : (
                    <div
                      onClick={() => setField("ad_set", "has_end_date", true)}
                      style={{ ...inputSt, cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", gap: 8, boxSizing: "border-box" }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                      <span>Add end date</span>
                    </div>
                  )}
                </Label>
              </div>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <SectionHeader title="Demographics" sub="Define age range and gender targeting." />
            <div style={{ padding: "20px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 16 }}>
                <Label label="Gender">
                  <CustomSelect
                    value={String(config.ad_set?.gender ?? 0)}
                    onChange={v => setField("ad_set", "gender", Number(v))}
                    options={[{ value: "0", label: "All" }, { value: "1", label: "Male" }, { value: "2", label: "Female" }]}
                  />
                </Label>
                <Label label="Min Age (18–100)">
                  <input
                    type="number" min={18} max={100}
                    value={config.ad_set?.age_min ?? ""}
                    onChange={e => setField("ad_set", "age_min", e.target.value === "" ? "" : Number(e.target.value))}
                    onBlur={e => {
                      const v = Number(e.target.value);
                      if (!isNaN(v) && e.target.value !== "") setField("ad_set", "age_min", Math.min(100, Math.max(18, v)));
                    }}
                    style={inputSt}
                  />
                </Label>
                <Label label="Max Age (18–100)">
                  <input
                    type="number" min={18} max={100}
                    value={config.ad_set?.age_max ?? ""}
                    onChange={e => setField("ad_set", "age_max", e.target.value === "" ? "" : Number(e.target.value))}
                    onBlur={e => {
                      const v = Number(e.target.value);
                      if (!isNaN(v) && e.target.value !== "") setField("ad_set", "age_max", Math.min(100, Math.max(18, v)));
                    }}
                    style={inputSt}
                  />
                </Label>
              </div>
            </div>
          </div>

          {stepErrors.length > 0 && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
              {stepErrors.map((e, i) => <div key={i} style={{ fontSize: 13, color: "#991b1b", display: "flex", gap: 6 }}><span>•</span>{e}</div>)}
            </div>
          )}
          <NavButtons step={step} setStep={setStep} onNext={handleNext} isFirst={false} isLast={false} />
        </div>
      )}

      {/* ══════════════════════════════════════════════
          STEP 3 — AD CREATIVE
      ══════════════════════════════════════════════ */}
      {step === 3 && selectedAd && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Select Approved Ad */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", borderRadius: "16px 16px 0 0" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Selected Ad</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                {selectedAd ? "Ad selected from the Approval tab." : `Pick an approved creative. ${approvedAdsProp.length > 0 ? approvedAdsProp.length + " available" : ""}`}
              </div>
            </div>
            <div style={{ padding: "16px 24px" }}>
              {(() => {
                // Show only the selected ad if one was chosen from Approval tab
                const adsToShow = selectedAd ? [selectedAd] : approvedAdsProp;
                if (adsToShow.length === 0) return (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 13 }}>No approved ads yet. Go to the <b>Approval</b> tab to approve your ad creatives first.</div>
                );
                return (
                <div style={{ display: "grid", gridTemplateColumns: selectedAd ? "repeat(auto-fill, minmax(200px, 280px))" : "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
                  {adsToShow.map((ad: any, adIdx: number) => {
                    const isVid = (ad.format || "").toLowerCase() === "video";
                    // Use URL as the unique selector — IDs can be duplicated in the table
                    const isSelected = selectedApprovedAd?.text === ad.text;
                    return (
                      <div key={`${ad.id}-${adIdx}`} onClick={() => {
                        setSelectedApprovedAd(ad);
                        setConfig((prev: any) => ({ ...prev, link_data: ad.text, ad: { ...prev.ad, media_type: isVid ? "video" : "image", type: isVid ? "video" : "image" } }));
                      }}
                        style={{
                          borderRadius: 12, overflow: "hidden", cursor: "pointer", transition: "all 0.18s",
                          border: isSelected ? "2.5px solid #2563eb" : "1.5px solid #e2e8f0",
                          boxShadow: isSelected ? "0 0 0 4px rgba(37,99,235,0.12)" : "0 1px 4px rgba(0,0,0,0.04)",
                          position: "relative",
                        }}
                      >
                        {isSelected && (
                          <div style={{ position: "absolute", top: 6, right: 6, zIndex: 2, width: 20, height: 20, borderRadius: "50%", background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 800 }}>✓</div>
                        )}
                        <div style={{ background: "#0f172a", aspectRatio: "9/16", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                          {isVid ? (
                            <video src={ad.text} controls controlsList="nodownload" style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }} />
                          ) : (
                            <img src={ad.text} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as any).style.display = "none"; }} />
                          )}
                        </div>
                        <div style={{ padding: "8px 8px 6px", background: "#fff" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: isVid ? "#1d4ed8" : "#475569", display: "flex", alignItems: "center", gap: 3 }}>
                            {isVid ? "🎬" : "🖼️"} {isVid ? "Video" : "Image"}
                          </div>
                          <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>{new Date(ad.time).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                );
              })()}
            </div>
          </div>

          {/* Ad Copy */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <SectionHeader title="Ad Copy & Identity" sub="Customize the text and CTA for your ad." />
            <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Ad Name */}
              <Label label="Ad Name *">
                <input value={config.ad?.name || ""} onChange={e => setField("ad", "name", e.target.value)} style={{ ...inputSt, width: "100%", boxSizing: "border-box" }} />
              </Label>

              {/* Primary Text */}
              <Label label="Primary Text">
                <textarea value={config.ad?.primary_text || ""} onChange={e => setField("ad", "primary_text", e.target.value)}
                  style={{ ...inputSt, minHeight: 88, resize: "vertical", lineHeight: 1.6, width: "100%", boxSizing: "border-box" }} />
              </Label>

              {/* Headline */}
              <Label label="Headline">
                <input value={config.ad?.headline || ""} onChange={e => setField("ad", "headline", e.target.value)} style={{ ...inputSt, width: "100%", boxSizing: "border-box" }} />
              </Label>

              {/* CTA */}
              <Label label="Call to Action">
                <CustomSelect
                  value={config.ad?.call_to_action_type || "LEARN_MORE"}
                  onChange={v => setField("ad", "call_to_action_type", v)}
                  options={[
                    { value: "LEARN_MORE",  label: "Learn More" },
                    { value: "SHOP_NOW",    label: "Shop Now" },
                    { value: "BOOK_TRAVEL", label: "Book Now" },
                    { value: "SIGN_UP",     label: "Sign Up" },
                    { value: "CONTACT_US",  label: "Contact Us" },
                    { value: "GET_QUOTE",   label: "Get Quote" },
                    { value: "APPLY_NOW",   label: "Apply Now" },
                    { value: "DOWNLOAD",    label: "Download" },
                    { value: "SUBSCRIBE",   label: "Subscribe" },
                    { value: "GET_OFFER",   label: "Get Offer" },
                    { value: "ORDER_NOW",   label: "Order Now" },
                    { value: "WATCH_MORE",  label: "Watch More" },
                  ]}
                />
              </Label>

              {/* Ad Description */}
              <Label label="Ad Description">
                <input value={config.ad?.description || ""} onChange={e => setField("ad", "description", e.target.value)} style={{ ...inputSt, width: "100%", boxSizing: "border-box" }} />
              </Label>

              {/* Destination URL */}
              {(() => {
                const url = config.ad?.website_url?.trim();
                let urlValid = true;
                if (url) { try { new URL(url); if (!/^https?:\/\/.+\..+/.test(url)) throw new Error(); } catch { urlValid = false; } }
                return (
                  <div style={{ padding: "14px 16px", background: urlValid ? "#eff6ff" : "#fef2f2", borderRadius: 12, border: `1px solid ${urlValid ? "#bfdbfe" : "#fca5a5"}` }}>
                    <Label label="🔗 Destination URL *">
                      <input value={config.ad?.website_url || ""} onChange={e => setField("ad", "website_url", e.target.value)}
                        placeholder="https://example.com"
                        style={{ ...inputSt, background: "#fff", borderColor: urlValid ? "#93c5fd" : "#f87171", width: "100%", boxSizing: "border-box" }} />
                    </Label>
                    {url && !urlValid && (
                      <div style={{ fontSize: 11, color: "#dc2626", marginTop: 6, fontWeight: 600 }}>
                        ⚠ Invalid URL — must start with https:// or http://
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {stepErrors.length > 0 && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
              {stepErrors.map((e, i) => <div key={i} style={{ fontSize: 13, color: "#991b1b", display: "flex", gap: 6 }}><span>•</span>{e}</div>)}
            </div>
          )}
          <NavButtons step={step} setStep={setStep} onNext={handleNext} isFirst={false} isLast />

          {/* Launch Panel */}
          {launchSuccess ? (
            <div style={{ background: "#f0fdf4", borderRadius: 16, padding: "20px 24px", border: "1.5px solid #86efac", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>✓</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#15803d" }}>Ads successfully launched!</div>
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 2 }}>Your campaign is now live on Meta Ads Manager.</div>
              </div>
              <a href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${process.env.NEXT_PUBLIC_META_AD_ACCOUNT_ID}`} target="_blank" rel="noopener noreferrer"
                style={{ padding: "8px 16px", borderRadius: 9, background: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                View in Meta ↗
              </a>
            </div>
          ) : (
          <div style={{
            background: "#fff", borderRadius: 16, padding: "24px 24px",
            border: selectedId ? "1.5px solid #fde68a" : "1.5px solid #bfdbfe",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                {selectedId ? "📥" : "🚀"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 3 }}>
                  {selectedId ? `Inject to: ${selectedCampaign?.name}` : "Launch Campaign on Meta"}
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
                  {selectedId ? "New Ad Sets will be added to the selected campaign." : "Deploy your campaign, targeting, and ad creative directly to Meta Ads Manager."}
                </div>

                {launching ? (
                  <div style={{ padding: "16px 20px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <Spinner size={14} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}>
                        {launchStep === 1 ? "Uploading media assets..." : launchStep === 2 ? "Compiling schema..." : launchStep === 3 ? "Building ad sets..." : "Finalising delivery..."}
                      </span>
                    </div>
                    <div style={{ height: 5, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: "linear-gradient(90deg, #2563eb, #0ea5e9)", width: `${(launchStep / 4) * 100}%`, transition: "width 0.4s ease", borderRadius: 3 }} />
                    </div>
                  </div>
                ) : launchSuccess ? null : (
                  <button onClick={() => { const errs = validateStep(3); if (errs.length > 0) { setStepErrors(errs); return; } setStepErrors([]); handleFullLaunch(); }} disabled={launching || hasLaunchedThisSegment}
                    style={{
                      padding: "13px 32px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 800, cursor: (launching || hasLaunchedThisSegment) ? "not-allowed" : "pointer",
                      background: hasLaunchedThisSegment ? "#16a34a" : selectedId ? "#d97706" : "#2563eb",
                      color: "#fff", opacity: hasLaunchedThisSegment ? 0.85 : 1,
                      boxShadow: hasLaunchedThisSegment ? "none" : "0 4px 14px rgba(37,99,235,0.35)",
                    }}>
                    {hasLaunchedThisSegment ? "✓ Launched" : selectedId ? "Inject Ads →" : "Launch Ads on Facebook →"}
                  </button>
                )}

                {launchError && (
                  <div style={{ marginTop: 14, padding: "12px 16px", background: "#fef2f2", borderRadius: 10, border: "1px solid #fecaca", color: "#991b1b", fontSize: 13, lineHeight: 1.6 }}>
                    <b>Error: </b>{launchError}
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Nav Buttons ─────────────────────────────────────────────────────────────
function NavButtons({ step, setStep, onNext, isFirst, isLast }: { step: number; setStep: (n: number) => void; onNext?: () => void; isFirst: boolean; isLast: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: isFirst ? "flex-end" : "space-between", paddingTop: 4 }}>
      {!isFirst && (
        <button onClick={() => setStep(step - 1)}
          style={{ padding: "11px 24px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          ← Back
        </button>
      )}
      {!isLast && (
        <button onClick={onNext ?? (() => setStep(step + 1))}
          style={{ padding: "11px 28px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.3)" }}>
          Next →
        </button>
      )}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", borderRadius: "16px 16px 0 0" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{title}</div>
      <div style={{ fontSize: 11, color: "#475569", marginTop: 1, fontWeight: 500 }}>{sub}</div>
    </div>
  );
}

// ─── Label ────────────────────────────────────────────────────────────────────
function Label({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ position: "relative", display: "inline-block", width: 40, height: 22, cursor: "pointer", flexShrink: 0 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: 11, background: checked ? "#2563eb" : "#cbd5e1", transition: "background 0.2s" }}>
        <div style={{ position: "absolute", top: 3, left: checked ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
    </label>
  );
}

// ─── Input Style ─────────────────────────────────────────────────────────────
const inputSt: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 9,
  border: "1.5px solid #e2e8f0",
  background: "#fff",
  fontSize: 13,
  fontWeight: 500,
  color: "#0f172a",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color 0.15s",
  fontFamily: "inherit",
};

// ─── Placements Section ───────────────────────────────────────────────────────
const FB_POSITIONS = [
  { value: "feed", label: "Feed" },
  { value: "story", label: "Stories" },
  { value: "reels", label: "Reels" },
  { value: "right_hand_column", label: "Right Column" },
  { value: "video_feeds", label: "Video Feeds" },
];
const IG_POSITIONS = [
  { value: "stream", label: "Feed" },
  { value: "story", label: "Stories" },
  { value: "reels", label: "Reels" },
  { value: "explore", label: "Explore" },
];

function PlacementsSection({ config, setField }: { config: any; setField: (s: string, k: string, v: any) => void }) {
  const platforms: string[] = config.ad_set?.publisher_platforms || [];
  const fbPositions: string[] = config.ad_set?.facebook_positions || [];
  const igPositions: string[] = config.ad_set?.instagram_positions || [];
  const isFb = platforms.includes("facebook");
  const isIg = platforms.includes("instagram");

  const togglePlatform = (p: string) => {
    const next = platforms.includes(p) ? platforms.filter(x => x !== p) : [...platforms, p];
    if (next.length === 0) return;
    setField("ad_set", "publisher_platforms", next);
  };
  const togglePos = (key: string, pos: string, current: string[]) => {
    const next = current.includes(pos) ? current.filter(p => p !== pos) : [...current, pos];
    if (next.length === 0) return;
    setField("ad_set", key, next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Platform</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { id: "facebook", label: "Facebook", emoji: "f", color: "#1877f2" },
            { id: "instagram", label: "Instagram", emoji: "▣", color: "#e1306c" },
          ].map(p => {
            const on = platforms.includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => togglePlatform(p.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 10, cursor: "pointer",
                  border: on ? `2px solid ${p.color}` : "1.5px solid #e2e8f0",
                  background: on ? p.color : "#fff",
                  color: on ? "#fff" : "#475569",
                  fontWeight: 700, fontSize: 13, transition: "all 0.15s",
                  boxShadow: on ? `0 4px 12px ${p.color}40` : "none",
                }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, background: on ? "rgba(255,255,255,0.2)" : p.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>{p.emoji}</span>
                {p.label}
                {on && <span>✓</span>}
              </button>
            );
          })}
        </div>
      </div>
      {isFb && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#1877f2", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Facebook Positions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {FB_POSITIONS.map(pos => {
              const on = fbPositions.includes(pos.value);
              return (
                <button key={pos.value} type="button" onClick={() => togglePos("facebook_positions", pos.value, fbPositions)}
                  style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: on ? "1.5px solid #1877f2" : "1.5px solid #e2e8f0", background: on ? "#eff6ff" : "#fff", color: on ? "#1877f2" : "#64748b" }}>
                  {on && "✓ "}{pos.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {isIg && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#e1306c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Instagram Positions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {IG_POSITIONS.map(pos => {
              const on = igPositions.includes(pos.value);
              return (
                <button key={pos.value} type="button" onClick={() => togglePos("instagram_positions", pos.value, igPositions)}
                  style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: on ? "1.5px solid #e1306c" : "1.5px solid #e2e8f0", background: on ? "#fff0f6" : "#fff", color: on ? "#e1306c" : "#64748b" }}>
                  {on && "✓ "}{pos.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LocationSearch ───────────────────────────────────────────────────────────
interface LocationSearchProps { geoLocations: any; onChange: (v: any) => void; }

function LocationSearch({ geoLocations, onChange }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  const openDropdown = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setShowDropdown(true);
  };

  // Build pills from countries, cities, and regions
  const selectedPills: any[] = [];
  if (geoLocations?.countries) {
    geoLocations.countries.forEach((c: any) => {
      const key = typeof c === "object" ? c.code : c;
      selectedPills.push({ key, name: key, type: "country" });
    });
  }
  if (geoLocations?.cities) {
    geoLocations.cities.forEach((c: any) => {
      selectedPills.push({ key: c.key, name: c.name, type: "city" });
    });
  }
  if (geoLocations?.regions) {
    geoLocations.regions.forEach((r: any) => {
      selectedPills.push({ key: r.key, name: r.name, type: "region" });
    });
  }

  useEffect(() => {
    if (!query.trim()) { setResults([]); setShowDropdown(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/meta/locations?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data || []); if ((data || []).length > 0) openDropdown();
      } catch {} finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const handleSelect = (item: any) => {
    const newGeo = { ...geoLocations, location_types: geoLocations?.location_types || ["home", "recent"] };

    if (item.type === "country") {
      // Add country — remove any cities/regions in this country to avoid Meta overlap error
      const existing: string[] = newGeo.countries || [];
      if (!existing.includes(item.key)) {
        newGeo.countries = [...existing, item.key];
      }
      newGeo.cities = (newGeo.cities || []).filter((c: any) => c.country_code !== item.key);
      newGeo.regions = (newGeo.regions || []).filter((r: any) => r.country_code !== item.key);
      if (!newGeo.cities.length) delete newGeo.cities;
      if (!newGeo.regions.length) delete newGeo.regions;

    } else if (item.type === "city" || item.type === "neighborhood") {
      // Add city — remove parent country to avoid Meta overlap error
      const cityObj = { key: item.key, name: item.name, country_code: item.country_code };
      const existing = newGeo.cities || [];
      if (!existing.find((c: any) => c.key === item.key)) {
        newGeo.cities = [...existing, cityObj];
      }
      if (newGeo.countries) {
        newGeo.countries = newGeo.countries.filter((c: any) => c !== item.country_code);
        if (!newGeo.countries.length) delete newGeo.countries;
      }

    } else if (item.type === "region") {
      // Add region — remove parent country to avoid Meta overlap error
      const regionObj = { key: item.key, name: item.name, country_code: item.country_code };
      const existing = newGeo.regions || [];
      if (!existing.find((r: any) => r.key === item.key)) {
        newGeo.regions = [...existing, regionObj];
      }
      if (newGeo.countries) {
        newGeo.countries = newGeo.countries.filter((c: any) => c !== item.country_code);
        if (!newGeo.countries.length) delete newGeo.countries;
      }
    }

    onChange(newGeo); setQuery(""); setShowDropdown(false);
  };

  const handleRemove = (pill: any) => {
    const newGeo = { ...geoLocations };
    if (pill.type === "country") {
      newGeo.countries = (newGeo.countries || []).filter((c: any) => c !== pill.key);
      if (!newGeo.countries.length) delete newGeo.countries;
    } else if (pill.type === "city") {
      newGeo.cities = (newGeo.cities || []).filter((c: any) => c.key !== pill.key);
      if (!newGeo.cities.length) delete newGeo.cities;
    } else if (pill.type === "region") {
      newGeo.regions = (newGeo.regions || []).filter((r: any) => r.key !== pill.key);
      if (!newGeo.regions.length) delete newGeo.regions;
    }
    onChange(newGeo);
  };

  return (
    <div style={{ position: "relative" }}>
      <div ref={inputRef} style={{ position: "relative" }}>
        <input value={query} onChange={e => setQuery(e.target.value)} onFocus={() => results.length > 0 && openDropdown()} onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="Search countries, cities, regions..." style={{ ...inputSt, paddingRight: 36 }} />
        {loading && <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}><Spinner size={13} /></div>}
      </div>
      {showDropdown && results.length > 0 && (
        <div style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 9999, maxHeight: 320, overflowY: "auto" }}>
          {results.map((r: any) => (
            <div key={r.key} onMouseDown={e => { e.preventDefault(); handleSelect(r); }}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}
              onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ fontWeight: 600, color: "#0f172a" }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{r.type?.toUpperCase()} · {r.country_name || r.country_code}</div>
            </div>
          ))}
        </div>
      )}
      {selectedPills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {selectedPills.map((p: any) => (
            <div key={`${p.type}-${p.key}`} style={{ display: "flex", alignItems: "center", gap: 5, background: "#eff6ff", color: "#1d4ed8", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1px solid #bfdbfe" }}>
              {p.type === "country" ? "🌐" : p.type === "city" ? "🏙️" : "🗺️"} {p.name}
              <button onClick={e => { e.preventDefault(); handleRemove(p); }} style={{ border: "none", background: "transparent", color: "#3b82f6", cursor: "pointer", fontSize: 13, padding: 0, marginLeft: 2, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
