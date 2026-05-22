// @ts-nocheck
// Phase 3c styling migration complete; full TypeScript typing of ~83 useState hooks
// and inferred any-types is a separate, follow-on task.
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Badge,
  Card,
  MetricCard,
  SectionTitle,
  WorkflowStep,
  EmptyState,
  Spinner,
  SecondaryButton
} from "./components";
import {
  User,
  LogOut,
  LogIn,
  ShieldCheck,
  LayoutGrid,
  BarChart3,
  Sparkles,
  CheckCircle2,
  Settings2,
  Rocket,
  FileText,
  Share2,
  Mail,
  Send,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  CircleDot,
  DollarSign,
  Eye,
  Gauge,
  Award,
  Activity,
  Inbox,
  RefreshCw,
  CheckCircle,
  Maximize2,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Video,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import CampaignSetup from "./CampaignSetup";
import SocialDash from "./SocialDash";
import { AppShell } from "@/components/layout/app-shell";
import { Sidebar as HubSidebarShell } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

const TAB_ICONS = {
  overview: LayoutGrid,
  analysis: BarChart3,
  create: Sparkles,
  approval: CheckCircle2,
  campaigns: Settings2,
  live_campaigns: Rocket,
  reports: FileText,
  "social-dash": Share2,
  newsletter: Mail,
  outreach: Send,
};

// ─── CONSTANTS ───────────────────────────────────────────────
const API_URL = "/api/trigger-n8n";

const TABS = [
  { id: "overview", label: "Overview", icon: "▦" },
  { id: "analysis", label: "Ads Analysis", icon: "◎" },
  { id: "create", label: "Create Ad", icon: "◈" },
  { id: "approval", label: "Approval", icon: "◉" },
  { id: "campaigns", label: "Campaign Setup", icon: "◷" },
  { id: "live_campaigns", label: "Running Campaign", icon: "🚀" },

  { id: "reports", label: "Reports", icon: "◧" },
  { id: "social-dash", label: "Social-Dash", icon: "🎨" },
  { id: "newsletter", label: "Newsletter", icon: "📰", externalLink: "https://newsletter-omega-eight.vercel.app/newsletter/generate" },
  { id: "outreach", label: "Outreach", icon: "✉️", externalLink: "https://outreach-umber.vercel.app" },
];

const TOPICS = [
  "Advanced Orthopedics",
  "Cosmetic Dentistry",
  "Ophthalmic Surgery",
  "Preventative Cardiology",
  "Pediatric Wellness",
  "Clinical Excellence",
  "Patient Care Protocols",
];

// ─── HELPERS ─────────────────────────────────────────────────
/**
 * Ensures Supabase storage URLs use the current project's hostname.
 * This fixes issues where n8n or old data might use a different Supabase instance.
 */
const normalizeSupabaseUrl = (url) => {
  if (!url || typeof url !== "string") return url;
  const currentUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!currentUrl) return url;

  // If it's a Supabase storage URL
  if (url.includes("/storage/v1/object/")) {
    // Extract filename and bucket
    const parts = url.split("/object/");
    if (parts.length < 2) return url;

    const pathParts = parts[1].replace(/^(public\/|authenticated\/)/, "").split("/");
    const bucket = pathParts[0];
    const filename = pathParts.slice(1).join("/");

    if (!bucket || !filename) return url;

    // Reconstruct strictly using current credentials
    const newUrl = `${currentUrl}/storage/v1/object/public/${bucket}/${filename}`;

    if (url !== newUrl) {
      console.log(`[Strict URL Fix] ${url} -> ${newUrl}`);
    }
    return newUrl;
  }
  return url;
};



// ─── MAIN DASHBOARD ──────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [selectedTopic, setSelectedTopic] = useState(TOPICS[1]);
  const [user, setUser] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  // Analysis
  useEffect(() => {
    console.log("[Diagnostics] Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  }, []);

  // Analysis state
  const [analysisStatus, setAnalysisStatus] = useState("idle");
  // idle | generating | waiting | done | error
  const [analysisData, setAnalysisData] = useState(null);

  const [analysisError, setAnalysisError] = useState("");
  const [pendingAnalysisTopic, setPendingAnalysisTopic] = useState(null);

  // Ad creation
  const [adStatus, setAdStatus] = useState("idle");
  // idle | generating | waiting | done | error
  const [adData, setAdData] = useState(null);

  // Approval & launch
  const [approved, setApproved] = useState(false);
  const [budget, setBudget] = useState(50);
  const [duration, setDuration] = useState(7);
  const [launchStatus, setLaunchStatus] = useState("idle");
  // idle | launching | live | error

  // Campaigns
  const [campaigns, setCampaigns] = useState([]);
  const [stoppedIds, setStoppedIds] = useState([]);
  const [stopStatus, setStopStatus] = useState("idle");
  // idle | stopping | stopped | error

  // Report
  const [reportStatus, setReportStatus] = useState("idle");
  // idle | generating | done | error



  // Shared error
  const [webhookError, setWebhookError] = useState("");

  // Approval queue
  const [scheduledAds, setScheduledAds] = useState([]);
  const [approvedAds, setApprovedAds] = useState([]);
  const [rejectedAds, setRejectedAds] = useState([]);
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [adCardStatuses, setAdCardStatuses] = useState({});
  const [schedulePickerOpen, setSchedulePickerOpen] = useState(null);
  const [scheduleDates, setScheduleDates] = useState({});

  // ── Ad Videos state ──
  const [adVideosRefreshKey, setAdVideosRefreshKey] = useState(Date.now());
  const [adVideosLoading, setAdVideosLoading] = useState(false);

  // ── Supabase reports state ──
  const [sbRows, setSbRows] = useState([]);
  const [sbLoading, setSbLoading] = useState(true);
  const [sbTriggeringId, setSbTriggeringId] = useState(null);
  const [sbSessionTriggered, setSbSessionTriggered] = useState(new Set());
  const [sbToasts, setSbToasts] = useState([]);
  const [sbExpandedInsights, setSbExpandedInsights] = useState({});
  const [sbAdsConfigOpen, setSbAdsConfigOpen] = useState({});
  const [sbAdsConfigs, setSbAdsConfigs] = useState({});
  const [sbModalReport, setSbModalReport] = useState(null);
  const [sbModalTab, setSbModalTab] = useState("competitors");
  const [sbSortField, setSbSortField] = useState("score");
  const [sbSortDir, setSbSortDir] = useState("desc");

  const [createTabAdsConfig, setCreateTabAdsConfig] = useState({
    totalAds: 1,
    videoCount: 1,
    imageCount: 0,
    items: [
      { id: Date.now(), type: "video", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", idea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5" }
    ]
  });
  const [createTabConfigOpen, setCreateTabConfigOpen] = useState(false);
  const [pendingAds, setPendingAds] = useState([]);
  const [adTableLinks, setAdTableLinks] = useState({});
  // Stores { "1": { text: "...", format: "Video", Approved: bool }, ... }
  const [allApprovedAds, setAllApprovedAds] = useState([]);
  const [approvingId, setApprovingId] = useState(null);
  const [selectedAdForDetails, setSelectedAdForDetails] = useState(null);
  const [workflowStatus, setWorkflowStatus] = useState("");
  const [isStatusPolling, setIsStatusPolling] = useState(false);
  const [isEditingAd, setIsEditingAd] = useState(false);
  const [editingAdData, setEditingAdData] = useState({});
  const [isSavingAd, setIsSavingAd] = useState(false);
  const [isRetryingAd, setIsRetryingAd] = useState(false);
  const [sentIdeaIds, setSentIdeaIds] = useState({});
  const [generatedIdeas, setGeneratedIdeas] = useState({});
  const [retryPrompt, setRetryPrompt] = useState("");
  const [isRetryingSubmit, setIsRetryingSubmit] = useState(false);
  const [selectedMetaCampaign, setSelectedMetaCampaign] = useState(null);
  const [launchAdCandidate, setLaunchAdCandidate] = useState(null);

  // Custom Media Upload
  const [customUploadLoading, setCustomUploadLoading] = useState(false);
  const [customUploadError, setCustomUploadError] = useState("");

  // Live Campaigns State
  const [liveCampaigns, setLiveCampaigns] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState(new Set());
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Edit Campaign / Ad Set Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editType, setEditType] = useState(null); // "Campaign" or "AdSet"
  const [editData, setEditData] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Meta Reports State
  const [metaInsights, setMetaInsights] = useState(null);
  const [metaCampaignInsights, setMetaCampaignInsights] = useState([]);
  const [metaReportsLoading, setMetaReportsLoading] = useState(false);
  const [metaReportsError, setMetaReportsError] = useState("");
  const [selectedCampaignForReports, setSelectedCampaignForReports] = useState(null);

  const addSbToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setSbToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setSbToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const fetchAdTableLinks = useCallback(async () => {
    setAdVideosLoading(true);

    // 1. Fetch from Storage (Global Lookup)
    // We create a map of filename -> storage info to verify existence and fix bucket mismatches
    const storageLookup = new Map();
    try {
      const buckets = ["AD1", "AD2", "AD3", "AD4", "AD5"];
      for (const bucket of buckets) {
        const { data: files } = await supabase.storage.from(bucket).list('', { limit: 100 });
        if (files && files.length > 0) {
          files.forEach(file => {
            if (file.name === ".emptyFolderPlaceholder") return;
            // Map filename to the first bucket we find it in (or prioritize later buckets if needed)
            storageLookup.set(file.name, {
              bucket,
              time: file.created_at,
              publicUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${file.name}`
            });
          });
        }
      }
    } catch (e) {
      console.warn("Storage sync failed:", e);
    }

    // 2. Fetch from Database
    const { data: dbData, error: dbError } = await supabase
      .from("your_name_table")
      .select("id, text, time, format, Approved, \"json data\"")
      .order("time", { ascending: false });

    if (dbError && dbError.code !== "PGRST116") {
      console.error("Database fetch error:", dbError);
    }

    const latest = {};
    const approvedList = [];
    const validPending = [];

    console.log(`[Diagnostics] DB rows found: ${dbData?.length || 0}`);
    console.log(`[Diagnostics] Storage lookup size: ${storageLookup.size}`);

    // Process DB data
    (dbData || []).forEach(row => {
      const normalizedText = normalizeSupabaseUrl(row.text);
      if (!normalizedText) return;

      const fileName = normalizedText.split("/").pop();
      const storageInfo = storageLookup.get(fileName);

      // We prioritize the database record. If storageLookup found it, we use the storage URL.
      // If storageLookup is empty (e.g. due to list permissions), we still show the ad using the normalized URL.
      const finalUrl = storageInfo ? storageInfo.publicUrl : normalizedText;
      const entry = { ...row, originalText: row.text, text: finalUrl };

      if (row.Approved && row.Approved !== "false") {
        approvedList.push(entry);
      } else {
        validPending.push(entry);
        if (!latest[row.id]) {
          latest[row.id] = entry;
        }
      }

      if (!storageInfo && storageLookup.size > 0) {
        console.warn(`[Diagnostics] File not detected in storage list, but showing from DB: ${fileName}`);
      }
    });


    console.log(`[Diagnostics] Valid pending found: ${validPending.length}`);
    console.log(`[Diagnostics] Approved found: ${approvedList.length}`);

    // Select top 3 videos and top 2 images for the Create Ad tab
    const topVideos = validPending.filter(a => (a.format || "").toLowerCase() === "video").slice(0, 3);
    const topImages = validPending.filter(a => (a.format || "").toLowerCase() !== "video").slice(0, 2);

    console.log(`[Diagnostics] Top Videos: ${topVideos.length}, Top Images: ${topImages.length}`);
    setPendingAds([...topVideos, ...topImages]);

    setAdTableLinks(latest);
    setAllApprovedAds(approvedList);


    setAdVideosLoading(false);
    setAdVideosRefreshKey(Date.now());
  }, [addSbToast]);




  const fetchLiveCampaigns = useCallback(async () => {
    setLiveLoading(true);
    setLiveError("");
    try {
      const res = await fetch("/api/meta/live-campaigns");
      const data = await res.json();
      if (res.ok) {
        setLiveCampaigns(data || []);
      } else {
        setLiveError(data.error || "Failed to fetch live campaigns");
      }
    } catch (e) {
      setLiveError("Failed to connect to API");
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const handleUpdateStatus = async (id, type, status, action) => {
    if (action === "delete" && !confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) return;

    setUpdatingStatusId(id);
    try {
      const res = await fetch("/api/meta/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, action }),
      });
      const data = await res.json();
      if (res.ok) {
        addSbToast(`${type} ${action === "delete" ? "deleted" : "updated"} successfully!`);
        fetchLiveCampaigns(); // Refresh
      } else {
        addSbToast(data.error || `Failed to update ${type}`, "error");
      }
    } catch (e) {
      addSbToast("Network error", "error");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleEditCampaign = async (campaignId) => {
    setEditModalOpen(true);
    setEditType("Campaign");
    setEditLoading(true);
    setEditError("");
    try {
      const res = await fetch(`/api/meta/campaign-details?campaignId=${campaignId}`);
      const data = await res.json();
      if (res.ok) {
        setEditData(data.campaign);
      } else {
        setEditError(data.error || "Failed to fetch details");
      }
    } catch (e) {
      setEditError("Network error");
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditAdSet = async (campaignId, adSetId) => {
    setEditModalOpen(true);
    setEditType("AdSet");
    setEditLoading(true);
    setEditError("");
    try {
      const res = await fetch(`/api/meta/campaign-details?campaignId=${campaignId}`);
      const data = await res.json();
      if (res.ok) {
        const adSet = data.adSets?.find(a => a.id === adSetId);
        if (adSet) {
          setEditData(adSet);
        } else setEditError("Ad Set not found");
      } else {
        setEditError(data.error || "Failed to fetch details");
      }
    } catch (e) {
      setEditError("Network error");
    } finally {
      setEditLoading(false);
    }
  };

  const updateTargeting = (key, value) => {
    if (!editData) return;
    let t = editData.targeting;
    if (typeof t === 'string') {
      try { t = JSON.parse(t); } catch (e) { t = {}; }
    } else {
      t = { ...t };
    }

    if (key === 'age_min') t.age_min = parseInt(value, 10) || 18;
    if (key === 'age_max') t.age_max = parseInt(value, 10) || 65;
    if (key === 'gender') {
      if (value === '0') {
        delete t.genders;
      } else {
        t.genders = [parseInt(value, 10)];
      }
    }
    if (key === 'countries') {
      if (!t.geo_locations) t.geo_locations = {};
      t.geo_locations.countries = value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    }

    setEditData({ ...editData, targeting: t });
  };

  const saveEdit = async () => {
    setEditSaving(true);
    setEditError("");
    try {
      const payload = {};
      if (editType === "Campaign") {
        payload.campaignId = editData.id;
        payload.campaignData = {
          name: editData.name,
        };
      } else if (editType === "AdSet") {
        payload.adSetId = editData.id;
        let parsedTargeting = editData.targeting;
        if (typeof parsedTargeting === 'string') {
          try {
            parsedTargeting = JSON.parse(parsedTargeting);
          } catch (e) {
            setEditError("Invalid JSON in targeting");
            setEditSaving(false);
            return;
          }
        }
        payload.adSetData = {
          name: editData.name,
          daily_budget: parseInt(editData.daily_budget, 10),
          targeting: parsedTargeting
        };
        if (editData.end_time) {
          payload.adSetData.end_time = editData.end_time;
        }
      }

      const res = await fetch("/api/meta/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        addSbToast(`${editType} updated successfully!`);
        setEditModalOpen(false);
        fetchLiveCampaigns();
      } else {
        setEditError(data.error || "Update failed");
      }
    } catch (e) {
      setEditError("Network error");
    } finally {
      setEditSaving(false);
    }
  };

  const fetchMetaInsights = useCallback(async () => {
    setMetaReportsLoading(true);
    setMetaReportsError("");
    try {
      const res = await fetch("/api/meta/reports");
      const data = await res.json();
      if (res.ok) {
        setMetaInsights(data.account || { spend: 0, impressions: 0, reach: 0, linkClicks: 0, inline_link_click_ctr: 0, leads: 0 });
        setMetaCampaignInsights(data.campaigns || []);
      } else {
        setMetaReportsError(data.error || "Failed to fetch Meta insights");
      }
    } catch (e) {
      setMetaReportsError("Failed to connect to reporting API");
    } finally {
      setMetaReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function fetchReports() {
      const { data, error } = await supabase
        .from("reports_json")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Supabase error:", error);
        addSbToast("Failed to fetch reports", "error");
      }
      setSbRows(data || []);
      setSbLoading(false);
    }
    fetchReports();
    fetchAdTableLinks();

    // Realtime: auto-fetch new/updated/deleted rows
    const channel = supabase
      .channel("reports_json_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports_json" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setSbRows((prev) => [payload.new, ...prev]);
            addSbToast("New report received!");

            // Link to active analysis if topic matches
            const newReport = parseSbReport(payload.new);
            setPendingAnalysisTopic(currentTopic => {
              if (currentTopic && newReport.topic === currentTopic) {
                setAnalysisData({ ...newReport, id: payload.new.id });
                setAnalysisStatus("done");
                addSbToast("Analysis completed and loaded!");
                return null; // Reset pending topic
              }
              return currentTopic;
            });
          } else if (payload.eventType === "UPDATE") {
            setSbRows((prev) =>
              prev.map((r) => (r.id === payload.new.id ? payload.new : r))
            );
          } else if (payload.eventType === "DELETE") {
            setSbRows((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addSbToast]);

  useEffect(() => {
    // Check local session (Bypassing Supabase Auth)
    const checkLocalSession = () => {
      const isLoggedIn = localStorage.getItem("toga_auth_session") === "true";
      const userEmail = localStorage.getItem("toga_user_email") || "togahealthai@gmail.com";

      if (isLoggedIn) {
        setUser({ email: userEmail });
        setIsAuthenticating(false);
      } else {
        // No local session found, redirect to login
        router.push("/login");
      }
    };

    checkLocalSession();

    // Listen for storage changes (e.g. logout in another tab)
    const handleStorageChange = (e) => {
      if (e.key === "toga_auth_session" && e.newValue !== "true") {
        setUser(null);
        router.push("/login");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [router]);

  const handleSignOut = async () => {
    try {
      localStorage.removeItem("toga_auth_session");
      localStorage.removeItem("toga_user_email");
      addSbToast("Signed out successfully");
      router.push("/login");
    } catch (e) {
      console.error("Logout error:", e);
      addSbToast("Failed to sign out", "error");
    }
  };

  useEffect(() => {
    if (tab === "live_campaigns") {
      fetchLiveCampaigns();
    }
    if (tab === "reports" || tab === "overview") {
      fetchMetaInsights();
    }
  }, [tab, fetchLiveCampaigns, fetchMetaInsights]);

  // ── Polling workflow status from Supabase status_table (id: 1) ──
  useEffect(() => {
    let interval;
    if (isStatusPolling || adStatus === "waiting") {
      interval = setInterval(async () => {
        const { data, error } = await supabase
          .from("status_table")
          .select("status")
          .eq("id", 1)
          .single();

        if (error) {
          console.error("Status polling error:", error);
          return;
        }

        if (data) {
          const newStatus = data.status || "";
          setWorkflowStatus(newStatus);

          // Refresh if any part of the workflow completed or if overall completion reached
          const isIntermediateDone = newStatus.toLowerCase().includes("completed") && !workflowStatus?.toLowerCase().includes("completed");
          const isFullyDone = newStatus.toLowerCase().includes("completed");

          if (isIntermediateDone || isFullyDone) {
            fetchAdTableLinks(); // Refresh the grid
          }

          if (isFullyDone) {
            setIsStatusPolling(false);
            setAdStatus("idle");
            addSbToast("Ads generation completed!", "success");
          }
        }
      }, 3000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isStatusPolling, adStatus, fetchAdTableLinks, addSbToast]);

  function parseSbReport(row) {
    let rd = row.report_data;
    try {
      if (typeof rd === "string") rd = JSON.parse(rd);
      // Handle array-wrapped format: [{...}] → {...}
      if (Array.isArray(rd)) rd = rd[0] || {};
      return rd || {};
    } catch { return {}; }
  }

  const sbReports = sbRows.map((row) => ({ row, report: parseSbReport(row) }));
  const sbTotalReports = sbRows.length;
  const sbTotalCompetitors = sbReports.reduce((s, { report }) => s + (report.competitors_table || []).length, 0);
  const sbHighThreats = sbReports.reduce((s, { report }) => s + (report.competitors_table || []).filter((c) => c.threat === "high").length, 0);
  const sbPendingAds = sbRows.filter((r) => !r.ads_workflow_triggered).length;

  // ── Ads config helpers ──
  const VIDEO_TYPES = ["Reel", "Story", "Feed Post", "Carousel"];
  const DURATIONS = ["20 seconds", "28 seconds", "32 seconds", "36 seconds", "40 seconds"];
  const AUDIO_STYLES = ["Background Music", "Voiceover Only", "Music + Voiceover", "No Audio"];
  const VIDEO_STYLES = ["Bold & Colorful", "Cinematic", "Minimal & Clean", "Dark & Moody", "Neon / Glow", "Hand-drawn / Sketch"];
  const VOICE_OPTIONS = {
    male: [
      { label: "Markmont", id: "rTOopItG6FIkKMIVxsl5" },
      { label: "John", id: "lXyLz3Gu0YqdG8RfvIyZ" },
    ],
    female: [
      { label: "Adhalina", id: "i2SoWWnAm3qCyr53Jenw" },
      { label: "Clara", id: "k9KXsQFJqzAoomTCOrJB" },
    ],
  };

  function getAdsConfig(reportId) {
    return sbAdsConfigs[reportId] || { numAds: 1, videos: [{ videoType: "Reel", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", videoIdea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5" }] };
  }

  function updateAdsConfig(reportId, updater) {
    setSbAdsConfigs((prev) => {
      const current = prev[reportId] || { numAds: 1, videos: [{ videoType: "Reel", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", videoIdea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5" }] };
      return { ...prev, [reportId]: updater(current) };
    });
  }

  function setNumAds(reportId, num) {
    updateAdsConfig(reportId, (cfg) => {
      const n = Math.max(1, Math.min(5, num));
      const videos = [...cfg.videos];
      while (videos.length < n) videos.push({ videoType: "Reel", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", videoIdea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5" });
      return { ...cfg, numAds: n, videos: videos.slice(0, n) };
    });
  }

  function updateVideoConfig(reportId, idx, field, value) {
    updateAdsConfig(reportId, (cfg) => {
      const videos = [...cfg.videos];
      videos[idx] = { ...videos[idx], [field]: value };
      return { ...cfg, videos };
    });
  }

  function updateCreateTabTotalAds(num) {
    if (num > 5) {
      addSbToast("Maximum of 5 total ads allowed", "error");
      return;
    }
    const n = Math.max(1, num);
    setCreateTabAdsConfig((prev) => {
      const currentTotal = prev.items.length;
      let newItems = [...prev.items];

      if (n > currentTotal) {
        for (let i = 0; i < n - currentTotal; i++) {
          // Default to video if space allows, else image
          const vCount = newItems.filter(x => x.type === "video").length;
          const type = vCount < 3 ? "video" : "image";

          if (type === "video") {
            newItems.push({ id: Date.now() + i, type: "video", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", idea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5" });
          } else {
            // Check if we can add image
            const iCount = newItems.filter(x => x.type === "image").length;
            if (iCount < 2) {
              newItems.push({ id: Date.now() + i, type: "image", imageStyle: "Bold & Colorful", idea: "" });
            } else {
              // If we reach 3V and 2I, we can't add more anyway due to n=5 limit
              break;
            }
          }
        }
      } else {
        newItems = newItems.slice(0, n);
      }

      const vCount = newItems.filter(x => x.type === "video").length;
      const iCount = newItems.filter(x => x.type === "image").length;
      return { totalAds: newItems.length, videoCount: vCount, imageCount: iCount, items: newItems };
    });
  }

  function setCreateTabItemType(idx, type) {
    setCreateTabAdsConfig((prev) => {
      const currentItem = prev.items[idx];
      if (currentItem.type === type) return prev;

      if (type === "video" && prev.videoCount >= 3) {
        addSbToast("Maximum of 3 Videos allowed", "error");
        return prev;
      }
      if (type === "image" && prev.imageCount >= 2) {
        addSbToast("Maximum of 2 Images allowed", "error");
        return prev;
      }

      const newItems = [...prev.items];
      if (type === "video") {
        newItems[idx] = { id: newItems[idx].id, type: "video", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", idea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5" };
      } else {
        newItems[idx] = { id: newItems[idx].id, type: "image", imageStyle: "Bold & Colorful", idea: "" };
      }
      const vCount = newItems.filter(x => x.type === "video").length;
      const iCount = newItems.filter(x => x.type === "image").length;
      return { ...prev, videoCount: vCount, imageCount: iCount, items: newItems };
    });
  }

  function updateCreateTabItemField(idx, field, value) {
    setCreateTabAdsConfig((prev) => {
      const newItems = [...prev.items];
      newItems[idx] = { ...newItems[idx], [field]: value };
      return { ...prev, items: newItems };
    });
  }


  async function handleApproveAd(row) {
    if (!row) return;
    setApprovingId(row.id + "_" + row.time);

    let error;
    if (row.isVirtual) {
      // This is a virtual entry from Storage Sync. We need to create a real record in the database.
      const { error: insError } = await supabase
        .from("your_name_table")
        .insert([{
          id: row.id,
          text: row.text,
          time: row.time,
          format: row.format,
          Approved: "true"
        }]);
      error = insError;
    } else {
      // RLS is now disabled, so we can use the client directly
      const { error: updError } = await supabase
        .from("your_name_table")
        .update({ Approved: "true" })
        .eq("text", row.originalText || row.text);
      error = updError;
    }

    if (error) {
      console.error("Approval error:", error);
      addSbToast(`Approval failed: ${error.message || 'Unknown error'}`, "error");
    } else {
      addSbToast("Ad approved successfully!");
      await fetchAdTableLinks();
    }



    setApprovingId(null);
  }


  async function handleSaveEdits(ad) {
    if (!ad) return;
    setIsSavingAd(true);

    const oldJson = typeof ad["json data"] === "string" ? JSON.parse(ad["json data"]) : (ad["json data"] || {});

    // Construct the new schema
    const updatedJsonData = {
      campaign: {
        name: editingAdData.campaignName || (oldJson.campaign?.name || "Untitled Campaign")
      },
      ad: {
        id: oldJson.ad?.id || oldJson.ads?.[0]?.id || Date.now(),
        name: editingAdData.adName || (oldJson.ad?.name || oldJson.ads?.[0]?.name || "Untitled Ad"),
        type: oldJson.ad?.type || oldJson.ads?.[0]?.type || "video",
        headline: editingAdData.headline || (oldJson.ad?.headline || oldJson.ads?.[0]?.headline || "No headline provided."),
        call_to_action_type: editingAdData.ctaType || (oldJson.ad?.call_to_action_type || oldJson.ads?.[0]?.call_to_action_type || "WATCH_MORE"),
        website_url: editingAdData.linkData || (oldJson.ad?.website_url || oldJson.link_data || ad.text || "")
      },
      link_data: editingAdData.linkData || (oldJson.link_data || ad.text || "")
    };

    const { error } = await supabase
      .from("your_name_table")
      .update({ "json data": JSON.stringify(updatedJsonData) })
      .match({ id: ad.id, time: ad.time });

    if (error) {
      console.error("Save error:", error);
      addSbToast("Failed to save changes", "error");
    } else {
      addSbToast("Changes saved successfully!");
      setIsEditingAd(false);
      await fetchAdTableLinks();
    }
    setIsSavingAd(false);
  }

  async function handleRetryAdSubmit(ad) {
    if (!ad || !retryPrompt) return;
    setIsRetryingSubmit(true);

    const adData = typeof ad["json data"] === "string" ? JSON.parse(ad["json data"]) : (ad["json data"] || {});

    try {
      const res = await fetch("https://n8n.srv881198.hstgr.cloud/webhook/3ba2e5c5-b680-48b8-a905-6386b74a28d9", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: retryPrompt,
          ad_id: ad.id,
          original_data: adData,
          media_url: ad.text,
          timestamp: new Date().toISOString()
        }),
      });

      if (res.ok) {
        addSbToast("Retry request sent successfully!");
        setIsRetryingAd(false);
        setRetryPrompt("");
      } else {
        addSbToast("Failed to send retry request", "error");
      }
    } catch (e) {
      console.error("Retry error:", e);
      addSbToast("Failed to reach retry webhook", "error");
    }
    setIsRetryingSubmit(false);
  }

  async function handleRefreshAdVideos() {
    await fetchAdTableLinks();
  }

  async function handleTriggerAds(reportId, reportData) {
    const config = getAdsConfig(reportId);
    setSbTriggeringId(reportId);
    try {
      const res = await fetch("/api/trigger-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId, report_data: reportData, ads_config: config }),
      });
      const result = await res.json();
      if (result.success) {
        setSbSessionTriggered((prev) => new Set([...prev, reportId]));
        addSbToast("Ads workflow triggered successfully!");
      } else {
        addSbToast("Failed to trigger. Try again.", "error");
      }
    } catch {
      addSbToast("Failed to trigger. Try again.", "error");
    }
    setSbTriggeringId(null);
  }

  async function handleCreateTabTriggerAds() {
    if (!analysisData) {
      addSbToast("No analysis data available. Run Ads Analysis first.", "error");
      return;
    }
    const config = createTabAdsConfig;
    setAdStatus("generating");
    setWorkflowStatus("Triggering...");
    setWebhookError("");
    try {
      const res = await fetch("/api/trigger-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_id: analysisData?.id || crypto.randomUUID(),
          report_data: analysisData,
          ads_config: config
        }),
      });
      const result = await res.json();
      if (result.success) {
        addSbToast("Ads workflow triggered successfully!");
        setAdStatus("waiting");
        setIsStatusPolling(true); // Initiate polling
      } else {
        setAdStatus("error");
        setWebhookError(result.error || "Failed to trigger ad generation");
        addSbToast("Failed to trigger generation. Try again.", "error");
      }
    } catch (e) {
      setAdStatus("error");
      setWebhookError(e.message || "Failed to reach API");
      addSbToast("Failed to trigger generation. Try again.", "error");
    }
  }

  function formatSbDate(iso) {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const mon = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
    return `${day} ${mon} ${d.getFullYear()}`;
  }

  function truncateSb(str, len = 200) {
    if (!str) return "";
    return str.length > len ? str.slice(0, len) + "..." : str;
  }

  function toggleSbSort(field) {
    if (sbSortField === field) setSbSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSbSortField(field); setSbSortDir("desc"); }
  }

  // ── Reusable webhook caller ──
  async function callWebhook(payload, setStatus) {
    setStatus("generating");
    setWebhookError("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-action": payload.action || ""
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({ ok: true }));
      const resultData = Array.isArray(data) ? data[0] : data;
      const isValid =
        resultData &&
        typeof resultData === "object" &&
        !resultData.rawResponse &&
        Object.keys(resultData).length > 0;
      return isValid ? resultData : null;
    } catch (e) {
      setStatus("error");
      setWebhookError(e.message || "Could not reach n8n");
      console.error("Webhook error:", e);
      return null;
    }
  }

  // ── Action 1: Competitor Analysis ──
  async function runCompetitorAnalysis() {
    setAnalysisData(null);
    setAnalysisError("");
    setAnalysisStatus("generating");
    setPendingAnalysisTopic(selectedTopic);
    await new Promise((r) => setTimeout(r, 100));

    const result = await callWebhook({
      action: "competitor_analysis",
      topic: selectedTopic,
      timestamp: new Date().toISOString(),
    }, setAnalysisStatus);

    if (result) {
      if (result.error && result.isTimeout) {
        // If it was a timeout, don't show error, just stay in waiting
        setAnalysisStatus("waiting");
        addSbToast("Trigger successful, waiting for results...");
      } else {
        setAnalysisData(result);
        setAnalysisStatus("done");
        setPendingAnalysisTopic(null);
      }
    } else if (analysisStatus !== "error") {
      setAnalysisStatus("waiting");
    }
  }

  // ── Action 2: Generate Ad ──
  async function createAdFromAnalysis() {
    setAdData(null);
    const result = await callWebhook({
      action: "generate_ad",
      topic: selectedTopic,
      executive_summary: analysisData?.executive_summary || "",
      top_hooks: analysisData?.hooks_table || [],
      competitors: (analysisData?.competitors_table || []).slice(0, 5),
      gaps: analysisData?.gaps_table || [],
      timestamp: new Date().toISOString(),
    }, setAdStatus);
    if (result) {
      console.log("n8n ad response:", result);
      setAdData(result);
      setAdStatus("done");
    } else if (adStatus !== "error") {
      setAdStatus("waiting");
    }
  }

  // ── Action 3: Launch Meta Ad ──
  async function launchMetaAd() {
    const result = await callWebhook({
      action: "launch_meta_ad",
      adData: adData,
      budget: budget,
      duration: duration,
      timestamp: new Date().toISOString(),
    }, setLaunchStatus);
    // Optimistic: add to campaigns list regardless of n8n response
    setCampaigns(prev => [...prev, {
      id: `C${Date.now()}`,
      name: adData?.topic || "New Campaign",
      platform: "Meta",
      budget: `€${budget}/day`,
      duration: `${duration} days`,
      status: "launching",
      spend: "€0",
      ctr: "—",
      clicks: 0,
      leads: 0,
    }]);
    if (result) setLaunchStatus("live");
    setTab("campaigns");
  }

  // ── Action 4: Stop Campaign ──
  async function stopCampaign(campaignId, campaignName) {
    setStoppedIds(prev => [...prev, campaignId]); // optimistic
    await callWebhook({
      action: "stop_campaign",
      campaignId: campaignId,
      campaignName: campaignName,
      timestamp: new Date().toISOString(),
    }, setStopStatus);
  }

  // ── Action 5: Generate Report ──
  async function generateReport() {
    const result = await callWebhook({
      action: "generate_report",
      period: "manual",
      timestamp: new Date().toISOString(),
    }, setReportStatus);
    if (result) setReportStatus("done");
  }



  // ── Receive n8n result ──
  function receiveAnalysisResult(data) {
    setAnalysisData(data);
    setAnalysisStatus("done");
  }

  // ── DEV: simulate n8n response ──
  function simulateAnalysisResponse() {
    receiveAnalysisResult({
      success: true,
      executive_summary: "Clinical excellence and patient-centric care are the primary drivers for local healthcare providers. Digital presence is currently under-utilized, offering a significant opportunity to capture high-intent search traffic through specialized service campaigns.",
      competitors_table: [
        { name: "Global Health Clinic", ads: 14, score: 72, threat: "High", angle: "Surgical precision", hook: "JCI accredited care you can trust" },
        { name: "Wellness Prime", ads: 9, score: 85, threat: "High", angle: "Preventative focus", hook: "Your health journey, optimized" },
      ],
      hooks_table: [
        { pattern: "Treatment results", example: "Before treatment → Patient recovery", reason: "Visual results validate clinical efficacy", score: "8.1" },
      ],
      market_insights_table: [
        { field: "Dominant platform", value: "Meta (Instagram Reels)" },
        { field: "Average CPC", value: "€1.20" },
        { field: "Top ad format", value: "Video reel — 28 sec" },
        { field: "Trending style", value: "Anime & illustrative (+3×)" },
        { field: "Peak booking time", value: "Thu–Sat, 6–10 pm" },
        { field: "Avg. competitor spend", value: "€60/day" },
      ],
      gaps_table: [
        { gap: "Quality vs price", opportunity: "Counter discount-led ads with award proof", priority: "High", impact: "High CTR, lower CPA" },
        { gap: "Orthopedic specialization", opportunity: "Target 'hip replacement surgery' keywords", priority: "Medium", impact: "High-intent patient traffic" },
        { gap: "Seasonal hooks missing", opportunity: "Halloween piercing + costume combo campaign", priority: "Medium", impact: "Timely spike in bookings" },
        { gap: "Diagnostic Focus", opportunity: "Target 'MRI and diagnostic imaging' keywords", priority: "Medium", impact: "High-intent service volume" },
        { gap: "Patient Transparency", opportunity: "Virtual facility tour & specialist profiles", priority: "Low", impact: "Clinical trust & patient retention" },
      ],
    });
  }

  // ── Approval helpers ──
  function getAdStatus(adId) {
    return adCardStatuses[adId] || "pending";
  }

  function approveAd(ad) {
    setAdCardStatuses(prev => ({ ...prev, [ad.id]: "approved" }));
    setApprovedAds(prev => [...prev.filter(a => a.id !== ad.id), ad]);
    setSchedulePickerOpen(null);
  }

  function rejectAd(adId) {
    setAdCardStatuses(prev => ({ ...prev, [adId]: "rejected" }));
    setApprovedAds(prev => prev.filter(a => a.id !== adId));
    setScheduledAds(prev => prev.filter(a => a.id !== adId));
    setSchedulePickerOpen(null);
  }

  function scheduleAd(ad) {
    const dateInfo = scheduleDates[ad.id];
    if (!dateInfo?.date) return;
    const scheduledAt = `${dateInfo.date} ${dateInfo.time || "09:00"}`;
    setAdCardStatuses(prev => ({ ...prev, [ad.id]: "scheduled" }));
    setScheduledAds(prev => [
      ...prev.filter(a => a.id !== ad.id),
      { ...ad, scheduledAt },
    ]);
    setSchedulePickerOpen(null);
  }

  function undoAction(adId) {
    setAdCardStatuses(prev => ({ ...prev, [adId]: "pending" }));
    setApprovedAds(prev => prev.filter(a => a.id !== adId));
    setScheduledAds(prev => prev.filter(a => a.id !== adId));
    setRejectedAds(prev => prev.filter(a => a.id !== adId));
  }

  function approveAllPending() {
    (adData?.ad_scripts || [])
      .filter(a => getAdStatus(a.id) === "pending")
      .forEach(ad => approveAd(ad));
  }

  function rejectAllPending() {
    (adData?.ad_scripts || [])
      .filter(a => getAdStatus(a.id) === "pending")
      .forEach(ad => rejectAd(ad.id));
  }

  function countByStatus(status) {
    return (adData?.ad_scripts || []).filter(a => getAdStatus(a.id) === status).length;
  }

  function simulateAdResponse() {
    setAdData({
      topic: selectedTopic,
      headline: "Where Anime Meets Skin — Your Story, Inked Forever",
      body: "Our award-winning artists bring your favourite anime characters to life. Bold lines, vivid colour, unmatched detail. Book your consultation today.",
      cta: "Book Now",
      format: "Video reel — 28 sec",
      platform: "Meta (FB + IG)",
    });
    setAdStatus("done");
  }

  const topicBtnCls = (t) =>
    `text-xs px-3.5 py-1.5 rounded-full cursor-pointer transition-all duration-200 ${
      selectedTopic === t
        ? "border-[1.5px] border-indigo-600 bg-indigo-50 text-indigo-600 font-medium"
        : "border border-zinc-200 bg-transparent text-zinc-500 font-normal"
    }`;

  // ─────────────────────────────────────────────────────────────
  if (isAuthenticating || !user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-50 gap-4">
        <Spinner size={30} color="#4F46E5" />
        <div className="text-sm font-semibold text-zinc-500 tracking-wide">
          Loading dashboard…
        </div>
      </div>
    );
  }

  return (
    <AppShell
      sidebar={
        <HubSidebarShell
          sections={[
            {
              items: TABS.map((t) => ({
                key: t.id,
                label: t.label,
                icon: TAB_ICONS[t.id],
                external: !!t.externalLink,
                href: t.externalLink,
                onClick: t.externalLink ? undefined : () => setTab(t.id),
                active: !t.externalLink && tab === t.id,
              })),
            },
          ]}
        />
      }
      topBar={
        <TopBar
          title={TABS.find((t) => t.id === tab)?.label || "Overview"}
          search={false}
          actions={
            user ? (
              <div className="flex items-center gap-2.5">
                <div className="w-[34px] h-[34px] rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-indigo-600">
                  <User size={16} />
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-bold text-zinc-900">Admin</div>
                  <div className="text-[11px] text-zinc-500">{user.email}</div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-3 py-[7px] rounded-md border border-zinc-200 bg-white text-red-600 text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all duration-150 hover:bg-red-50 hover:border-red-600"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => router.push("/login")}
                className="px-[18px] py-2.5 rounded-md border-none bg-indigo-600 text-white text-[13px] font-bold cursor-pointer flex items-center gap-[7px] shadow-[0_4px_12px_rgba(79,70,229,0.25)] transition-all duration-150 hover:bg-indigo-700"
              >
                <LogIn size={15} /> Sign In
              </button>
            )
          }
        />
      }
    >
      <div className="font-sans text-zinc-900 max-w-[1440px] mx-auto px-6 pt-6 pb-16">

      {/* ═══════════════════════════════════════════════════════
          OVERVIEW
      ═══════════════════════════════════════════════════════ */}
      {tab === "overview" && (() => {
        // Compute dynamic top statistics
        const activeCampaigns = metaCampaignInsights.filter(c => c.effective_status === 'ACTIVE').length;
        const totalCampaignsRendered = activeCampaigns || campaigns.length; // fallback
        const pendingAuthCount = (adData?.ad_scripts || []).filter(a => getAdStatus(a.id) === "pending").length;

        // Determine Top Performer
        let topPerformer = null;
        if (metaCampaignInsights.length > 0) {
          topPerformer = [...metaCampaignInsights].sort((a, b) => {
            const ctrA = parseFloat(a.insights?.inline_link_click_ctr || 0);
            const ctrB = parseFloat(b.insights?.inline_link_click_ctr || 0);
            return ctrB - ctrA;
          })[0];
        }

        const spendTotal = parseFloat(metaInsights?.spend || 0);
        const impressionsTotal = parseFloat(metaInsights?.impressions || 0);
        const cpm = impressionsTotal > 0 ? (spendTotal / impressionsTotal * 1000).toFixed(2) : "0.00";

        const quickActions = [
          { label: "Run competitor analysis", desc: "Assess competitive blind spots in the market.", icon: BarChart3, target: "analysis" },
          { label: "Create new ad setup", desc: "Generate scripts and creative logic using AI.", icon: Sparkles, target: "create" },
          { label: "Review approvals queue", desc: "Finalize ad creatives and prepare launch configurations.", icon: CheckCircle2, target: "approval" },
          { label: "Monitor live tracking", desc: "Review granular performance tables inside Reports.", icon: FileText, target: "reports" },
        ];

        return (
          <div className="animate-fade-in pb-12 space-y-8">
            {/* Page header */}
            <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm text-zinc-500">Real-time performance and pending actions across your Meta Ads account.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Synced just now
              </div>
            </header>

            {/* KPI ribbon */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Live campaigns */}
              <div className="group bg-white border border-zinc-200 rounded-xl p-5 transition-all duration-200 hover:border-zinc-300 hover:shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Live campaigns</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Rocket size={15} />
                  </span>
                </div>
                <div className="text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums">{totalCampaignsRendered}</div>
                <div className="mt-1.5 text-xs text-zinc-500">Meta Ads API</div>
              </div>

              {/* Market intel */}
              <div className="group bg-white border border-zinc-200 rounded-xl p-5 transition-all duration-200 hover:border-zinc-300 hover:shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Market intel</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <BarChart3 size={15} />
                  </span>
                </div>
                <div className="text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums">{sbRows.length}</div>
                <div className="mt-1.5 text-xs text-zinc-500">Available reports</div>
              </div>

              {/* Pending approval */}
              <div className="group bg-white border border-zinc-200 rounded-xl p-5 transition-all duration-200 hover:border-zinc-300 hover:shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Pending approval</span>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${pendingAuthCount > 0 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                    <AlertCircle size={15} />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums">{pendingAuthCount}</div>
                  {pendingAuthCount > 0 && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </div>
                <div className="mt-1.5 text-xs text-zinc-500">{pendingAuthCount > 0 ? "Action needed" : "All clear"}</div>
              </div>

              {/* Stopped */}
              <div className="group bg-white border border-zinc-200 rounded-xl p-5 transition-all duration-200 hover:border-zinc-300 hover:shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Stopped</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                    <CircleDot size={15} />
                  </span>
                </div>
                <div className="text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums">{stoppedIds.length}</div>
                <div className="mt-1.5 text-xs text-zinc-500">This session</div>
              </div>
            </section>

            {/* Body panels */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Health + Top Performer */}
              <div className="lg:col-span-2 space-y-6">
                {/* Account Health */}
                <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                        <Activity size={14} />
                      </span>
                      <h3 className="text-sm font-semibold text-zinc-900">Account Health</h3>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Live
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100">
                    <div className="px-6 py-5">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">
                        <DollarSign size={11} className="text-zinc-400" /> Total Spend
                      </div>
                      <div className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">${spendTotal.toFixed(2)}</div>
                    </div>
                    <div className="px-6 py-5">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">
                        <Eye size={11} className="text-zinc-400" /> Total Reach
                      </div>
                      <div className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">{impressionsTotal.toLocaleString()}</div>
                    </div>
                    <div className="px-6 py-5">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">
                        <Gauge size={11} className="text-zinc-400" /> Avg CPM
                      </div>
                      <div className="text-2xl font-semibold tracking-tight text-indigo-600 tabular-nums">${cpm}</div>
                    </div>
                  </div>
                </div>

                {/* Top Performer */}
                <div className="bg-white border border-zinc-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                        <Award size={14} />
                      </span>
                      <h3 className="text-sm font-semibold text-zinc-900">Top Performing Campaign</h3>
                    </div>
                    {topPerformer && (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                        <TrendingUp size={12} className="text-emerald-600" />
                        Best CTR
                      </span>
                    )}
                  </div>

                  {topPerformer ? (
                    <div>
                      <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-[10px] font-medium uppercase tracking-wider mb-2">
                        {topPerformer.objective?.replace(/_/g, " ")}
                      </div>
                      <div className="text-base font-semibold text-zinc-900 mb-5">{topPerformer.name}</div>
                      <div className="grid grid-cols-3 gap-6 pt-5 border-t border-zinc-100">
                        <div>
                          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1">Spend</div>
                          <div className="text-base font-semibold text-zinc-900 tabular-nums">${parseFloat(topPerformer.insights?.spend || 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1">CTR (Link)</div>
                          <div className="text-base font-semibold text-indigo-600 tabular-nums">{parseFloat(topPerformer.insights?.inline_link_click_ctr || 0).toFixed(2)}%</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1">Conversions</div>
                          <div className="text-base font-semibold text-emerald-600 tabular-nums">{topPerformer.insights?.leads || 0}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <div className="text-sm text-zinc-500">No campaigns are currently tracking performance data.</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Quick Actions */}
              <div className="bg-white border border-zinc-200 rounded-xl p-6">
                <div className="flex items-center gap-2.5 mb-5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
                    <Sparkles size={14} />
                  </span>
                  <h3 className="text-sm font-semibold text-zinc-900">Quick Actions</h3>
                </div>
                <div className="flex flex-col gap-1">
                  {quickActions.map((action, i) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => setTab(action.target)}
                        className="group flex items-center justify-between text-left -mx-2 px-3 py-3 rounded-lg transition-all duration-150 hover:bg-zinc-50"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <Icon size={14} />
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-900">{action.label}</div>
                            <div className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{action.desc}</div>
                          </div>
                        </div>
                        <ArrowRight size={14} className="flex-shrink-0 text-zinc-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
          ADS ANALYSIS
      ═══════════════════════════════════════════════════════ */}
      {tab === "analysis" && (
        <div className="animate-fade-in flex flex-col lg:flex-row gap-5">
          {/* History Sidebar */}
          <div className="w-full lg:w-[250px] lg:flex-shrink-0 lg:sticky lg:top-5 bg-white border border-zinc-200 rounded-lg p-[18px] flex flex-col gap-3.5 h-fit shadow-sm">
            <div className="text-[13px] font-semibold text-zinc-900 border-b border-zinc-200 pb-2.5 flex items-center gap-1.5">
              <span>📜</span> Analysis History
            </div>
            <div className="flex flex-col gap-2.5 max-h-[70vh] overflow-y-auto pr-1">
              {[...sbRows].reverse().map((row) => {
                const report = parseSbReport(row);
                return (
                  <div key={row.id} className="p-3 rounded-md border-[0.5px] border-zinc-100 bg-zinc-50 transition-[transform,border-color] duration-150 hover:border-indigo-600">
                    <div className="font-semibold text-zinc-900 text-[11px] mb-0.5">{report.topic || "Untitled Run"}</div>
                    <div className="text-[9px] text-zinc-500 mb-2.5 flex items-center gap-1">
                      <span>📅</span> {formatSbDate(row.created_at)}
                    </div>
                    <button
                      onClick={() => {
                        setAnalysisData({ ...report, id: row.id });
                        setAnalysisStatus("done");
                        setSelectedTopic(report.topic || TOPICS[1]);
                        addSbToast("Loaded history: " + report.topic);
                      }}
                      className="w-full py-1.5 rounded-sm border-none bg-indigo-50 text-indigo-600 text-[11px] font-semibold cursor-pointer transition-all duration-150 hover:bg-indigo-600 hover:text-white"
                    >
                      Use Result
                    </button>
                  </div>
                );
              })}
              {sbRows.length === 0 && <div className="text-[11px] text-zinc-400 text-center p-5">No previous runs found</div>}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            <Card className="mb-3.5">
              <SectionTitle>Topic for analysis</SectionTitle>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {TOPICS.map((t) => (
                  <button
                    key={t}
                    className={topicBtnCls(t)}
                    onClick={() => setSelectedTopic(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <SectionTitle>n8n Workflow Steps</SectionTitle>
              <WorkflowStep
                step="1"
                label="Trigger webhook"
                sub={`POST → ${API_URL}/competitor_analysis`}
                active={analysisStatus === "idle"}
                done={analysisStatus !== "idle" || !!analysisData}
              />
              <WorkflowStep
                step="2"
                label="n8n receives & scrapes competitors"
                sub="Apify actor — IG, FB, Google local studios"
                active={analysisStatus === "generating" || analysisStatus === "waiting"}
                done={analysisStatus === "done" || !!analysisData}
              />
              <WorkflowStep
                step="3"
                label="Claude analyzes patterns in n8n"
                sub="CTR, creative type, offers, copy angles"
                active={analysisStatus === "waiting"}
                done={analysisStatus === "done" || !!analysisData}
              />
              <WorkflowStep
                step="4"
                label="n8n POSTs results back to dashboard"
                sub="Results appear below"
                active={false}
                done={analysisStatus === "done" || !!analysisData}
              />

              {/* TRIGGER BUTTON — shown when idle, error, or done (allow re-run) */}
              {(analysisStatus === "idle" || analysisStatus === "done" || analysisStatus === "error") && (
                <div>
                  <button
                    onClick={runCompetitorAnalysis}
                    disabled={false}
                    className="w-full px-[18px] py-[11px] rounded-md border-none bg-indigo-600 text-white text-[13px] font-medium cursor-pointer transition-all duration-200 hover:bg-indigo-800 hover:-translate-y-px"
                  >
                    {analysisStatus === "done"
                      ? "Re-run competitor analysis"
                      : "Trigger n8n webhook — run competitor analysis"}
                  </button>
                  {analysisStatus === "error" && (
                    <div className="mt-2 text-xs text-red-700">
                      Could not reach n8n: {analysisError || webhookError}. Please try again.
                    </div>
                  )}
                </div>
              )}

              {/* GENERATING */}
              {analysisStatus === "generating" && (
                <div className="animate-slide-up bg-indigo-50 rounded-md p-4 text-center">
                  <div className="flex items-center justify-center gap-2.5 mb-1.5">
                    <Spinner size={14} />
                    <span className="text-[13px] text-indigo-600 font-medium">
                      Sending to n8n...
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-violet-700">
                    POST {API_URL}
                  </div>
                </div>
              )}

              {/* WAITING */}
              {analysisStatus === "waiting" && (
                <div className="animate-slide-up">
                  <div className="bg-amber-50 border-[0.5px] border-amber-600 rounded-md p-3.5 mb-3">
                    <div className="text-[13px] text-amber-600 font-medium mb-1.5 flex items-center gap-2">
                      <Spinner size={12} color="#D97706" />
                      Webhook triggered — waiting for n8n response
                    </div>
                    <div className="text-xs text-amber-700 leading-relaxed">
                      n8n scraping + analyzing competitors. When
                      done, n8n must POST results back here.
                      <br />
                      <strong>
                        Add a &ldquo;Respond to Webhook&rdquo; node
                        in n8n
                      </strong>{" "}
                      with the JSON format below.
                    </div>
                  </div>

                  {/* Expected response format */}
                  <div className="bg-zinc-50 rounded-md px-3.5 py-3 mb-3">
                    <div className="text-[11px] font-semibold text-zinc-500 mb-2 uppercase tracking-wider">
                      Expected n8n response format
                    </div>
                    <pre className="text-[11px] text-zinc-900 m-0 leading-relaxed overflow-auto">
                      {`{
  "success": true,
  "executive_summary": "...",
  "competitors_table": [
    { "name": "...", "ads": 0, "score": 0,
      "threat": "...", "angle": "...", "hook": "..." }
  ],
  "hooks_table": [
    { "pattern": "...", "example": "...",
      "reason": "...", "score": "..." }
  ],
  "market_insights_table": [
    { "field": "...", "value": "..." }
  ],
  "gaps_table": [
    { "gap": "...", "opportunity": "...",
      "priority": "...", "impact": "..." }
  ]
}`}
                    </pre>
                  </div>

                  <SecondaryButton onClick={simulateAnalysisResponse}>
                    ⚙ Simulate n8n response — UI testing only
                  </SecondaryButton>
                </div>
              )}

              {/* ERROR */}
              {analysisStatus === "error" && (
                <div className="animate-slide-up">
                  <div className="bg-red-50 border-[0.5px] border-red-500 rounded-md p-3.5 mb-3">
                    <div className="text-[13px] text-red-700 font-medium mb-1">
                      Webhook trigger failed
                    </div>
                    <div className="text-xs text-red-700">
                      {analysisError}
                    </div>
                  </div>
                  <SecondaryButton
                    onClick={() => setAnalysisStatus("idle")}
                  >
                    Reset
                  </SecondaryButton>
                </div>
              )}

            </Card>

            {/* ── RESULTS ── */}
            {analysisStatus === "done" && analysisData && (
              <div className="animate-slide-up">

                {/* 1. Executive Summary */}
                {analysisData?.executive_summary && (
                  <Card className="mb-3.5">
                    <SectionTitle>Executive Summary</SectionTitle>
                    <div className="text-[13px] leading-relaxed text-zinc-700">
                      {analysisData.executive_summary}
                    </div>
                  </Card>
                )}

                {/* 2. Competitor Ads Table */}
                {(analysisData?.competitors_table?.length > 0) && (
                  <Card className="mb-3.5">
                    <SectionTitle>Competitor Ads</SectionTitle>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs min-w-[600px]">
                        <thead>
                          <tr className="bg-zinc-50">
                            {["Name", "Ads", "Score", "Threat", "Angle", "Hook"].map((h) => (
                              <th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px] text-zinc-500 uppercase tracking-wider border-b border-zinc-200 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {analysisData.competitors_table.map((row, i) => (
                            <tr key={i} className="border-b-[0.5px] border-zinc-100 hover:bg-zinc-50">
                              <td className="px-3 py-2.5 font-medium text-zinc-900">{row?.name}</td>
                              <td className="px-3 py-2.5 text-zinc-700">{row?.ads}</td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    row?.score >= 75
                                      ? "bg-emerald-50 text-emerald-600"
                                      : row?.score >= 50
                                        ? "bg-amber-50 text-amber-600"
                                        : "bg-red-50 text-red-700"
                                  }`}
                                >{row?.score}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <Badge
                                  text={row?.threat}
                                  color={row?.threat === "High" ? "#B91C1C" : row?.threat === "Medium" ? "#D97706" : "#059669"}
                                  bg={row?.threat === "High" ? "#FEF2F2" : row?.threat === "Medium" ? "#FFFBEB" : "#ECFDF5"}
                                />
                              </td>
                              <td className="px-3 py-2.5 text-zinc-700">{row?.angle}</td>
                              <td className="px-3 py-2.5 text-indigo-600 italic">&ldquo;{row?.hook}&rdquo;</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {/* 3. Top Hook Patterns Table */}
                {(analysisData?.hooks_table?.length > 0) && (
                  <Card className="mb-3.5">
                    <SectionTitle>Top Hook Patterns</SectionTitle>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs min-w-[600px]">
                        <thead>
                          <tr className="bg-zinc-50">
                            {["Pattern", "Example", "Reason", "Score"].map((h) => (
                              <th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px] text-zinc-500 uppercase tracking-wider border-b border-zinc-200 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {analysisData.hooks_table.map((row, i) => (
                            <tr key={i} className="border-b-[0.5px] border-zinc-100 hover:bg-zinc-50">
                              <td className="px-3 py-2.5 font-medium text-zinc-900 whitespace-nowrap">{row?.pattern}</td>
                              <td className="px-3 py-2.5 text-indigo-600 italic">&ldquo;{row?.example}&rdquo;</td>
                              <td className="px-3 py-2.5 text-zinc-700 leading-normal">{row?.reason}</td>
                              <td className="px-3 py-2.5">
                                <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-600">{row?.score}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {/* 4 + 5. Market Insights & Gap Opportunities — side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px] mb-[14px]">

                  {/* 4. Market Insights Table */}
                  {(analysisData?.market_insights_table?.length > 0) && (
                    <Card>
                      <SectionTitle>Market Insights</SectionTitle>
                      <table className="w-full border-collapse text-xs min-w-[600px]">
                        <thead>
                          <tr className="bg-zinc-50">
                            {["Field", "Value"].map((h) => (
                              <th key={h} className="px-2.5 py-2 text-left font-semibold text-[11px] text-zinc-500 uppercase tracking-wider border-b border-zinc-200">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {analysisData.market_insights_table.map((row, i) => (
                            <tr key={i} className="border-b-[0.5px] border-zinc-100">
                              <td className="px-2.5 py-2 font-medium text-zinc-500 text-[11px]">{row?.field}</td>
                              <td className="px-2.5 py-2 font-medium text-zinc-900">{row?.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  )}

                  {/* 5. Gap Opportunities Table */}
                  {(analysisData?.gaps_table?.length > 0) && (
                    <Card>
                      <SectionTitle>Gap Opportunities</SectionTitle>
                      <table className="w-full border-collapse text-xs min-w-[600px]">
                        <thead>
                          <tr className="bg-zinc-50">
                            {["Gap", "Opportunity", "Priority", "Impact"].map((h) => (
                              <th key={h} className="px-2.5 py-2 text-left font-semibold text-[11px] text-zinc-500 uppercase tracking-wider border-b border-zinc-200 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {analysisData.gaps_table.map((row, i) => (
                            <tr key={i} className="border-b-[0.5px] border-zinc-100 hover:bg-zinc-50">
                              <td className="px-2.5 py-2 font-medium text-zinc-900">{row?.gap}</td>
                              <td className="px-2.5 py-2 text-zinc-700 leading-normal">{row?.opportunity}</td>
                              <td className="px-2.5 py-2">
                                <Badge
                                  text={row?.priority}
                                  color={row?.priority === "High" ? "#B91C1C" : row?.priority === "Medium" ? "#D97706" : "#059669"}
                                  bg={row?.priority === "High" ? "#FEF2F2" : row?.priority === "Medium" ? "#FFFBEB" : "#ECFDF5"}
                                />
                              </td>
                              <td className="px-2.5 py-2 text-blue-500 text-[11px]">{row?.impact}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  )}
                </div>

                {/* Raw response fallback — shown when none of the expected tables are present */}
                {(!analysisData?.competitors_table?.length &&
                  !analysisData?.hooks_table?.length &&
                  !analysisData?.market_insights_table?.length &&
                  !analysisData?.gaps_table?.length &&
                  !analysisData?.message?.toLowerCase().includes("workflow")) && (
                    <Card className="mb-3.5">
                      <SectionTitle>n8n Raw Response</SectionTitle>
                      <div className="text-xs text-zinc-500 mb-2">
                        n8n responded but no table data was found. Raw output:
                      </div>
                      <pre className="text-[11px] bg-zinc-50 rounded-md p-3 overflow-auto max-h-[300px] m-0 text-zinc-900 leading-relaxed">
                        {JSON.stringify(analysisData, null, 2)}
                      </pre>
                    </Card>
                  )}

                {analysisData && (
                  <div>
                    <button
                      onClick={() => { setTab("create"); setCreateTabConfigOpen(true); }}
                      disabled={adStatus === "generating" || adStatus === "waiting"}
                      className={`px-[18px] py-[11px] rounded-md border-none text-[13px] font-medium flex items-center gap-2 transition-colors duration-200 ${
                        (adStatus === "generating" || adStatus === "waiting")
                          ? "bg-indigo-50 text-indigo-600 cursor-not-allowed opacity-70"
                          : "bg-indigo-600 text-white cursor-pointer"
                      }`}
                    >
                      {adStatus === "generating" ? <><Spinner size={12} color="#4F46E5" /> Sending to n8n...</> :
                        adStatus === "waiting" ? <><Spinner size={12} color="#4F46E5" /> Generating ad...</> :
                          "Create ad based on this analysis →"}
                    </button>
                    {adStatus === "waiting" && (
                      <div className="mt-2 text-xs text-amber-600">
                        n8n is generating your ad using the analysis data. Results will appear in the Create Ad tab when ready.
                      </div>
                    )}
                    {adStatus === "error" && (
                      <div className="mt-2 text-xs text-red-700">
                        Could not reach n8n: {webhookError}. Please try again.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CREATE AD
      ═══════════════════════════════════════════════════════ */}
      {tab === "create" && (
        <div className="animate-fade-in">
          {!analysisData && (
            <div className="bg-amber-50 border-[0.5px] border-amber-600 rounded-md p-3.5 mb-3.5">
              <div className="text-[13px] text-amber-600 font-medium mb-1">
                No competitor analysis yet
              </div>
              <div className="text-xs text-amber-700">
                Run competitor analysis first so AI can create a
                better ad based on real data.
              </div>
            </div>
          )}

          <Card className="mb-3.5">
            <SectionTitle>Select topic</SectionTitle>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  className={topicBtnCls(t)}
                  onClick={() => setSelectedTopic(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <SectionTitle>n8n Workflow Steps</SectionTitle>
            <WorkflowStep
              step="1"
              label="Topic + analysis data sent to n8n"
              sub="Competitor brief + topic = better ad"
              active={adStatus === "idle"}
              done={adStatus !== "idle"}
            />
            <WorkflowStep
              step="2"
              label="Claude generates ad copy"
              sub="Using top hook patterns and ready templates"
              active={adStatus === "waiting"}
              done={adStatus === "done"}
            />
            <WorkflowStep
              step="3"
              label="Runway ML video / DALL-E image"
              sub="28-sec reel or static visual"
              active={adStatus === "waiting"}
              done={adStatus === "done"}
            />
            <WorkflowStep
              step="4"
              label="Ready ad sent to Approval tab"
              sub="You confirm budget & launch"
              active={false}
              done={adStatus === "done"}
            />

            <div>
              {/* Toggle configuration panel */}
              {!createTabConfigOpen ? (
                <button
                  onClick={() => setCreateTabConfigOpen(true)}
                  disabled={adStatus === "generating" || adStatus === "waiting" || !analysisData}
                  className={`w-full px-[18px] py-[11px] rounded-md border-none text-[13px] font-medium flex items-center justify-center gap-2 transition-colors duration-200 ${
                    (adStatus === "generating" || adStatus === "waiting" || !analysisData)
                      ? "bg-zinc-50 text-indigo-600 cursor-not-allowed opacity-70"
                      : "bg-indigo-600 text-white cursor-pointer"
                  }`}
                >
                  {adStatus === "generating" ? <><Spinner size={12} color="#4F46E5" /> Sending to n8n...</> :
                    adStatus === "waiting" ? <><Spinner size={12} color="#4F46E5" /> Generating ad...</> :
                      "Generate ad — trigger n8n"}
                </button>
              ) : (
                <div className="animate-fade-in p-[18px] rounded-md bg-zinc-50 border-[0.5px] border-zinc-100">
                  {/* Cancel button */}
                  <div className="flex justify-end mb-3">
                    <button
                      onClick={() => setCreateTabConfigOpen(false)}
                      className="px-3 py-[5px] rounded-sm border border-zinc-200 bg-white text-zinc-500 text-[11px] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* ── PHASE 1: TOTAL QUANTITY ── */}
                  <div className="p-6 rounded-lg bg-zinc-50 border-[0.5px] border-zinc-100 mb-5 relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-5">
                      <div>
                        <div className="text-[13px] font-bold text-zinc-900 mb-1">
                          STEP 1: HOW MANY ADS?
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Pick the total number of creatives you want to generate.
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            onClick={() => updateCreateTabTotalAds(n)}
                            type="button"
                            className={`w-[38px] h-[38px] rounded-md text-[13px] font-bold cursor-pointer transition-all duration-200 ${
                              createTabAdsConfig.totalAds === n
                                ? "border-[1.5px] border-indigo-600 bg-indigo-50 text-indigo-600"
                                : "border border-zinc-200 bg-white text-zinc-900"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={createTabAdsConfig.totalAds}
                          onChange={(e) => updateCreateTabTotalAds(parseInt(e.target.value) || 1)}
                          className="w-[50px] py-2 text-center rounded-md border border-zinc-200 bg-white text-zinc-900 text-[13px] font-semibold outline-none"
                        />
                      </div>
                    </div>

                    {/* ── PHASE 2: ALLOCATION ── */}
                    <div className="border-t border-dashed border-zinc-200 pt-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-[13px] font-bold text-zinc-900">
                              STEP 2: ALLOCATE TYPES
                            </div>
                            <div className="text-[10px] px-1.5 py-[2px] rounded-xs bg-amber-50 text-amber-600 font-bold border-[0.5px] border-amber-600">
                              LIMIT: 3V / 2I
                            </div>
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            Divide your {createTabAdsConfig.totalAds} ads into Videos and Images.
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white p-1 rounded-md border border-zinc-100">
                          <div className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold ${createTabAdsConfig.videoCount >= 3 ? "text-indigo-600" : "text-zinc-900"}`}>
                            🎬 {createTabAdsConfig.videoCount}/3
                          </div>
                          <div className="w-px h-4 bg-zinc-200" />
                          <div className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold ${createTabAdsConfig.imageCount >= 2 ? "text-amber-600" : "text-zinc-900"}`}>
                            🖼️ {createTabAdsConfig.imageCount}/2
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2.5">
                        {createTabAdsConfig.items.map((item, idx) => {
                          const videoDisabled = item.type !== "video" && createTabAdsConfig.videoCount >= 3;
                          const imageDisabled = item.type !== "image" && createTabAdsConfig.imageCount >= 2;

                          return (
                            <div key={item.id} className="flex-[1_1_120px] flex flex-col gap-1.5">
                              <div className="text-[10px] font-bold text-zinc-500 ml-0.5">AD {idx + 1}</div>
                              <div className="flex rounded-md overflow-hidden border border-zinc-200 bg-white">
                                <button
                                  onClick={() => setCreateTabItemType(idx, "video")}
                                  type="button"
                                  className={`flex-1 py-2.5 border-none text-sm transition-all duration-150 ${
                                    item.type === "video" ? "bg-indigo-50 text-indigo-600" : "bg-transparent text-zinc-400"
                                  } ${videoDisabled ? "cursor-not-allowed opacity-30" : "cursor-pointer"}`}
                                  title={videoDisabled ? "3 Video maximum reached" : "Video"}
                                >
                                  🎬
                                </button>
                                <button
                                  onClick={() => setCreateTabItemType(idx, "image")}
                                  type="button"
                                  className={`flex-1 py-2.5 border-none text-sm transition-all duration-150 ${
                                    item.type === "image" ? "bg-amber-50 text-amber-600" : "bg-transparent text-zinc-400"
                                  } ${imageDisabled ? "cursor-not-allowed opacity-30" : "cursor-pointer"}`}
                                  title={imageDisabled ? "2 Image maximum reached" : "Image"}
                                >
                                  🖼️
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* ── PHASE 3: DETAILED CONFIG ── */}
                  <div className="flex flex-col gap-3 mb-6">
                    {createTabAdsConfig.items.map((item, idx) => {
                      const isVideo = item.type === "video";
                      return (
                        <div
                          key={item.id}
                          className={`p-5 rounded-lg shadow-sm border-[1.5px] ${
                            isVideo
                              ? "bg-gradient-to-b from-white to-zinc-50 border-indigo-50"
                              : "bg-gradient-to-b from-white to-amber-50 border-amber-50"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-[18px]">
                            <span className="text-xl">{isVideo ? "🎬" : "🖼️"}</span>
                            <div className="text-[13px] font-extrabold text-zinc-900 uppercase tracking-wide">
                              {isVideo ? "Video" : "Image"} {idx + 1} Configuration
                            </div>
                          </div>

                          {isVideo ? (
                            <div className="flex flex-col gap-4">
                              <div className="grid grid-cols-2 gap-3.5">
                                <div>
                                  <div className="text-[11px] font-bold text-zinc-500 mb-1.5 uppercase">Duration</div>
                                  <select
                                    value={item.duration}
                                    onChange={(e) => updateCreateTabItemField(idx, "duration", e.target.value)}
                                    className="w-full p-2.5 rounded-md border border-zinc-200 bg-white text-xs outline-none text-zinc-900"
                                  >
                                    {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <div className="text-[11px] font-bold text-zinc-500 mb-1.5 uppercase">Audio Style</div>
                                  <select
                                    value={item.audioStyle}
                                    onChange={(e) => updateCreateTabItemField(idx, "audioStyle", e.target.value)}
                                    className="w-full p-2.5 rounded-md border border-zinc-200 bg-white text-xs outline-none text-zinc-900"
                                  >
                                    {AUDIO_STYLES.map(a => <option key={a} value={a}>{a}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3.5">
                                <div>
                                  <div className="text-[11px] font-bold text-zinc-500 mb-1.5 uppercase">Character</div>
                                  <select
                                    value={item.character || "male"}
                                    onChange={(e) => {
                                      const newChar = e.target.value;
                                      const firstVoice = VOICE_OPTIONS[newChar][0].id;
                                      setCreateTabAdsConfig((prev) => {
                                        const newItems = [...prev.items];
                                        newItems[idx] = { ...newItems[idx], character: newChar, voiceId: firstVoice };
                                        return { ...prev, items: newItems };
                                      });
                                    }}
                                    className="w-full p-2.5 rounded-md border border-zinc-200 bg-white text-xs outline-none text-zinc-900"
                                  >
                                    <option value="male">👨 Male</option>
                                    <option value="female">👩 Female</option>
                                  </select>
                                </div>
                                <div>
                                  <div className="text-[11px] font-bold text-zinc-500 mb-1.5 uppercase">Voice</div>
                                  <select
                                    value={item.voiceId || VOICE_OPTIONS[item.character || "male"][0].id}
                                    onChange={(e) => updateCreateTabItemField(idx, "voiceId", e.target.value)}
                                    className="w-full p-2.5 rounded-md border border-zinc-200 bg-white text-xs outline-none text-zinc-900"
                                  >
                                    {(VOICE_OPTIONS[item.character || "male"] || []).map(v => (
                                      <option key={v.id} value={v.id}>{v.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] font-bold text-zinc-500 mb-1.5 uppercase">Visual Style</div>
                                <select
                                  value={item.videoStyle}
                                  onChange={(e) => updateCreateTabItemField(idx, "videoStyle", e.target.value)}
                                  className="w-full p-2.5 rounded-md border border-zinc-200 bg-white text-xs outline-none text-zinc-900"
                                >
                                  {VIDEO_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                              <div>
                                <div className="flex justify-between items-center mb-1.5">
                                  <div className="text-[11px] font-bold text-zinc-500 uppercase">Script / Storyboard Idea</div>
                                  <button
                                    disabled={sentIdeaIds[item.id]}
                                    onClick={async () => {
                                      if (sentIdeaIds[item.id]) return;
                                      setSentIdeaIds(prev => ({ ...prev, [item.id]: true }));
                                      addSbToast(`Generating Video ${idx + 1} ideas via webhook...`);
                                      console.log("Sending to Webhook:", item);
                                      try {
                                        const res = await fetch("https://n8n.srv881198.hstgr.cloud/webhook/5dd8a76d-f4e4-45b5-808a-c784057d29b1", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify(item),
                                          cache: "no-store"
                                        });
                                        if (res.ok) {
                                          const data = await res.json();
                                          let ideasArr = [];
                                          if (Array.isArray(data)) {
                                            if (data[0] && Array.isArray(data[0].ideas)) ideasArr = data[0].ideas;
                                            else if (data[0] && data[0].idea) ideasArr = data;
                                            else if (Array.isArray(data[0])) ideasArr = data[0];
                                          } else if (data && Array.isArray(data.ideas)) {
                                            ideasArr = data.ideas;
                                          }
                                          if (ideasArr && ideasArr.length > 0) {
                                            setGeneratedIdeas(prev => ({ ...prev, [item.id]: ideasArr }));
                                            addSbToast("Ideas generated successfully!", "success");
                                          } else {
                                            console.error("Unrecognized JSON format from n8n:", data);
                                            addSbToast("No valid ideas format returned.", "error");
                                          }
                                        } else {
                                          addSbToast("Failed to generate ideas", "error");
                                        }
                                      } catch (err) {
                                        addSbToast("Error fetching ideas", "error");
                                      } finally {
                                        setSentIdeaIds(prev => ({ ...prev, [item.id]: false }));
                                      }
                                    }}
                                    className={`px-2.5 py-1 rounded-sm border-none text-white text-[10px] font-bold uppercase transition-all duration-200 ${
                                      sentIdeaIds[item.id] ? "bg-[#4a4a6a] cursor-not-allowed opacity-60" : "bg-[#1a1a2e] cursor-pointer hover:bg-[#2a2a4e]"
                                    }`}
                                  >
                                    {sentIdeaIds[item.id] ? "Generating..." : "Generate an idea"}
                                  </button>
                                </div>
                                <textarea
                                  placeholder="e.g. generate a video with offer and sales ads..."
                                  value={item.idea}
                                  onChange={(e) => updateCreateTabItemField(idx, "idea", e.target.value)}
                                  className="w-full min-h-20 p-3 rounded-md border border-zinc-200 bg-white text-xs outline-none text-zinc-900 resize-y"
                                />
                                {generatedIdeas[item.id] && generatedIdeas[item.id].length > 0 && (
                                  <div className="mt-4 flex flex-col gap-3 p-4 rounded-lg border border-dashed border-indigo-50 bg-indigo-500/[0.04]">
                                    <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide">✨ AI Generated Ideas (Click to use)</div>
                                    <div className="grid grid-cols-1 gap-2.5">
                                      {generatedIdeas[item.id].map(ideaObj => (
                                        <div
                                          key={ideaObj.id}
                                          onClick={() => updateCreateTabItemField(idx, "idea", ideaObj.idea)}
                                          className="px-4 py-3.5 rounded-md border border-indigo-50 bg-zinc-50 cursor-pointer text-xs text-zinc-700 leading-normal shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-200 hover:border-indigo-600 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
                                        >
                                          {ideaObj.idea}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-4">
                              <div>
                                <div className="text-[11px] font-bold text-zinc-500 mb-1.5 uppercase">Visual Style</div>
                                <select
                                  value={item.imageStyle || "Bold & Colorful"}
                                  onChange={(e) => updateCreateTabItemField(idx, "imageStyle", e.target.value)}
                                  className="w-full p-2.5 rounded-md border border-zinc-200 bg-white text-xs outline-none text-zinc-900"
                                >
                                  {VIDEO_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                              <div>
                                <div className="flex justify-between items-center mb-1.5">
                                  <div className="text-[11px] font-bold text-zinc-500 uppercase">Image Description / Prompt</div>
                                  <button
                                    disabled={sentIdeaIds[item.id]}
                                    onClick={async () => {
                                      if (sentIdeaIds[item.id]) return;
                                      setSentIdeaIds(prev => ({ ...prev, [item.id]: true }));
                                      addSbToast(`Generating Image ${idx + 1} ideas via webhook...`);
                                      console.log("Sending to Webhook:", item);
                                      try {
                                        const res = await fetch("https://n8n.srv881198.hstgr.cloud/webhook/5dd8a76d-f4e4-45b5-808a-c784057d29b1", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify(item),
                                          cache: "no-store"
                                        });
                                        if (res.ok) {
                                          const data = await res.json();
                                          let ideasArr = [];
                                          if (Array.isArray(data)) {
                                            if (data[0] && Array.isArray(data[0].ideas)) ideasArr = data[0].ideas;
                                            else if (data[0] && data[0].idea) ideasArr = data;
                                            else if (Array.isArray(data[0])) ideasArr = data[0];
                                          } else if (data && Array.isArray(data.ideas)) {
                                            ideasArr = data.ideas;
                                          }
                                          if (ideasArr && ideasArr.length > 0) {
                                            setGeneratedIdeas(prev => ({ ...prev, [item.id]: ideasArr }));
                                            addSbToast("Ideas generated successfully!", "success");
                                          } else {
                                            console.error("Unrecognized JSON format from n8n:", data);
                                            addSbToast("No valid ideas format returned.", "error");
                                          }
                                        } else {
                                          addSbToast("Failed to generate ideas", "error");
                                        }
                                      } catch (err) {
                                        addSbToast("Error fetching ideas", "error");
                                      } finally {
                                        setSentIdeaIds(prev => ({ ...prev, [item.id]: false }));
                                      }
                                    }}
                                    className={`px-2.5 py-1 rounded-sm border-none text-white text-[10px] font-bold uppercase transition-all duration-200 ${
                                      sentIdeaIds[item.id] ? "bg-[#4a4a6a] cursor-not-allowed opacity-60" : "bg-[#1a1a2e] cursor-pointer hover:bg-[#2a2a4e]"
                                    }`}
                                  >
                                    {sentIdeaIds[item.id] ? "Generating..." : "Generate an idea"}
                                  </button>
                                </div>
                                <textarea
                                  placeholder="Describe the aesthetic, colors, and subject of the image..."
                                  value={item.idea}
                                  onChange={(e) => updateCreateTabItemField(idx, "idea", e.target.value)}
                                  className="w-full min-h-20 p-3 rounded-md border border-zinc-200 bg-white text-xs outline-none text-zinc-900 resize-y"
                                />
                                {generatedIdeas[item.id] && generatedIdeas[item.id].length > 0 && (
                                  <div className="mt-4 flex flex-col gap-3 p-4 rounded-lg border border-dashed border-indigo-50 bg-indigo-500/[0.04]">
                                    <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide">✨ AI Generated Ideas (Click to use)</div>
                                    <div className="grid grid-cols-1 gap-2.5">
                                      {generatedIdeas[item.id].map(ideaObj => (
                                        <div
                                          key={ideaObj.id}
                                          onClick={() => updateCreateTabItemField(idx, "idea", ideaObj.idea)}
                                          className="px-4 py-3.5 rounded-md border border-indigo-50 bg-zinc-50 cursor-pointer text-xs text-zinc-700 leading-normal shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-200 hover:border-indigo-600 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
                                        >
                                          {ideaObj.idea}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Submit / Status Area */}
                  <div className="mt-6 px-5 py-4 rounded-lg bg-zinc-50 border border-zinc-100">
                    {(isStatusPolling || adStatus === "waiting") ? (
                      <div className="flex flex-col gap-3">
                        {!workflowStatus?.toLowerCase().includes("completed") && (
                          <div className="relative h-0.5 bg-indigo-50 rounded-[1px] overflow-hidden mb-3">
                            <div
                              className="animate-pulse absolute top-0 left-0 h-full w-[30%] bg-indigo-600 rounded-[1px]"
                              style={{ animation: "scan 2s linear infinite" }}
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${workflowStatus?.toLowerCase().includes("completed") ? "bg-emerald-600" : "bg-indigo-600 animate-pulse"}`} />
                            <SectionTitle className="!mb-0">{workflowStatus?.toLowerCase().includes("completed") ? "Workflow Completed" : "Workflow in Progress"}</SectionTitle>
                          </div>
                          {workflowStatus?.toLowerCase().includes("completed") ? (
                            <Badge text="COMPLETED" color="#059669" bg="#ECFDF5" />
                          ) : (
                            <Badge text="RUNNING" color="#4F46E5" bg="#EEF2FF" />
                          )}
                        </div>

                        <div className="px-[18px] py-3.5 rounded-md bg-white border border-zinc-100 flex flex-col gap-2">
                          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Current Status</div>
                          <div className={`text-[15px] font-bold flex items-center gap-2 ${workflowStatus?.toLowerCase().includes("completed") ? "text-emerald-600" : "text-indigo-600"}`}>
                            {!workflowStatus?.toLowerCase().includes("completed") && <Spinner size={14} color="#4F46E5" />}
                            {workflowStatus || "Video is Generating..."}
                          </div>
                          <div className="text-[11px] text-zinc-400 italic">
                            n8n is orchestrating Claude 3.5 and Runway ML. Ad previews will refresh automatically upon completion.
                          </div>

                          {/* Image & Video Generation Progress Bars */}
                          {(() => {
                            const lStatus = workflowStatus?.toLowerCase() || "";

                            const hasBoth = lStatus.includes("image/video");
                            const showImage = createTabAdsConfig.imageCount > 0 && (hasBoth || lStatus.includes("image") || lStatus.includes("triggering"));
                            const showVideo = createTabAdsConfig.videoCount > 0 && (hasBoth || lStatus.includes("video") || lStatus.includes("triggering") || !lStatus);

                            const allDone = lStatus === "completed" || lStatus === "workflow completed";
                            const imgDone = allDone || lStatus.includes("image ad completed") || lStatus.includes("image completed");
                            const vidDone = allDone || lStatus.includes("video ad completed") || lStatus.includes("video completed");

                            if (!workflowStatus || workflowStatus === "waiting") return null;

                            return (
                              <div className="mt-3 flex flex-col gap-4">
                                {showImage && (
                                  <div>
                                    <div className="flex justify-between text-[11px] text-zinc-400 font-semibold mb-1.5">
                                      <span>{imgDone ? "Image Generation Completed" : "Generating Image (~1:30)"}</span>
                                      <span>{imgDone ? "100%" : ""}</span>
                                    </div>
                                    <div className="relative h-1.5 bg-zinc-200 rounded-[3px] overflow-hidden">
                                      <style>{`
                                            @keyframes fillImageGen {
                                              0% { width: 0%; }
                                              100% { width: 98%; }
                                            }
                                          `}</style>
                                      <div
                                        className={`absolute top-0 left-0 h-full rounded-[3px] ${imgDone ? "bg-emerald-600" : "bg-indigo-600"} transition-[width,background] duration-500`}
                                        style={{
                                          width: imgDone ? "100%" : "0%",
                                          animation: !imgDone ? "fillImageGen 90s linear forwards" : "none",
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {showVideo && (
                                  <div>
                                    <div className="flex justify-between text-[11px] text-zinc-400 font-semibold mb-1.5">
                                      <span>{vidDone ? "Video Generation Completed" : "Generating Video (~10:00)"}</span>
                                      <span>{vidDone ? "100%" : ""}</span>
                                    </div>
                                    <div className="relative h-1.5 bg-zinc-200 rounded-[3px] overflow-hidden">
                                      <style>{`
                                            @keyframes fillVideoGen {
                                              0% { width: 0%; }
                                              100% { width: 98%; }
                                            }
                                          `}</style>
                                      <div
                                        className={`absolute top-0 left-0 h-full rounded-[3px] ${vidDone ? "bg-emerald-600" : "bg-indigo-600"} transition-[width,background] duration-500`}
                                        style={{
                                          width: vidDone ? "100%" : "0%",
                                          animation: !vidDone ? "fillVideoGen 600s linear forwards" : "none",
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px]">🚀</span>
                          <div className="text-xs text-zinc-400">
                            <b>{createTabAdsConfig.totalAds} Ads</b> ready ({createTabAdsConfig.videoCount}V / {createTabAdsConfig.imageCount}I)
                          </div>
                        </div>
                        <button
                          onClick={handleCreateTabTriggerAds}
                          disabled={adStatus === "generating" || adStatus === "waiting" || !analysisData}
                          type="button"
                          className={`w-full sm:w-auto px-[30px] py-3 rounded-lg border-none text-[13px] font-bold inline-flex items-center justify-center gap-2 transition-[transform,box-shadow] duration-150 ${
                            (adStatus === "generating" || adStatus === "waiting" || !analysisData)
                              ? "bg-indigo-50 text-indigo-600 cursor-not-allowed opacity-70"
                              : "bg-gradient-to-br from-orange-500 to-pink-500 text-white cursor-pointer shadow-[0_4px_12px_rgba(236,72,153,0.3)] hover:-translate-y-px"
                          } ${(adStatus === "generating" || !analysisData) ? "cursor-not-allowed" : ""}`}
                        >
                          {adStatus === "generating" ? <><Spinner size={14} /> Triggering...</> : "Confirm & Generate Ads →"}
                        </button>
                      </div>
                    )}

                    {adStatus === "error" && (
                      <div className="mt-3 p-2.5 rounded-sm bg-red-50 text-red-700 text-xs border-[0.5px] border-red-600">
                        <b>Error:</b> {webhookError}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>




          {/* ── AD PREVIEWS ── */}
          {(() => {
            const adIds = [1, 2, 3, 4, 5]; // Mapping to Ad 1-3, Image 1-2
            return (
              <div className="mt-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-3">
                  <SectionTitle className="!mb-0">Ad Previews — Dynamic Table</SectionTitle>
                  <button
                    onClick={handleRefreshAdVideos}
                    disabled={adVideosLoading}
                    type="button"
                    className={`flex items-center gap-2 justify-center px-6 py-2.5 rounded-md border-[0.5px] border-zinc-200 bg-zinc-50 text-zinc-900 text-[13px] font-semibold shadow-sm transition-all duration-200 hover:bg-zinc-100 ${adVideosLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  >
                    <span className={`inline-block text-base ${adVideosLoading ? "animate-spin" : ""}`}>↻</span>
                    {adVideosLoading ? "Refreshing..." : "Refresh Previews"}
                  </button>
                </div>
                <div className="flex flex-col gap-5">
                  {/* HELPER FOR RENDERING CARDS */}
                  {(() => {
                    const renderCard = (latestEntry) => {
                      const url = latestEntry?.text || "";
                      const isVideo = (latestEntry?.format || "").toLowerCase() === "video";

                      const id = latestEntry?.id || "Unknown";
                      let label = isVideo ? `Video Ad ${id}` : `Image Ad ${id}`;

                      return (
                        <Card key={latestEntry?.id + "_" + latestEntry?.time} className="!p-3 h-full">
                          <div className="text-xs font-semibold text-zinc-500 mb-2.5 uppercase tracking-wider">
                            {label}
                          </div>
                          <div className="bg-black rounded-md aspect-[9/16] flex items-center justify-center overflow-hidden shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">
                            {latestEntry?.Approved && latestEntry?.Approved !== "false" ? (
                              <div className="text-[13px] text-white font-bold text-center p-5">
                                ✓ Approved
                              </div>
                            ) : !url ? (
                              <div className="text-[11px] text-zinc-400 text-center p-2.5">
                                Waiting for {label} link...
                              </div>
                            ) : isVideo ? (
                              <video
                                key={url}
                                src={url}
                                controls
                                autoPlay={false}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <img
                                key={url}
                                src={url}
                                alt={label}
                                className="w-full h-full object-contain"
                              />
                            )}
                          </div>

                          {url && (!latestEntry?.Approved || latestEntry?.Approved === "false") && (
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => setSelectedAdForDetails(latestEntry)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border border-zinc-200 bg-zinc-50 text-zinc-900 text-[11px] font-semibold transition-all duration-150 cursor-pointer hover:bg-zinc-100"
                              >
                                ↗ Full View
                              </button>
                              <button
                                onClick={() => handleApproveAd(latestEntry)}
                                disabled={latestEntry?.Approved || approvingId === (latestEntry?.id + "_" + latestEntry?.time)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border-none text-[11px] font-semibold transition-all duration-150 ${
                                  latestEntry?.Approved
                                    ? "bg-emerald-50 text-emerald-600 cursor-default"
                                    : "bg-indigo-600 text-white cursor-pointer"
                                } ${approvingId === (latestEntry?.id + "_" + latestEntry?.time) ? "opacity-70" : ""}`}
                              >
                                {approvingId === (latestEntry?.id + "_" + latestEntry?.time) ? (
                                  <Spinner size={10} />
                                ) : latestEntry?.Approved ? (
                                  "✓ Approved"
                                ) : (
                                  "✓ Approve"
                                )}
                              </button>
                            </div>
                          )}
                        </Card>
                      );
                    };

                    if (pendingAds.length === 0) {
                      return (
                        <div className="p-10 text-center text-zinc-500 text-sm bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                          No pending ads to preview.
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 px-0 sm:px-4 max-w-[1100px] mx-auto">
                        {pendingAds.map(ad => (
                          <div key={ad.id + "_" + ad.time}>
                            {renderCard(ad)}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* ── CUSTOM MEDIA UPLOAD ── */}
                  <div className="mt-8 p-6 rounded-lg bg-zinc-50 border-2 border-dashed border-black flex flex-col items-center justify-center gap-3">
                    <SectionTitle className="!mb-1" innerClassName="!text-base">Or Upload Your Own Media</SectionTitle>
                    <div className="text-xs text-zinc-400 text-center max-w-[400px]">
                      Skip the AI generation and upload your own video or image. It will go directly to the Approved section.
                    </div>

                    <div className="mt-2 flex flex-col items-center gap-2">
                      <label className={`px-5 py-2.5 rounded-md bg-white border border-zinc-200 text-zinc-900 text-[13px] font-semibold cursor-pointer flex items-center gap-2 transition-all duration-150 ${customUploadLoading ? "opacity-60" : ""}`}>
                        {customUploadLoading ? (
                          <><Spinner size={14} color="#4F46E5" /> Uploading...</>
                        ) : (
                          <><span>+</span> Choose File to Upload</>
                        )}
                        <input
                          type="file"
                          accept="video/*,image/*"
                          className="hidden"
                          disabled={customUploadLoading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            setCustomUploadLoading(true);
                            setCustomUploadError("");

                            try {
                              const timestamp = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(',', '').replace(/\//g, '-').replace(' ', '_').replace(':', '-').replace(' pm', 'PM').replace(' am', 'AM');
                              const ext = file.name.split('.').pop();
                              const randomId = Math.floor(Math.random() * 10000);
                              const fileName = `${timestamp}_${randomId}.${ext}`;

                              const { data, error } = await supabase.storage.from("AD1").upload(fileName, file);
                              if (error) throw error;

                              const { data: publicUrlData } = supabase.storage.from("AD1").getPublicUrl(fileName);
                              const publicUrl = publicUrlData.publicUrl;

                              const isVideo = file.type.startsWith("video/");
                              const newAd = {
                                id: 1, // Defaulting to AD1 category
                                time: new Date().toISOString(),
                                text: publicUrl,
                                format: isVideo ? "Video" : "Image",
                                Approved: "true"
                              };

                              // RLS is disabled, use client directly
                              const { error: dbError } = await supabase
                                .from("your_name_table")
                                .insert([{
                                  id: 4,
                                  text: publicUrl,
                                  time: new Date().toISOString(),
                                  format: isVideo ? "Video" : "Image",
                                  Approved: "true"
                                }]);

                              if (dbError) throw dbError;


                              setAllApprovedAds(prev => [newAd, ...prev]);
                              await fetchAdTableLinks(); // Refresh to ensure UI is in sync

                              try { addSbToast("Media uploaded and approved!", "success"); } catch (err) { }
                            } catch (err) {
                              setCustomUploadError(err.message || "Upload failed");
                              console.error(err);
                            } finally {
                              setCustomUploadLoading(false);
                            }
                          }}
                        />
                      </label>
                      {customUploadError && (
                        <div className="text-xs text-red-500">{customUploadError}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          APPROVAL
      ═══════════════════════════════════════════════════════ */}
      {tab === "approval" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 space-y-8">
          {/* Page header */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-zinc-500">Review and launch your final approved creatives from the database.</p>
            </div>
            <div className="inline-flex items-center gap-3 self-start sm:self-auto bg-white border border-zinc-200 rounded-xl px-4 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                <CheckCircle size={15} />
              </span>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 leading-none">Approved</div>
                <div className="text-lg font-semibold tracking-tight text-zinc-900 tabular-nums leading-tight">{allApprovedAds.length}</div>
              </div>
            </div>
          </header>

          {allApprovedAds.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl">
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 mb-4">
                  <Inbox size={22} />
                </span>
                <h3 className="text-base font-semibold text-zinc-900 mb-1.5">No ads approved yet</h3>
                <p className="text-sm text-zinc-500 max-w-md leading-relaxed">
                  Go to the <span className="font-medium text-zinc-700">Create Ad</span> tab to preview and approve your generated creatives. Once approved, they will appear here for final launch.
                </p>
                <button
                  onClick={() => setTab("create")}
                  className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Go to Create Ad
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              {(() => {
                const renderApprovalCard = (ad) => {
                  const isVid = (ad.format || "").toLowerCase() === "video";
                  return (
                    <div
                      key={`${ad.id}_${ad.time}`}
                      className="group bg-white border border-zinc-200 rounded-xl p-3 flex flex-col transition-all duration-200 hover:border-zinc-300 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-3 px-1 pt-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${isVid ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700"}`}>
                            {isVid ? <Video size={11} /> : <ImageIcon size={11} />}
                            {isVid ? "Video" : "Image"}
                          </span>
                          <span className="text-xs font-semibold text-zinc-700">
                            AD {ad.id}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-zinc-400 tabular-nums">
                          {new Date(ad.time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>

                      <div className="bg-zinc-950 rounded-lg aspect-[9/16] flex items-center justify-center overflow-hidden mb-3">
                        {isVid ? (
                          <video src={ad.text} controls autoPlay={false} className="w-full h-full object-contain" />
                        ) : (
                          <img src={ad.text} alt={`Approved Ad ${ad.id}`} className="w-full h-full object-contain" />
                        )}
                      </div>

                      <div className="mt-auto flex flex-col gap-2">
                        <button
                          onClick={() => setSelectedAdForDetails(ad)}
                          className="flex items-center justify-center gap-1.5 py-2 rounded-md border border-zinc-200 bg-white text-zinc-700 text-xs font-medium hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer"
                        >
                          <Maximize2 size={12} />
                          View details
                        </button>
                        <button
                          onClick={() => {
                            setLaunchAdCandidate(ad);
                            setTab("campaigns");
                          }}
                          className="flex items-center justify-center gap-1.5 py-2 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm"
                        >
                          Launch to Ads Manager
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  );
                };

                const approvedVideos = allApprovedAds
                  .filter(ad => (ad.format || "").toLowerCase() === "video")
                  .sort((a, b) => new Date(b.time) - new Date(a.time));

                const approvedImages = allApprovedAds
                  .filter(ad => (ad.format || "").toLowerCase() !== "video")
                  .sort((a, b) => new Date(b.time) - new Date(a.time));

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
                    {/* Videos */}
                    <section>
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                            <Video size={14} />
                          </span>
                          <h3 className="text-sm font-semibold text-zinc-900">Approved Videos</h3>
                          <span className="text-xs font-medium text-zinc-500 tabular-nums">({approvedVideos.length})</span>
                        </div>
                      </div>
                      {approvedVideos.length > 0 ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                          {approvedVideos.map(renderApprovalCard)}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center border border-dashed border-zinc-200 rounded-xl">
                          <Video size={20} className="text-zinc-300 mb-2" />
                          <div className="text-sm text-zinc-500">No videos approved yet.</div>
                        </div>
                      )}
                    </section>

                    {/* Images */}
                    <section className="relative lg:before:absolute lg:before:left-[-20px] lg:before:top-0 lg:before:bottom-0 lg:before:w-px lg:before:bg-zinc-200">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                            <ImageIcon size={14} />
                          </span>
                          <h3 className="text-sm font-semibold text-zinc-900">Approved Images</h3>
                          <span className="text-xs font-medium text-zinc-500 tabular-nums">({approvedImages.length})</span>
                        </div>
                      </div>
                      {approvedImages.length > 0 ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                          {approvedImages.map(renderApprovalCard)}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center border border-dashed border-zinc-200 rounded-xl">
                          <ImageIcon size={20} className="text-zinc-300 mb-2" />
                          <div className="text-sm text-zinc-500">No images approved yet.</div>
                        </div>
                      )}
                    </section>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CAMPAIGN SETUP
      ═══════════════════════════════════════════════════════ */}
      {tab === "campaigns" && (
        <CampaignSetup
          selectedId={selectedMetaCampaign?.id}
          selectedAd={launchAdCandidate}
          onSelect={(campaign) => setSelectedMetaCampaign(campaign)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════
          RUNNING CAMPAIGNS (LIVE META)
      ═══════════════════════════════════════════════════════ */}
      {tab === "live_campaigns" && (
        <div className="animate-fade-in flex flex-col gap-5">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <SectionTitle className="!mb-1">Running Campaigns</SectionTitle>
              <div className="text-[13px] text-zinc-500">
                Monitor and control your live Meta Ads. Run, pause, or delete individual ads.
              </div>
            </div>
            <button
              onClick={fetchLiveCampaigns}
              disabled={liveLoading}
              className="px-4 py-2 rounded-[10px] border border-zinc-200 bg-white cursor-pointer text-[13px] flex items-center gap-2"
            >
              {liveLoading ? <Spinner size={12} /> : "↻"} Refresh Data
            </button>
          </div>

          {liveError && (
            <Card className="bg-red-50 border-red-700">
              <div className="text-red-700 text-sm">{liveError}</div>
            </Card>
          )}

          {!liveLoading && liveCampaigns.length === 0 && !liveError && (
            <Card>
              <EmptyState title="No campaigns found" sub="Start a new campaign in the 'Campaign Setup' tab." />
            </Card>
          )}

          {liveCampaigns.map(campaign => {
            const campaignExpanded = expandedCampaigns.has(campaign.id);
            return (
              <Card key={campaign.id} className="!p-0 overflow-hidden">
                {/* Campaign Header */}
                <div
                  onClick={() => setExpandedCampaigns(prev => {
                    const next = new Set(prev);
                    if (next.has(campaign.id)) next.delete(campaign.id);
                    else next.add(campaign.id);
                    return next;
                  })}
                  className={`px-5 py-4 bg-zinc-50 cursor-pointer flex items-center justify-between ${campaignExpanded ? "border-b border-zinc-100" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg text-indigo-600 transition-transform duration-200 ${campaignExpanded ? "rotate-90" : ""}`}>▶</span>
                    <div>
                      <div className="text-[15px] font-bold">{campaign.name}</div>
                      <div className="text-xs text-zinc-500">ID: {campaign.id} • {campaign.objective}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      text={campaign.effective_status}
                      color={campaign.effective_status === "ACTIVE" ? "#059669" : "#D97706"}
                      bg={campaign.effective_status === "ACTIVE" ? "#ECFDF5" : "#FFFBEB"}
                    />
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditCampaign(campaign.id); }}
                        className="px-3 py-1 rounded-full border border-indigo-600 bg-transparent text-indigo-600 text-[10px] font-extrabold cursor-pointer transition-all duration-200"
                      >Edit</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUpdateStatus(campaign.id, "Campaign", "ACTIVE", "run"); }}
                        disabled={campaign.effective_status === "ACTIVE" || updatingStatusId === campaign.id}
                        className={`px-3 py-1 rounded-full border border-emerald-600 text-emerald-600 text-[10px] font-extrabold transition-all duration-200 ${campaign.effective_status === "ACTIVE" ? "bg-emerald-50 cursor-default" : "bg-transparent cursor-pointer"} ${updatingStatusId === campaign.id ? "opacity-50" : ""}`}
                      >Run</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUpdateStatus(campaign.id, "Campaign", "PAUSED", "pause"); }}
                        disabled={campaign.effective_status === "PAUSED" || updatingStatusId === campaign.id}
                        className={`px-3 py-1 rounded-full border border-amber-600 text-amber-600 text-[10px] font-extrabold transition-all duration-200 ${campaign.effective_status === "PAUSED" ? "bg-amber-50 cursor-default" : "bg-transparent cursor-pointer"} ${updatingStatusId === campaign.id ? "opacity-50" : ""}`}
                      >Pause</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUpdateStatus(campaign.id, "Campaign", null, "delete"); }}
                        disabled={updatingStatusId === campaign.id}
                        className={`px-3 py-1 rounded-full border border-red-700 bg-transparent text-red-700 text-[10px] font-extrabold cursor-pointer transition-all duration-200 ${updatingStatusId === campaign.id ? "opacity-50" : ""}`}
                      >Delete</button>
                    </div>
                  </div>
                </div>

                {/* Campaign Body (Ad Sets) */}
                {campaignExpanded && (
                  <div className="pt-2.5 pr-5 pb-5 pl-10 flex flex-col gap-2.5">
                    {campaign.adsets?.data?.length > 0 ? campaign.adsets.data.map(adset => {
                      const adsetExpanded = expandedAdSets.has(adset.id);
                      return (
                        <div key={adset.id} className="border border-zinc-100 rounded-md overflow-hidden">
                          {/* Ad Set Header */}
                          <div
                            onClick={() => setExpandedAdSets(prev => {
                              const next = new Set(prev);
                              if (next.has(adset.id)) next.delete(adset.id);
                              else next.add(adset.id);
                              return next;
                            })}
                            className="px-4 py-3 bg-zinc-50 cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={`text-[13px] text-indigo-600 transition-transform duration-200 ${adsetExpanded ? "rotate-90" : ""}`}>▶</span>
                              <span className="text-sm font-semibold">Set: {adset.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge
                                text={adset.effective_status}
                                color={adset.effective_status === "ACTIVE" ? "#059669" : "#D97706"}
                                bg={adset.effective_status === "ACTIVE" ? "#ECFDF5" : "#FFFBEB"}
                              />
                              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEditAdSet(campaign.id, adset.id); }}
                                  className="px-3 py-1 rounded-full border border-indigo-600 bg-transparent text-indigo-600 text-[10px] font-extrabold cursor-pointer transition-all duration-200"
                                >Edit</button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(adset.id, "AdSet", "ACTIVE", "run"); }}
                                  disabled={adset.effective_status === "ACTIVE" || updatingStatusId === adset.id}
                                  className={`px-3 py-1 rounded-full border border-emerald-600 text-emerald-600 text-[10px] font-extrabold transition-all duration-200 ${adset.effective_status === "ACTIVE" ? "bg-emerald-50 cursor-default" : "bg-transparent cursor-pointer"} ${updatingStatusId === adset.id ? "opacity-50" : ""}`}
                                >Run</button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(adset.id, "AdSet", "PAUSED", "pause"); }}
                                  disabled={adset.effective_status === "PAUSED" || updatingStatusId === adset.id}
                                  className={`px-3 py-1 rounded-full border border-amber-600 text-amber-600 text-[10px] font-extrabold transition-all duration-200 ${adset.effective_status === "PAUSED" ? "bg-amber-50 cursor-default" : "bg-transparent cursor-pointer"} ${updatingStatusId === adset.id ? "opacity-50" : ""}`}
                                >Pause</button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(adset.id, "AdSet", null, "delete"); }}
                                  disabled={updatingStatusId === adset.id}
                                  className={`px-3 py-1 rounded-full border border-red-700 bg-transparent text-red-700 text-[10px] font-extrabold cursor-pointer transition-all duration-200 ${updatingStatusId === adset.id ? "opacity-50" : ""}`}
                                >Delete</button>
                              </div>
                            </div>
                          </div>

                          {/* Ad Set Body (Ads) */}
                          {adsetExpanded && (
                            <div className="p-3 flex flex-col gap-3 bg-white">
                              {adset.ads?.data?.length > 0 ? adset.ads.data.map(ad => {
                                const insights = ad.insights?.data?.[0] || {};
                                return (
                                  <div key={ad.id} className="flex gap-4 p-3 rounded-sm bg-zinc-50 border border-zinc-100 shadow-sm">
                                    {/* Ad Image/Thumbnail */}
                                    <div className="w-20 h-20 rounded-lg bg-black overflow-hidden flex-shrink-0 border border-zinc-100">
                                      {ad.creative?.thumbnail_url ? (
                                        <img src={ad.creative.thumbnail_url} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[#666] text-xl">🎬</div>
                                      )}
                                    </div>

                                    {/* Ad Info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-start mb-2">
                                        <div>
                                          <div className="text-sm font-bold mb-0.5 text-zinc-900">{ad.name}</div>
                                          <div className="text-[11px] text-zinc-500 font-mono">ID: {ad.id}</div>
                                        </div>
                                        <Badge
                                          text={ad.effective_status}
                                          color={ad.effective_status === "ACTIVE" ? "#059669" : "#D97706"}
                                          bg={ad.effective_status === "ACTIVE" ? "#ECFDF5" : "#FFFBEB"}
                                        />
                                      </div>

                                      {/* Metrics Row */}
                                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3 mb-3 bg-white p-2 md:p-3 rounded-lg border border-zinc-100">
                                        <div className="flex flex-col">
                                          <span className="text-[9px] text-zinc-500 uppercase font-bold">Spend</span>
                                          <span className="text-xs font-bold text-zinc-900">${insights.spend || "0.00"}</span>
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-[9px] text-zinc-500 uppercase font-bold">CTR</span>
                                          <span className="text-xs font-bold text-indigo-600">{parseFloat(insights.inline_link_click_ctr || 0).toFixed(2)}%</span>
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-[9px] text-zinc-500 uppercase font-bold">Clicks</span>
                                          <span className="text-xs font-bold text-zinc-900">{insights.clicks || "0"}</span>
                                        </div>
                                      </div>

                                      {/* Controls */}
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleUpdateStatus(ad.id, "Ad", "ACTIVE", "run")}
                                          disabled={ad.effective_status === "ACTIVE" || updatingStatusId === ad.id}
                                          className={`px-4 py-1.5 rounded-full border-[1.5px] border-emerald-600 text-emerald-600 text-[11px] font-extrabold transition-all duration-200 ${ad.effective_status === "ACTIVE" ? "bg-emerald-50 cursor-default" : "bg-transparent cursor-pointer"} ${updatingStatusId === ad.id ? "opacity-50" : ""}`}
                                        >
                                          Run
                                        </button>
                                        <button
                                          onClick={() => handleUpdateStatus(ad.id, "Ad", "PAUSED", "pause")}
                                          disabled={ad.effective_status === "PAUSED" || updatingStatusId === ad.id}
                                          className={`px-4 py-1.5 rounded-full border-[1.5px] border-amber-600 text-amber-600 text-[11px] font-extrabold transition-all duration-200 ${ad.effective_status === "PAUSED" ? "bg-amber-50 cursor-default" : "bg-transparent cursor-pointer"} ${updatingStatusId === ad.id ? "opacity-50" : ""}`}
                                        >
                                          Pause
                                        </button>
                                        <button
                                          onClick={() => handleUpdateStatus(ad.id, "Ad", null, "delete")}
                                          disabled={updatingStatusId === ad.id}
                                          className={`px-4 py-1.5 rounded-full border-[1.5px] border-red-700 bg-transparent text-red-700 text-[11px] font-extrabold cursor-pointer transition-all duration-200 ${updatingStatusId === ad.id ? "opacity-50" : ""}`}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }) : <div className="text-xs text-zinc-400 text-center p-2.5">No ads found in this set.</div>}
                            </div>
                          )}
                        </div>
                      );
                    }) : <div className="text-[13px] text-zinc-400 p-5 text-center">No ad sets found in this campaign.</div>}
                  </div>
                )}
              </Card>
            );
          })}
          {editModalOpen && (
            <div className="fixed top-0 left-0 w-full h-full bg-black/50 z-[9999] flex items-center justify-center backdrop-blur-[4px]">
              <div className="bg-zinc-50 w-[500px] max-w-[90%] rounded-lg p-6 flex flex-col gap-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold">Edit {editType}</div>
                  <button onClick={() => setEditModalOpen(false)} className="bg-transparent border-none text-xl cursor-pointer text-zinc-500">×</button>
                </div>

                {editLoading ? (
                  <div className="p-10 flex justify-center"><Spinner size={24} color="#4F46E5" /></div>
                ) : editError ? (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-[13px]">{editError}</div>
                ) : editData ? (
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="text-xs font-bold text-zinc-500 mb-1">Name</div>
                      <input
                        type="text"
                        value={editData.name || ""}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 outline-none text-sm"
                      />
                    </div>
                    {editType === "AdSet" && (
                      <>
                        <div>
                          <div className="text-xs font-bold text-zinc-500 mb-1">Daily Budget (in cents)</div>
                          <input
                            type="number"
                            value={editData.daily_budget || ""}
                            onChange={(e) => setEditData({ ...editData, daily_budget: e.target.value })}
                            className="w-full p-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 outline-none text-sm"
                          />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-zinc-500 mb-1">Target Locations (Country Codes, e.g. US, CA)</div>
                          <input
                            type="text"
                            value={(() => {
                              let t = editData.targeting;
                              if (typeof t === 'string') try { t = JSON.parse(t); } catch (e) { t = {}; }
                              return t?.geo_locations?.countries?.join(', ') || "";
                            })()}
                            onChange={(e) => updateTargeting('countries', e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 outline-none text-sm"
                          />
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <div className="text-xs font-bold text-zinc-500 mb-1">Age Min</div>
                            <input
                              type="number" min="18" max="65"
                              value={(() => {
                                let t = editData.targeting;
                                if (typeof t === 'string') try { t = JSON.parse(t); } catch (e) { t = {}; }
                                return t?.age_min || 18;
                              })()}
                              onChange={(e) => updateTargeting('age_min', e.target.value)}
                              className="w-full p-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 outline-none text-sm"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-bold text-zinc-500 mb-1">Age Max</div>
                            <input
                              type="number" min="18" max="65"
                              value={(() => {
                                let t = editData.targeting;
                                if (typeof t === 'string') try { t = JSON.parse(t); } catch (e) { t = {}; }
                                return t?.age_max || 65;
                              })()}
                              onChange={(e) => updateTargeting('age_max', e.target.value)}
                              className="w-full p-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 outline-none text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <div className="text-xs font-bold text-zinc-500 mb-1">Gender</div>
                            <select
                              value={(() => {
                                let t = editData.targeting;
                                if (typeof t === 'string') try { t = JSON.parse(t); } catch (e) { t = {}; }
                                return t?.genders?.[0] || '0';
                              })()}
                              onChange={(e) => updateTargeting('gender', e.target.value)}
                              className="w-full p-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 outline-none text-sm"
                            >
                              <option value="0">All</option>
                              <option value="1">Male</option>
                              <option value="2">Female</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-bold text-zinc-500 mb-1">End Date (Optional)</div>
                            <input
                              type="datetime-local"
                              value={editData.end_time ? new Date(editData.end_time).toISOString().slice(0, 16) : ""}
                              onChange={(e) => {
                                const newDate = e.target.value ? new Date(e.target.value).toISOString() : null;
                                setEditData({ ...editData, end_time: newDate });
                              }}
                              className="w-full p-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 outline-none text-sm"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="flex gap-2.5 mt-3">
                      <button
                        onClick={() => setEditModalOpen(false)}
                        className="flex-1 p-3 rounded-lg bg-zinc-50 border border-zinc-200 cursor-pointer font-semibold text-zinc-900"
                      >Cancel</button>
                      <button
                        onClick={saveEdit}
                        disabled={editSaving}
                        className={`flex-1 p-3 rounded-lg bg-indigo-600 border-none font-semibold text-white flex justify-center items-center gap-2 ${editSaving ? "cursor-default opacity-70" : "cursor-pointer"}`}
                      >
                        {editSaving ? <Spinner size={16} /> : "Save Changes"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}



      {/* ═══════════════════════════════════════════════════════
          REPORTS — Meta Ads Performance Dashboard
      ═══════════════════════════════════════════════════════ */}
      {tab === "reports" && (
        <div className="animate-fade-in flex flex-col gap-5 pb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2.5">
            <div>
              <SectionTitle className="!mb-1">Meta Ads Performance</SectionTitle>
              <div className="text-[13px] text-zinc-500">
                Real-time metrics and campaign performance directly from your Meta Ad Account.
              </div>
            </div>
            <button
              onClick={fetchMetaInsights}
              disabled={metaReportsLoading}
              className="px-4 py-2 rounded-[10px] border border-zinc-200 bg-white text-[13px] flex items-center gap-2 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 enabled:cursor-pointer"
            >
              {metaReportsLoading ? <Spinner size={12} /> : "↻"} Refresh Data
            </button>
          </div>

          {metaReportsError && (
            <Card className="bg-red-50 border-red-700">
              <div className="text-red-700 text-sm">{metaReportsError}</div>
            </Card>
          )}

          {!metaInsights && !metaReportsLoading && !metaReportsError && (
            <Card>
              <div className="flex flex-col items-center px-5 py-[60px]">
                <div className="text-[40px] mb-4">📊</div>
                <div className="text-base font-semibold mb-2">Ready to load Meta Insights</div>
                <div className="text-[13px] text-zinc-500 mb-5">Sync your live Facebook ad metrics into the dashboard.</div>
                <button
                  onClick={fetchMetaInsights}
                  className="px-6 py-2.5 rounded-md bg-indigo-600 text-white text-sm font-bold cursor-pointer shadow-[0_4px_12px_rgba(2,132,199,0.25)]"
                >
                  Load Performance Data
                </button>
              </div>
            </Card>
          )}

          {metaReportsLoading && !metaInsights && (
            <Card>
              <div className="flex flex-col items-center px-5 py-[60px] gap-4">
                <Spinner size={32} color="#4F46E5" />
                <div className="text-[15px] font-semibold text-indigo-600">Connecting to Meta Graph API...</div>
              </div>
            </Card>
          )}

          {metaInsights && (
            <>
              {/* Account Level KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-3">
                <MetricCard
                  label="Total Spend"
                  value={`$${parseFloat(metaInsights.spend || 0).toFixed(2)}`}
                  sub="All Time"
                  color="#3B82F6" bg="#EFF6FF"
                />
                <MetricCard
                  label="Impressions"
                  value={parseFloat(metaInsights.impressions || "0").toLocaleString()}
                  sub={`Reach: ${parseFloat(metaInsights.reach || "0").toLocaleString()}`}
                  color="#4F46E5" bg="#EEF2FF"
                />
                <MetricCard
                  label="Link Clicks"
                  value={parseFloat(metaInsights.linkClicks || "0").toLocaleString()}
                  sub={`CTR: ${parseFloat(metaInsights.inline_link_click_ctr || 0).toFixed(2)}%`}
                  color="#D97706" bg="#FFFBEB"
                />
                <MetricCard
                  label="Conversions"
                  value={parseFloat(metaInsights.leads || "0").toLocaleString()}
                  sub="Leads/Responses"
                  color="#059669" bg="#ECFDF5"
                />
              </div>

              {/* Campaign Breakdown */}
              <Card className="!p-0 overflow-hidden">
                <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
                  <span className="text-[15px] font-bold">Campaign Breakdown</span>
                </div>

                {metaCampaignInsights.length === 0 ? (
                  <div className="p-10 text-center text-zinc-500 text-sm">
                    No campaigns found
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[13px] min-w-[900px]">
                      <thead>
                        <tr className="bg-white">
                          <th className="px-5 py-3 text-left font-semibold text-zinc-500 border-b border-zinc-200 text-[11px] uppercase">Campaign</th>
                          <th className="px-5 py-3 text-left font-semibold text-zinc-500 border-b border-zinc-200 text-[11px] uppercase">Status</th>
                          <th className="px-5 py-3 text-right font-semibold text-zinc-500 border-b border-zinc-200 text-[11px] uppercase">Spend</th>
                          <th className="px-5 py-3 text-right font-semibold text-zinc-500 border-b border-zinc-200 text-[11px] uppercase">Impr.</th>
                          <th className="px-5 py-3 text-right font-semibold text-zinc-500 border-b border-zinc-200 text-[11px] uppercase">CTR</th>
                          <th className="px-5 py-3 text-right font-semibold text-zinc-500 border-b border-zinc-200 text-[11px] uppercase">Leads</th>
                          <th className="px-5 py-3 text-center font-semibold text-zinc-500 border-b border-zinc-200 text-[11px] uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metaCampaignInsights.map(c => {
                          const ins = c.insights || {};
                          return (
                            <tr key={c.id} className="border-b border-zinc-100">
                              <td className="px-5 py-4">
                                <div className="font-semibold text-zinc-900">{c.name}</div>
                                <div className="text-[11px] text-zinc-500 mt-1">ID: {c.id}</div>
                              </td>
                              <td className="px-5 py-4">
                                <Badge
                                  text={c.effective_status}
                                  color={c.effective_status === "ACTIVE" ? "#059669" : "#D97706"}
                                  bg={c.effective_status === "ACTIVE" ? "#ECFDF5" : "#FFFBEB"}
                                />
                              </td>
                              <td className="px-5 py-4 text-right font-semibold">
                                ${parseFloat(ins.spend || 0).toFixed(2)}
                              </td>
                              <td className="px-5 py-4 text-right">
                                {parseFloat(ins.impressions || "0").toLocaleString()}
                              </td>
                              <td className="px-5 py-4 text-right text-indigo-600 font-semibold">
                                {parseFloat(ins.inline_link_click_ctr || 0).toFixed(2)}%
                              </td>
                              <td className="px-5 py-4 text-right font-semibold">
                                {parseFloat(ins.leads || "0").toLocaleString()}
                              </td>
                              <td className="px-5 py-4 text-center">
                                <button
                                  onClick={() => setSelectedCampaignForReports(c)}
                                  className="px-3 py-1.5 rounded-[10px] border border-zinc-200 bg-white cursor-pointer text-xs font-medium text-indigo-600 transition-all duration-150 hover:bg-indigo-50"
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── REPORTS AD DETAILS MODAL ── */}
      {selectedCampaignForReports && (() => {
        const c = selectedCampaignForReports;
        let allAds = [];
        if (c.adsets && c.adsets.length > 0) {
          c.adsets.forEach(adset => {
            if (adset.ads && adset.ads.length > 0) {
              allAds.push(...adset.ads);
            }
          });
        }

        return (
          <div
            onClick={() => setSelectedCampaignForReports(null)}
            className="animate-in fade-in duration-300 fixed inset-0 z-[1000] bg-black/50 backdrop-blur-[4px] flex items-center justify-center p-5"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-scale-in w-full max-w-[900px] max-h-[85vh] bg-white border-[0.5px] border-zinc-200 rounded-lg shadow-lg flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-[18px] border-b border-zinc-200 bg-zinc-50">
                <div>
                  <div className="text-lg font-bold text-zinc-900">Campaign Creatives & Breakdown</div>
                  <div className="text-[13px] text-zinc-500 mt-1">
                    {c.name} • {allAds.length} attached creative{allAds.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCampaignForReports(null)}
                  className="w-8 h-8 rounded-full border border-zinc-200 bg-white cursor-pointer flex items-center justify-center text-base transition-colors duration-150 hover:bg-zinc-100"
                >✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                {allAds.length === 0 ? (
                  <div className="text-center p-[60px] text-zinc-500">
                    <div className="text-[40px] mb-3">🖼️</div>
                    <div className="text-[15px] font-medium">No ad creatives found for this campaign.</div>
                  </div>
                ) : (
                  allAds.map(ad => {
                    const ins = ad.insights || {};
                    const thumbUrl = ad.creative?.thumbnail_url || null;
                    return (
                      <div key={ad.id} className="flex gap-4 bg-zinc-50 border border-zinc-100 rounded-md p-4 items-center">
                        <div className="w-[100px] h-[100px] rounded-sm border border-zinc-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                          {thumbUrl ? (
                            <img src={thumbUrl} alt="Ad Thumbnail" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-2xl">🎬</div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="font-semibold text-[15px] text-zinc-900">{ad.name}</div>
                            <Badge
                              text={ad.effective_status}
                              color={ad.effective_status === "ACTIVE" ? "#059669" : "#D97706"}
                              bg={ad.effective_status === "ACTIVE" ? "#ECFDF5" : "#FFFBEB"}
                            />
                          </div>
                          <div className="text-xs text-zinc-500 mb-3">Ad ID: {ad.id}</div>

                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="bg-white px-3 py-2 rounded-sm border border-zinc-100">
                              <div className="text-[10px] uppercase text-zinc-500 font-semibold">Spend</div>
                              <div className="text-sm font-bold">${parseFloat(ins.spend || 0).toFixed(2)}</div>
                            </div>
                            <div className="bg-white px-3 py-2 rounded-sm border border-zinc-100">
                              <div className="text-[10px] uppercase text-zinc-500 font-semibold">Impressions</div>
                              <div className="text-sm font-bold">{parseFloat(ins.impressions || "0").toLocaleString()}</div>
                            </div>
                            <div className="bg-white px-3 py-2 rounded-sm border border-zinc-100">
                              <div className="text-[10px] uppercase text-zinc-500 font-semibold">CTR</div>
                              <div className="text-sm font-bold text-indigo-600">{parseFloat(ins.inline_link_click_ctr || 0).toFixed(2)}%</div>
                            </div>
                            <div className="bg-white px-3 py-2 rounded-sm border border-zinc-100">
                              <div className="text-[10px] uppercase text-zinc-500 font-semibold">Leads</div>
                              <div className="text-sm font-bold text-emerald-600">{parseFloat(ins.leads || "0").toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
          SOCIAL-DASH — Creator Studio Section
      ═══════════════════════════════════════════════════════ */}
      {tab === "social-dash" && (
        <div className="animate-fade-in -m-10 p-10 rounded-lg min-h-[calc(100vh-100px)]">
          <SocialDash />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          AD DETAILS MODAL (POP-UP)
      ═══════════════════════════════════════════════════════ */}
      {selectedAdForDetails && (() => {
        // Reactive lookup: ensure modal status stays in sync with state updates
        const adId = selectedAdForDetails.id;
        const adTime = selectedAdForDetails.time;

        const currentAdInCreate = adTableLinks[adId];
        const currentAdInApproved = allApprovedAds.find(x => x.id === adId && x.time === adTime);

        // Prioritize live status from state
        const ad = (currentAdInCreate?.time === adTime ? currentAdInCreate : null)
          || currentAdInApproved
          || selectedAdForDetails;

        let jsonData = {};
        try {
          const raw = ad["json data"];
          jsonData = typeof raw === "string" ? JSON.parse(raw) : (raw || {});
        } catch (e) { console.error("JSON parse error:", e); }

        const isVid = (ad.format || "").toLowerCase() === "video";

        return (
          <div
            className="animate-in fade-in duration-300 fixed inset-0 z-[2000] bg-black/85 backdrop-blur-md flex items-center justify-center p-5"
            onClick={() => { setSelectedAdForDetails(null); setIsEditingAd(false); setIsRetryingAd(false); setRetryPrompt(""); }}
          >
            <div
              className="animate-in zoom-in-95 duration-300 bg-white w-full max-w-[900px] rounded-lg overflow-hidden flex flex-col max-h-[90vh] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-zinc-200 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Retry Overlay */}
              {isRetryingAd && (
                <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-lg flex items-center justify-center p-10">
                  <div className="w-full max-w-[500px] bg-white p-[30px] rounded-lg shadow-lg border border-zinc-200">
                    <div className="text-lg font-bold mb-3 text-zinc-900">Retry Generation</div>
                    <div className="text-[13px] text-zinc-500 mb-5">
                      Provide specific instructions for the AI to improve this creative.
                    </div>
                    <textarea
                      autoFocus
                      placeholder="e.g. Make it more cinematic and focus on the artist's hands..."
                      value={retryPrompt}
                      onChange={(e) => setRetryPrompt(e.target.value)}
                      className="w-full min-h-[120px] p-[15px] rounded-md border border-zinc-200 bg-zinc-50 text-sm outline-none text-zinc-900 resize-none mb-5"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => setIsRetryingAd(false)}
                        className="flex-1 p-3 rounded-md border border-zinc-200 bg-zinc-50 text-zinc-900 font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleRetryAdSubmit(ad)}
                        disabled={!retryPrompt || isRetryingSubmit}
                        className={`flex-1 p-3 rounded-md border-none bg-indigo-600 text-white font-bold ${(retryPrompt && !isRetryingSubmit) ? "cursor-pointer opacity-100" : "cursor-not-allowed opacity-60"}`}
                      >
                        {isRetryingSubmit ? <Spinner size={14} /> : "Submit Retry →"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Badge
                    text={isVid ? "Video Ads" : "Image Ads"}
                    color={isVid ? "#4F46E5" : "#D97706"}
                    bg={isVid ? "#EEF2FF" : "#FFFBEB"}
                  />
                  <span className="font-bold text-sm">AD ID: {ad.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditingAd && !isRetryingAd && (
                    <>
                      <button
                        onClick={() => {
                          setIsEditingAd(true);
                          const firstAd = jsonData.ad || jsonData.ads?.[0] || {};
                          setEditingAdData({
                            campaignName: jsonData.campaign?.name || "Untitled Campaign",
                            adName: firstAd.name || "Untitled Ad",
                            headline: firstAd.headline || "No headline provided.",
                            ctaType: firstAd.call_to_action_type || "WATCH_MORE",
                            linkData: jsonData.link_data || ad.text || ""
                          });
                        }}
                        className="px-3 py-[5px] rounded-sm border border-zinc-200 bg-zinc-50 text-indigo-600 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                      >
                        ✎ Edit
                      </button>
                      <button
                        onClick={() => setIsRetryingAd(true)}
                        className="px-3 py-[5px] rounded-sm border border-zinc-200 bg-zinc-50 text-amber-700 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                      >
                        ↻ Retry
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { setSelectedAdForDetails(null); setIsEditingAd(false); setIsRetryingAd(false); setRetryPrompt(""); }}
                    className="bg-transparent border-none text-2xl cursor-pointer text-zinc-400 ml-2"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                {/* Media Column */}
                <div className="w-full lg:w-[40%] bg-black flex items-center justify-center border-b lg:border-b-0 lg:border-r border-zinc-100 min-h-[300px]">
                  {isVid ? (
                    <video src={ad.text} controls autoPlay={false} className="w-full h-full object-contain" />
                  ) : (
                    <img src={ad.text} alt="Ad detail" className="w-full h-full object-contain" />
                  )}
                </div>

                {/* Info Column */}
                <div className="w-full lg:w-[60%] p-4 lg:p-6 overflow-y-auto flex flex-col gap-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">Campaign Name</label>
                      {isEditingAd ? (
                        <input
                          value={editingAdData.campaignName}
                          onChange={(e) => setEditingAdData({ ...editingAdData, campaignName: e.target.value })}
                          className="w-full px-3 py-2 rounded-md border border-indigo-600 bg-white text-sm font-semibold outline-none"
                        />
                      ) : (
                        <div className="text-[15px] font-semibold">{jsonData.campaign?.name || "Untitled Campaign"}</div>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">Ad Name</label>
                      {isEditingAd ? (
                        <input
                          value={editingAdData.adName}
                          onChange={(e) => setEditingAdData({ ...editingAdData, adName: e.target.value })}
                          className="w-full px-3 py-2 rounded-md border border-indigo-600 bg-white text-sm font-semibold outline-none"
                        />
                      ) : (
                        <div className="text-[15px] font-semibold text-zinc-700">{jsonData.ad?.name || jsonData.ads?.[0]?.name || "Untitled Ad"}</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">Ad Headline</label>
                    {isEditingAd ? (
                      <textarea
                        value={editingAdData.headline}
                        onChange={(e) => setEditingAdData({ ...editingAdData, headline: e.target.value })}
                        className="w-full min-h-20 p-3 rounded-md border border-indigo-600 bg-white text-sm leading-relaxed outline-none resize-y"
                      />
                    ) : (
                      <div className="text-sm leading-relaxed text-zinc-900 bg-zinc-50 p-3 rounded-md border border-zinc-100">
                        {jsonData.ad?.headline || jsonData.ads?.[0]?.headline || jsonData.description || "No headline provided."}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">Call to Action (Type)</label>
                      {isEditingAd ? (
                        <select
                          value={editingAdData.ctaType}
                          onChange={(e) => {
                            const newCta = e.target.value;
                            const suggestions = {
                              WHATSAPP_MESSAGE: "+10000000000",
                              CONTACT_US: "https://togahh.com/contact",
                              MESSAGE_PAGE: "https://m.me/togahh",
                            };
                            setEditingAdData({
                              ...editingAdData,
                              ctaType: newCta,
                              linkData: suggestions[newCta] || "https://togahh.com/"
                            });
                          }}
                          className="w-full px-3 py-2 rounded-md border border-indigo-600 bg-white text-[13px] font-semibold outline-none"
                        >
                          <option value="WATCH_MORE">WATCH_MORE</option>
                          <option value="LEARN_MORE">LEARN_MORE</option>
                          <option value="BOOK_NOW">BOOK_NOW</option>
                          <option value="SHOP_NOW">SHOP_NOW</option>
                          <option value="SIGN_UP">SIGN_UP</option>
                          <option value="CONTACT_US">CONTACT_US</option>
                          <option value="APPLY_NOW">APPLY_NOW</option>
                          <option value="GET_OFFER">GET_OFFER</option>
                          <option value="WHATSAPP_MESSAGE">WHATSAPP_MESSAGE</option>
                          <option value="MESSAGE_PAGE">MESSAGE_PAGE</option>
                        </select>
                      ) : (
                        <div className="inline-block px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[13px] font-semibold">
                          {jsonData.ad?.call_to_action_type || jsonData.ads?.[0]?.call_to_action_type || jsonData.cta || "WATCH_MORE"}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">Media Link / Link Data</label>
                      {isEditingAd ? (
                        <input
                          value={editingAdData.linkData}
                          onChange={(e) => setEditingAdData({ ...editingAdData, linkData: e.target.value })}
                          className="w-full px-3 py-2 rounded-md border border-indigo-600 bg-white text-[13px] outline-none"
                        />
                      ) : (
                        <a href={jsonData.link_data || jsonData.link || ad.text} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-[13px] no-underline font-medium">
                          {(jsonData.link_data || jsonData.link || ad.text) ? "View Link ↗" : "N/A"}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto pt-5 border-t border-zinc-100 flex gap-3">
                    {isEditingAd ? (
                      <>
                        <button
                          onClick={() => setIsEditingAd(false)}
                          className="flex-1 p-3 bg-zinc-50 border border-zinc-200 rounded-md text-zinc-900 font-semibold text-[13px] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdits(ad)}
                          disabled={isSavingAd}
                          className="flex-1 p-3 bg-indigo-600 border-none rounded-md text-white font-bold text-[13px] cursor-pointer"
                        >
                          {isSavingAd ? <Spinner size={12} /> : "Save Changes"}
                        </button>
                      </>
                    ) : (
                      <>
                        <a
                          href={ad.text}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 no-underline text-center p-3 bg-zinc-50 border border-zinc-200 rounded-md text-zinc-900 font-semibold text-[13px]"
                        >
                          Download Media
                        </a>
                        <button
                          className={`flex-1 p-3 border-none rounded-md font-bold text-[13px] transition-all duration-200 ${
                            ad.Approved ? "bg-emerald-50 text-emerald-600 cursor-default" : "bg-indigo-600 text-white cursor-pointer"
                          } ${approvingId === (ad.id + "_" + ad.time) ? "opacity-70" : ""}`}
                          disabled={ad.Approved || approvingId === (ad.id + "_" + ad.time)}
                          onClick={async () => {
                            await handleApproveAd(ad);
                          }}
                        >
                          {approvingId === (ad.id + "_" + ad.time) ? (
                            <Spinner size={12} />
                          ) : ad.Approved ? (
                            "✓ Approved"
                          ) : (
                            "✓ Approve Ad"
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5">
        {sbToasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast flex min-w-[280px] items-center gap-3 rounded-md border bg-white px-5 py-3.5 shadow-lg border-l-4 ${
              t.type === "error"
                ? "border-red-500 border-l-red-500"
                : "border-indigo-600 border-l-indigo-600"
            }`}
          >
            <span className="text-lg">{t.type === "error" ? "⚠️" : "✨"}</span>
            <div className="flex flex-col">
              <div className="text-[13px] font-bold text-zinc-900">
                {t.type === "error" ? "Error" : "Success"}
              </div>
              <div className="text-xs text-zinc-700">{t.message}</div>
            </div>
            <button
              onClick={() => setSbToasts(prev => prev.filter(toast => toast.id !== t.id))}
              className="ml-auto cursor-pointer border-none bg-transparent text-base text-zinc-400"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      </div>
    </AppShell>
  );
}
