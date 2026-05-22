'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Card, SectionTitle, Badge, Spinner, PrimaryButton } from './components';
import { cn } from '@/lib/utils';

// ─── HELPERS ─────────────────────────────────────────────────
/**
 * Ensures Supabase storage URLs use the current project's hostname.
 */
const normalizeSupabaseUrl = (url: unknown): string => {
  if (!url || typeof url !== 'string') return (url as string) ?? '';
  const currentUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!currentUrl) return url;

  if (url.includes('/storage/v1/object/')) {
    const parts = url.split('/object/');
    if (parts.length < 2) return url;

    const pathParts = parts[1].replace(/^(public\/|authenticated\/)/, '').split('/');
    const bucket = pathParts[0];
    const filename = pathParts.slice(1).join('/');

    if (!bucket || !filename) return url;

    return `${currentUrl}/storage/v1/object/public/${bucket}/${filename}`;
  }
  return url;
};

// ─── DEFAULT SCHEMA ────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: CampaignConfig = {
  campaign: {
    name: 'treatment_pathway_q2_2026',
    objective: 'OUTCOME_TRAFFIC',
    buying_type: 'AUCTION',
    special_ad_categories: ['NONE'],
    is_adset_budget_sharing_enabled: false,
  },
  ad_set: {
    name: 'Regional_Health_30-65_All',
    daily_budget: 5000,
    lifetime_budget: 50000,
    budget_type: 'DAILY',
    start_time: new Date().toISOString().slice(0, 16),
    stop_time: '',
    has_end_date: false,
    age_min: 30,
    age_max: 65,
    gender: 0,
    geo_locations: {
      countries: ['CA', 'GB'],
      location_types: ['home', 'recent'],
    },
    optimization_goal: 'OFFSITE_CONVERSIONS',
    targeting_keywords: [
      'healthcare services',
      'medical specialists',
      'orthopedic care',
      'specialized clinic',
      'preventative health',
      'JCI accredited',
      'affordable surgery',
      'cardiology unit',
      'diagnostic imaging',
      'patient safety',
    ],
  },
  ad: {
    id: Date.now(),
    name: 'Video_PatientJourney_H1',
    type: 'video',
    media_type: 'video',
    headline: 'World-Class Surgical Care & Safety',
    description:
      'Experience our state-of-the-art medical facilities and patient-centered care.',
    primary_text:
      'From referral to recovery — experience JCI‑accredited excellence, state‑of‑the‑art facilities, and compassionate patient care. Watch our facility tour and book an initial consultation.',
    website_url: 'https://togahh.com/',
    display_link: 'togahh.com',
    call_to_action_type: 'LEARN_MORE',
    facebook_page: 'TogaHealth',
    instagram_account: 'togahealth_official',
  },
  link_data: normalizeSupabaseUrl(
    'https://nidoqmcxmlyiovdktzxg.supabase.co/storage/v1/object/AD1/08-04-2026_11-55AM.mp4'
  ),
};

// ─── TYPES ─────────────────────────────────────────────────────────────────────
interface GeoEntry {
  key: string;
  name?: string;
  country_code?: string;
}

interface GeoLocations {
  countries?: string[];
  cities?: GeoEntry[];
  regions?: GeoEntry[];
  zips?: GeoEntry[];
  location_types?: string[];
}

interface CampaignPart {
  name?: string;
  objective?: string;
  buying_type?: string;
  special_ad_categories?: string[];
  is_adset_budget_sharing_enabled?: boolean;
}

interface AdSetPart {
  name?: string;
  daily_budget?: number;
  lifetime_budget?: number;
  budget_type?: string;
  start_time?: string;
  stop_time?: string;
  has_end_date?: boolean;
  age_min?: number;
  age_max?: number;
  gender?: number;
  geo_locations?: GeoLocations;
  geo_targeting?: string[];
  optimization_goal?: string;
  targeting_keywords?: string[];
  dsa_beneficiary?: string;
  dsa_payor?: string;
}

interface AdPart {
  id?: number | string;
  name?: string;
  type?: string;
  media_type?: string;
  headline?: string;
  description?: string;
  primary_text?: string;
  website_url?: string;
  display_link?: string;
  call_to_action_type?: string;
  facebook_page?: string;
  instagram_account?: string;
}

interface CampaignConfig {
  campaign?: CampaignPart;
  ad_set?: AdSetPart;
  ad?: AdPart;
  link_data?: string;
  ads?: AdPart[];
}

interface CampaignRow {
  id: string;
  name: string;
  effective_status?: string;
  objective?: string;
  status?: string;
}

interface SelectedAdShape {
  id?: number | string;
  format?: string;
  text?: string;
  'json data'?: string | CampaignConfig;
}

interface CampaignSetupProps {
  onSelect: (campaign: CampaignRow | null) => void;
  selectedId?: string | null;
  selectedAd?: SelectedAdShape | null;
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const GENDER_LABELS: Record<number, string> = { 0: 'All Patients', 1: 'Male', 2: 'Female' };
const BUYING_TYPES = ['AUCTION', 'REACH'];
const CAMPAIGN_OBJECTIVES = [
  { value: 'OUTCOME_AWARENESS', label: 'Awareness', icon: '📢' },
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic', icon: '🌐' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement', icon: '💬' },
  { value: 'OUTCOME_LEADS', label: 'Leads', icon: '📋' },
  { value: 'OUTCOME_APP_PROMOTION', label: 'App Promotion', icon: '📱' },
  { value: 'OUTCOME_SALES', label: 'Sales', icon: '🛍️' },
];
const OPTIMIZATION_GOALS = [
  { value: 'OFFSITE_CONVERSIONS', label: 'Conversions' },
  { value: 'LINK_CLICKS', label: 'Link Clicks' },
  { value: 'REACH', label: 'Reach' },
  { value: 'IMPRESSIONS', label: 'Impressions' },
  { value: 'POST_ENGAGEMENT', label: 'Post Engagement' },
];
const BUDGET_TYPES = [
  { value: 'DAILY', label: 'Daily budget' },
  { value: 'LIFETIME', label: 'Lifetime budget' },
];

// ─── SHARED CLASS STRINGS ──────────────────────────────────────────────────────
const inputClass =
  'w-full rounded-md border-[1.5px] border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm font-medium text-zinc-900 outline-none transition-all duration-200 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10';

export default function CampaignSetup({ onSelect, selectedId, selectedAd }: CampaignSetupProps) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');

  const [config, setConfig] = useState<CampaignConfig>(DEFAULT_CONFIG);
  const [configJson, setConfigJson] = useState(JSON.stringify(DEFAULT_CONFIG, null, 2));
  const [jsonError, setJsonError] = useState('');
  const [showRawJson, setShowRawJson] = useState(false);

  const [launching, setLaunching] = useState(false);
  const [launchStep, setLaunchStep] = useState(0);
  const [launchError, setLaunchError] = useState('');
  const [launchSuccess, setLaunchSuccess] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/meta/live-campaigns');
      const data = await res.json();
      if (res.ok) {
        setCampaigns((data as CampaignRow[]) || []);
      } else {
        setError(data.error || 'Failed to fetch campaigns');
      }
    } catch {
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (selectedAd) {
      try {
        let parsed: CampaignConfig = {};
        const raw = selectedAd['json data'];
        if (typeof raw === 'string') {
          parsed = JSON.parse(raw) as CampaignConfig;
        } else if (raw) {
          parsed = raw;
        }

        const isVideo = (selectedAd.format || '').toLowerCase() === 'video';

        const newConfig: CampaignConfig = { ...DEFAULT_CONFIG };
        if (parsed.campaign)
          newConfig.campaign = { ...DEFAULT_CONFIG.campaign, ...parsed.campaign };
        if (parsed.ad_set) newConfig.ad_set = { ...DEFAULT_CONFIG.ad_set, ...parsed.ad_set };

        if (parsed.ad) {
          newConfig.ad = { ...DEFAULT_CONFIG.ad, ...parsed.ad };
        } else if (parsed.ads && parsed.ads[0]) {
          newConfig.ad = { ...DEFAULT_CONFIG.ad, ...parsed.ads[0] };
        }

        if (newConfig.ad) {
          newConfig.ad.id = selectedAd.id || Date.now();
          newConfig.ad.media_type = isVideo ? 'video' : 'image';
          newConfig.ad.type = isVideo ? 'video' : 'image';
        }
        if (selectedAd.text) {
          newConfig.link_data = selectedAd.text;
        }

        setConfig(newConfig);
        setConfigJson(JSON.stringify(newConfig, null, 2));
        setJsonError('');
      } catch (e) {
        console.error('Failed to parse selectedAd', e);
      }
    }
  }, [selectedAd]);

  useEffect(() => {
    try {
      const parsed: CampaignConfig =
        typeof configJson === 'string' ? (JSON.parse(configJson) as CampaignConfig) : { ...config };
      let changed = false;

      if (selectedId && parsed.campaign) {
        delete parsed.campaign;
        changed = true;
      } else if (!selectedId && !parsed.campaign) {
        parsed.campaign = DEFAULT_CONFIG.campaign;
        changed = true;
      }

      if (changed) {
        setConfig(parsed);
        setConfigJson(JSON.stringify(parsed, null, 2));
      }
    } catch {
      // Ignore parse errors during transition
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleJsonChange = (raw: string) => {
    setConfigJson(raw);
    try {
      const parsed = JSON.parse(raw) as CampaignConfig;
      setConfig(parsed);
      setJsonError('');
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : String(e));
    }
  };

  const setField = <S extends 'campaign' | 'ad_set' | 'ad'>(
    section: S,
    key: string,
    value: unknown
  ) => {
    const next: CampaignConfig = {
      ...config,
      [section]: { ...(config[section] as Record<string, unknown>), [key]: value },
    };
    setConfig(next);
    setConfigJson(JSON.stringify(next, null, 2));
  };

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCampaignName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/meta/live-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCampaignName }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewCampaignName('');
        await fetchCampaigns();
      } else {
        alert(data.error || 'Failed to create campaign');
      }
    } catch {
      alert('Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const handleCTAChange = (newCta: string) => {
    const suggestions: Record<string, string> = {
      WHATSAPP_MESSAGE: '+10000000000',
      CONTACT_US: 'https://togahh.com/contact',
      MESSAGE_PAGE: 'https://m.me/togahh',
    };

    const nextLink = suggestions[newCta] || 'https://togahh.com/';

    const nextConfig: CampaignConfig = {
      ...config,
      ad: {
        ...config.ad,
        call_to_action_type: newCta,
        website_url: nextLink,
      },
    };
    setConfig(nextConfig);
    setConfigJson(JSON.stringify(nextConfig, null, 2));
  };

  const handleFullLaunch = async () => {
    setLaunching(true);
    setLaunchError('');
    setLaunchSuccess(false);
    setLaunchStep(1);

    try {
      const res = await fetch('/api/meta/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: config,
          campaignId: selectedId || null,
        }),
      });

      let data: { error?: string };
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server error: ${text.slice(0, 100)}...`);
      }

      if (res.ok) {
        setLaunchStep(5);
        setLaunchSuccess(true);
        await fetchCampaigns();
      } else {
        let errMsg = data.error || 'Launch failed';
        if (errMsg.includes('1885760')) {
          errMsg =
            "Goal Mismatch: The selected campaign uses a different Optimization Goal. Tip: Click 'Reset Selection' to launch as a New Pathway, or match the existing campaign's goal.";
        }
        setLaunchError(errMsg);
        setLaunchStep(0);
      }
    } catch (e) {
      let friendlyMsg = e instanceof Error ? e.message : String(e);
      if (friendlyMsg.includes('1885760')) {
        friendlyMsg =
          "Goal Mismatch: The selected campaign uses a different Optimization Goal. Tip: Click 'Reset Selection' to launch as a New Pathway, or match the existing campaign's goal.";
      } else if (friendlyMsg.includes('100')) {
        friendlyMsg = 'Invalid Parameter: Please check your budget or targeting settings.';
      }
      setLaunchError(friendlyMsg);
      setLaunchStep(0);
    } finally {
      setLaunching(false);
    }
  };

  const getStatusBadgeColors = (status?: string): { color: string; bg: string } => {
    switch (status) {
      case 'ACTIVE':
        return { color: '#059669', bg: '#ECFDF5' };
      case 'PAUSED':
        return { color: '#D97706', bg: '#FFFBEB' };
      case 'IN_PROCESS':
        return { color: '#4F46E5', bg: '#EEF2FF' };
      default:
        return { color: '#71717A', bg: '#FAFAFA' };
    }
  };

  const selectedCampaign = campaigns.find((c) => c.id === selectedId);
  const isVideo = config.ad?.media_type === 'video' || config.ad?.type === 'video';
  const mediaUrl = config.link_data || '';
  const websiteHostname = (() => {
    try {
      return new URL(config.ad?.website_url || 'https://togahh.com').hostname.toUpperCase();
    } catch {
      return 'TOGAHH.COM';
    }
  })();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-1.5 text-2xl font-extrabold tracking-tight text-zinc-900">
            Clinical Campaign Assembly
          </h2>
          <div className="text-sm tracking-wide text-zinc-500">
            Design precision treatment pathways and launch structured clinical recruitment draft pipelines.
          </div>
        </div>
        {selectedId && (
          <button
            onClick={() => onSelect(null)}
            className="flex items-center gap-2 rounded-[10px] border-[1.5px] border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-zinc-900 transition-all hover:border-red-600 hover:text-red-600"
          >
            ✕ Reset Selection
          </button>
        )}
      </div>

      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3 lg:gap-7">
          {/* Phone preview */}
          <div className="flex flex-col gap-6">
            <div className="relative mx-auto w-full max-w-[320px] overflow-hidden rounded-[48px] border-[14px] border-[#1c1c1e] bg-white shadow-[0_25px_60px_-12px_rgba(0,0,0,0.3),0_0_0_1px_#333]">
              <div className="absolute left-1/2 top-0 z-10 h-[30px] w-[120px] -translate-x-1/2 rounded-b-[18px] bg-[#1c1c1e]" />
              <div className="bg-white pt-[38px]">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-cyan-600 text-base font-extrabold text-white">
                    H
                  </div>
                  <div>
                    <div className="text-[13px] font-bold">
                      {config.ad_set?.dsa_beneficiary || 'Togahh'}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Sponsored • Clinical Excellence
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-3.5 text-[13px] leading-relaxed text-zinc-900">
                  {config.ad?.primary_text || 'World-class care starts today.'}
                </div>
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-black">
                  {mediaUrl ? (
                    isVideo ? (
                      <video src={mediaUrl} controls className="h-full w-full object-contain" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaUrl}
                        alt="Ad Preview"
                        className="h-full w-full object-contain"
                      />
                    )
                  ) : (
                    <div className="p-6 text-center text-[13px] text-zinc-500">
                      Clinical media pending...
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-5 pb-8 pt-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase text-zinc-500">
                      {websiteHostname}
                    </div>
                    <div className="truncate text-[15px] font-extrabold text-zinc-900">
                      {config.ad?.headline || 'Learn More Today'}
                    </div>
                  </div>
                  <button className="flex-shrink-0 rounded-lg border-[1.5px] border-zinc-300 bg-zinc-100 px-5 py-2 text-[13px] font-bold text-zinc-800">
                    {(config.ad?.call_to_action_type || 'LEARN_MORE').replace(/_/g, ' ')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Active campaigns list */}
          <Card style={{ padding: 24 }}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <SectionTitle>Health Operations</SectionTitle>
                <div className="text-[13px] text-zinc-400">Historical campaigns & protocols</div>
              </div>
              <button
                onClick={fetchCampaigns}
                disabled={loading}
                className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-[11px] font-extrabold text-zinc-900"
              >
                <span className={loading ? 'animate-spin' : ''}>↻</span> REFRESH
              </button>
            </div>
            <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-2">
              {loading ? (
                <div className="py-16 text-center">
                  <Spinner size={24} />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="rounded-xl bg-zinc-50 py-16 text-center text-sm text-zinc-400">
                  No active operations found.
                </div>
              ) : (
                campaigns.map((c) => {
                  const isSelected = selectedId === c.id;
                  const { color, bg } = getStatusBadgeColors(c.effective_status);
                  return (
                    <div
                      key={c.id}
                      onClick={() => onSelect(c)}
                      className={cn(
                        'flex cursor-pointer items-center justify-between rounded-xl p-4 transition-all duration-200',
                        isSelected
                          ? 'scale-[1.02] border-2 border-indigo-600 bg-indigo-50 shadow-md'
                          : 'border border-zinc-200 bg-white'
                      )}
                    >
                      <div className="flex flex-col gap-1.5 overflow-hidden">
                        <div
                          className={cn(
                            'truncate text-[15px] font-bold',
                            isSelected ? 'text-indigo-700' : 'text-zinc-900'
                          )}
                        >
                          {c.name}
                        </div>
                        <div className="font-mono text-xs text-zinc-400 opacity-80">
                          ID: {c.id}
                        </div>
                      </div>
                      <Badge text={c.effective_status} color={color} bg={bg} />
                    </div>
                  );
                })
              )}
            </div>
            {error && <div className="mt-3 text-xs text-red-600">{error}</div>}
            {/* Create new (preserve behavior) */}
            <form onSubmit={handleCreate} className="mt-4 flex gap-2">
              <input
                placeholder="New campaign name..."
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
                className={cn(inputClass, 'flex-1')}
              />
              <button
                type="submit"
                disabled={creating || !newCampaignName.trim()}
                className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? <Spinner size={14} color="#ffffff" /> : 'Create'}
              </button>
            </form>
          </Card>

          {/* Patient targeting summary */}
          <Card>
            <SectionTitle>Patient Targeting Parameters</SectionTitle>
            <div className="flex flex-col gap-3.5">
              <Row
                label="Geography"
                value={config.ad_set?.geo_targeting?.join(', ') || '—'}
              />
              <Row
                label="Age Group"
                value={`${config.ad_set?.age_min || 18}–${config.ad_set?.age_max || 65}`}
              />
              <Row
                label="Gender Demographic"
                value={GENDER_LABELS[config.ad_set?.gender ?? 0]}
              />
              <Row
                label="Clinical Budget"
                value={`$${(config.ad_set?.daily_budget || 0) / 100} USD/day`}
              />
              <Row label="DSA Payor Entities" value={config.ad_set?.dsa_payor || '—'} />
              <Row label="Deployment Mode">
                <Badge
                  text={selectedId ? 'Existing Pathway' : 'New Pathway'}
                  bg={selectedId ? '#FFFBEB' : '#EEF2FF'}
                  color={selectedId ? '#D97706' : '#4F46E5'}
                />
              </Row>
              {(config.ad_set?.targeting_keywords?.length ?? 0) > 0 && (
                <div className="mt-2">
                  <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Clinical Focus
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(config.ad_set?.targeting_keywords ?? []).map((kw) => (
                      <span
                        key={kw}
                        className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Facebook-Style Hierarchy Header */}
        {!showRawJson && (
          <div className="-mb-3 hidden gap-7 px-1 lg:grid lg:grid-cols-3">
            {[
              { num: 1, label: 'CAMPAIGN', sub: 'Pathway Strategy' },
              { num: 2, label: 'AD SET', sub: 'Targeting & Budget' },
              { num: 3, label: 'AD', sub: 'Creative Identity' },
            ].map((seg, i) => (
              <div
                key={seg.num}
                className="relative flex items-center gap-3 rounded-xl border-[1.5px] border-zinc-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-extrabold text-white">
                  {seg.num}
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-indigo-600">
                    {seg.label}
                  </div>
                  <div className="-mt-px text-[13px] font-semibold text-zinc-900">{seg.sub}</div>
                </div>
                {i < 2 && (
                  <div className="absolute -right-5 top-1/2 z-10 h-0.5 w-3 -translate-y-1/2 bg-zinc-200" />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3 lg:gap-7">
          {/* CAMPAIGN card */}
          <Card
            className="border-[1.5px] border-zinc-200 shadow-md"
            style={{ padding: 24 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <SectionTitle>CAMPAIGN | Pathway</SectionTitle>
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="rounded-[10px] border-[1.5px] border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-xs font-bold transition-all hover:bg-white"
              >
                {showRawJson ? 'Visual Mode' : 'Developer JSON'}
              </button>
            </div>
            {showRawJson ? (
              <div>
                <textarea
                  value={configJson}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  spellCheck={false}
                  className={cn(
                    'min-h-[240px] w-full resize-y rounded-md border-[1.5px] bg-slate-900 p-4 font-mono text-[13px] text-sky-400',
                    jsonError ? 'border-red-600' : 'border-zinc-200'
                  )}
                />
                {jsonError && (
                  <div className="mt-2 text-xs font-semibold text-red-600">
                    Invalid clinical schema: {jsonError}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {selectedId ? (
                  (() => {
                    const selCamp = campaigns.find((c) => c.id === selectedId);
                    return (
                      <div className="flex flex-col gap-2 rounded-xl border border-indigo-600 bg-indigo-50 p-5">
                        <div className="text-[13px] font-bold text-indigo-700">
                          Appending to Existing Campaign
                        </div>
                        <div className="text-base font-extrabold text-zinc-900">
                          {selCamp?.name || 'Selected Campaign'}
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="font-mono text-xs text-zinc-500">ID: {selectedId}</div>
                          {selCamp?.objective && (
                            <div className="rounded bg-black/5 px-2 py-0.5 text-[11px] font-semibold">
                              {selCamp.objective}
                            </div>
                          )}
                          {selCamp?.status && (
                            <div
                              className={cn(
                                'rounded px-2 py-0.5 text-[11px] font-extrabold',
                                selCamp.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-amber-50 text-amber-600'
                              )}
                            >
                              {selCamp.status}
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-zinc-400">
                          Campaign-level settings cannot be edited when appending a new Ad Set.
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <>
                    <FieldGroup label="Campaign Name">
                      <input
                        value={config.campaign?.name || ''}
                        onChange={(e) => setField('campaign', 'name', e.target.value)}
                        className={inputClass}
                      />
                    </FieldGroup>
                    <FieldGroup label="Buying Type">
                      <select
                        value={config.campaign?.buying_type || 'AUCTION'}
                        onChange={(e) => setField('campaign', 'buying_type', e.target.value)}
                        className={inputClass}
                      >
                        {BUYING_TYPES.map((bt) => (
                          <option key={bt} value={bt}>
                            {bt}
                          </option>
                        ))}
                      </select>
                    </FieldGroup>
                    <FieldGroup label="Campaign Objective">
                      <select
                        value={config.campaign?.objective || 'OUTCOME_SALES'}
                        onChange={(e) => setField('campaign', 'objective', e.target.value)}
                        className={inputClass}
                      >
                        {CAMPAIGN_OBJECTIVES.map((obj) => (
                          <option key={obj.value} value={obj.value}>
                            {obj.icon} {obj.label}
                          </option>
                        ))}
                      </select>
                    </FieldGroup>
                    <div className="mt-1 flex items-center justify-between rounded-2xl border-[1.5px] border-zinc-100 bg-slate-50 px-4 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-extrabold tracking-wide text-zinc-900">
                          Advantage+ Campaign Budget
                        </span>
                        <span className="text-[11px] font-medium text-zinc-500">
                          AI-optimized budget distribution
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        id="cbo-toggle"
                        checked={config.campaign?.is_adset_budget_sharing_enabled || false}
                        onChange={(e) =>
                          setField('campaign', 'is_adset_budget_sharing_enabled', e.target.checked)
                        }
                        className="h-5 w-5 cursor-pointer accent-indigo-600"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>

          {/* AD SET card */}
          <Card
            className={cn(
              'border-[1.5px] border-zinc-200 shadow-md',
              showRawJson && 'pointer-events-none opacity-30'
            )}
            style={{ padding: 24 }}
          >
            <SectionTitle>AD SET | Routing & Target</SectionTitle>
            <div className="mt-1 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldGroup label="Ad Set Name" span={2}>
                <input
                  value={config.ad_set?.name || ''}
                  onChange={(e) => setField('ad_set', 'name', e.target.value)}
                  className={inputClass}
                />
              </FieldGroup>
              <FieldGroup label="Target Locations" span={2}>
                <LocationSearch
                  geoLocations={config.ad_set?.geo_locations}
                  onChange={(newGeo) => setField('ad_set', 'geo_locations', newGeo)}
                />
              </FieldGroup>
              <FieldGroup label="Optimization Goal" span={2}>
                <select
                  value={config.ad_set?.optimization_goal || 'OFFSITE_CONVERSIONS'}
                  onChange={(e) => setField('ad_set', 'optimization_goal', e.target.value)}
                  className={inputClass}
                >
                  {OPTIMIZATION_GOALS.map((goal) => (
                    <option key={goal.value} value={goal.value}>
                      {goal.label}
                    </option>
                  ))}
                </select>
              </FieldGroup>

              <div className="col-span-1 mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-[13px] font-extrabold uppercase tracking-wider text-indigo-700">
                    BUDGET &amp; SCHEDULE
                  </div>
                  <Badge text="Live Sync" color="#2563EB" bg="#EFF6FF" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FieldGroup label="Budget Type">
                    <select
                      value={config.ad_set?.budget_type || 'DAILY'}
                      onChange={(e) => setField('ad_set', 'budget_type', e.target.value)}
                      className={inputClass}
                    >
                      {BUDGET_TYPES.map((bt) => (
                        <option key={bt.value} value={bt.value}>
                          {bt.label}
                        </option>
                      ))}
                    </select>
                  </FieldGroup>
                  <FieldGroup
                    label={`Amount (${config.ad_set?.budget_type === 'DAILY' ? 'Daily' : 'Lifetime'})`}
                  >
                    <input
                      type="number"
                      value={
                        config.ad_set?.budget_type === 'DAILY'
                          ? config.ad_set?.daily_budget || 5000
                          : config.ad_set?.lifetime_budget || 50000
                      }
                      onChange={(e) =>
                        setField(
                          'ad_set',
                          config.ad_set?.budget_type === 'DAILY'
                            ? 'daily_budget'
                            : 'lifetime_budget',
                          Number(e.target.value)
                        )
                      }
                      className={inputClass}
                    />
                  </FieldGroup>
                  <FieldGroup label="Start Date">
                    <input
                      type="datetime-local"
                      value={config.ad_set?.start_time || ''}
                      onChange={(e) => setField('ad_set', 'start_time', e.target.value)}
                      className={inputClass}
                    />
                  </FieldGroup>
                  <FieldGroup label="End Date">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="end-date-toggle"
                          checked={config.ad_set?.has_end_date || false}
                          onChange={(e) =>
                            setField('ad_set', 'has_end_date', e.target.checked)
                          }
                          className="h-[18px] w-[18px] cursor-pointer accent-indigo-600"
                        />
                        <label
                          htmlFor="end-date-toggle"
                          className="cursor-pointer text-[13px] font-bold text-zinc-900"
                        >
                          Set an end date
                        </label>
                      </div>
                      {config.ad_set?.has_end_date && (
                        <input
                          type="datetime-local"
                          value={config.ad_set?.stop_time || ''}
                          onChange={(e) => setField('ad_set', 'stop_time', e.target.value)}
                          className={inputClass}
                        />
                      )}
                    </div>
                  </FieldGroup>
                </div>
              </div>

              <FieldGroup label="Demographics" span={2}>
                <select
                  value={config.ad_set?.gender ?? 0}
                  onChange={(e) => setField('ad_set', 'gender', Number(e.target.value))}
                  className={inputClass}
                >
                  <option value={0}>All Patients</option>
                  <option value={1}>Male Focus</option>
                  <option value={2}>Female Focus</option>
                </select>
              </FieldGroup>
            </div>
          </Card>

          {/* AD card */}
          <Card
            className={cn(
              'border-[1.5px] border-zinc-200 shadow-md',
              showRawJson && 'pointer-events-none opacity-30'
            )}
            style={{ padding: 24 }}
          >
            <SectionTitle>AD | Creative Identity</SectionTitle>
            <div className="mt-1 flex flex-col gap-4">
              <FieldGroup label="Ad Name">
                <input
                  value={config.ad?.name || ''}
                  onChange={(e) => setField('ad', 'name', e.target.value)}
                  className={inputClass}
                />
              </FieldGroup>
              <div className="col-span-1 mt-1 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 sm:p-5">
                <div className="mb-4 text-[13px] font-extrabold uppercase tracking-wider text-indigo-700">
                  ACCOUNT IDENTITIES
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FieldGroup label="Facebook Page">
                    <input
                      value={config.ad?.facebook_page || ''}
                      onChange={(e) => setField('ad', 'facebook_page', e.target.value)}
                      className={inputClass}
                    />
                  </FieldGroup>
                  <FieldGroup label="Instagram Profile">
                    <input
                      value={config.ad?.instagram_account || ''}
                      onChange={(e) => setField('ad', 'instagram_account', e.target.value)}
                      className={inputClass}
                    />
                  </FieldGroup>
                </div>
              </div>

              <FieldGroup label="Primary Ad Text">
                <textarea
                  value={config.ad?.primary_text || ''}
                  onChange={(e) => setField('ad', 'primary_text', e.target.value)}
                  className={cn(inputClass, 'min-h-[80px] resize-y')}
                />
              </FieldGroup>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldGroup label="Headline">
                  <input
                    value={config.ad?.headline || ''}
                    onChange={(e) => setField('ad', 'headline', e.target.value)}
                    className={inputClass}
                  />
                </FieldGroup>
                <FieldGroup label="CTA Button">
                  <select
                    value={config.ad?.call_to_action_type || 'LEARN_MORE'}
                    onChange={(e) => handleCTAChange(e.target.value)}
                    className={inputClass}
                  >
                    <option value="LEARN_MORE">LEARN_MORE</option>
                    <option value="BOOK_NOW">BOOK_NOW</option>
                    <option value="CONTACT_US">CONTACT_US</option>
                    <option value="GET_QUOTE">GET_ESTIMATE</option>
                    <option value="WHATSAPP_MESSAGE">WHATSAPP_MESSAGE</option>
                    <option value="MESSAGE_PAGE">MESSAGE_PAGE</option>
                  </select>
                </FieldGroup>
              </div>
              <FieldGroup label="Ad Description (Small Text)">
                <input
                  value={config.ad?.description || ''}
                  onChange={(e) => setField('ad', 'description', e.target.value)}
                  className={inputClass}
                />
              </FieldGroup>

              <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-600/5 p-4">
                <FieldGroup label="Media Link / Destination Data (ACTUAL LINK)">
                  <input
                    placeholder="e.g. https://website.com or +123456789"
                    value={config.ad?.website_url || ''}
                    onChange={(e) => setField('ad', 'website_url', e.target.value)}
                    className={cn(inputClass, 'border-indigo-600 bg-white')}
                  />
                </FieldGroup>
                <FieldGroup label="Display Link Mask (Visual Only)">
                  <input
                    placeholder="e.g. yourclinic.ai/booking"
                    value={config.ad?.display_link || ''}
                    onChange={(e) => setField('ad', 'display_link', e.target.value)}
                    className={inputClass}
                  />
                </FieldGroup>
              </div>
            </div>
          </Card>
        </div>

        {/* Launch panel */}
        <div className="flex flex-col">
          <Card
            className={cn(
              'rounded-xl bg-white',
              launchSuccess
                ? 'border-[3px] border-emerald-600 shadow-[0_20px_40px_-10px_rgba(16,185,129,0.2)]'
                : selectedId
                  ? 'border-[3px] border-amber-600 shadow-[0_20px_40px_-10px_rgba(245,158,11,0.2)]'
                  : 'border-[3px] border-indigo-600 shadow-[0_20px_40px_-10px_rgba(79,70,229,0.2)]'
            )}
            style={{ padding: 40 }}
          >
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:gap-8">
              <div
                className={cn(
                  'flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-[20px] text-[40px] shadow-inner',
                  launchSuccess
                    ? 'bg-emerald-50'
                    : selectedId
                      ? 'bg-amber-50'
                      : 'bg-indigo-50'
                )}
              >
                {launchSuccess ? '⚕️' : selectedId ? '💉' : '💠'}
              </div>
              <div className="flex-1">
                <div className="mb-2.5 text-2xl font-black tracking-tight text-zinc-900">
                  {launchSuccess
                    ? 'Clinical Deployment Verified'
                    : selectedId
                      ? `Append Protocol to: ${selectedCampaign?.name}`
                      : 'Launch New Clinical Operations'}
                </div>
                <div className="mb-8 text-base leading-relaxed text-zinc-500">
                  {launchSuccess
                    ? 'The treatment pathway has been synchronized with the advertising network. Draft logs available in Meta Ads Manager.'
                    : selectedId
                      ? `Targeting protocols and clinical creatives will be injected into the existing ${selectedCampaign?.name} hierarchy.`
                      : 'Initialize a top-level hospital campaign and set up the automated patient recruitment funnel.'}
                </div>

                {launching ? (
                  <div className="rounded-xl border-[1.5px] border-indigo-200 bg-zinc-50 p-8">
                    <div className="mb-5 flex items-center gap-4">
                      <Spinner size={18} />
                      <span className="text-[15px] font-extrabold tracking-wide text-indigo-700">
                        {launchStep === 1
                          ? 'Syncing Patient Data & Media Assets...'
                          : launchStep === 2
                            ? 'Compiling Medical Schema...'
                            : launchStep === 3
                              ? 'Building Treatment Path AdSets...'
                              : 'Finalizing Patient Outreach Logic...'}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-[10px] bg-zinc-100">
                      <div
                        className="h-full bg-indigo-600 transition-[width] duration-300 ease-out"
                        style={{ width: `${(launchStep / 4) * 100}%` }}
                      />
                    </div>
                  </div>
                ) : launchSuccess ? (
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <PrimaryButton
                      onClick={() =>
                        window.open(
                          `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${process.env.NEXT_PUBLIC_META_AD_ACCOUNT_ID}`,
                          '_blank'
                        )
                      }
                      style={{ background: '#0891B2', padding: '18px 36px', fontSize: 16 }}
                    >
                      Review Protocol ↗
                    </PrimaryButton>
                    <button
                      onClick={() => setLaunchSuccess(false)}
                      className="rounded-md border-2 border-zinc-200 bg-white px-9 py-4 text-base font-bold transition-all hover:border-zinc-300"
                    >
                      Queue Another Segment
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <PrimaryButton
                      onClick={handleFullLaunch}
                      disabled={launching}
                      style={{
                        background: selectedId ? '#D97706' : '#4F46E5',
                        padding: '18px 48px',
                        fontSize: 16,
                        fontWeight: 800,
                        letterSpacing: '0.03em',
                      }}
                    >
                      {selectedId
                        ? 'Execute Protocol Injection →'
                        : 'Authorize Clinical Deployment →'}
                    </PrimaryButton>
                  </div>
                )}

                {launchError && (
                  <div className="mt-6 rounded-xl border-2 border-red-200 bg-red-50 px-6 py-4 text-[15px] font-medium text-red-700">
                    <span className="mr-2.5 font-extrabold uppercase">
                      Deployment Error:
                    </span>{' '}
                    {launchError}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
}
function Row({ label, value, children }: RowProps) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
      <span className="text-[13px] font-medium text-zinc-400">{label}</span>
      {children || (
        <span className="text-[13px] font-bold text-zinc-900">{value}</span>
      )}
    </div>
  );
}

interface FieldGroupProps {
  label: ReactNode;
  children: ReactNode;
  span?: 1 | 2;
}
function FieldGroup({ label, children, span }: FieldGroupProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        span === 2 && 'col-span-1 sm:col-span-2'
      )}
    >
      <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── LOCATION SEARCH ───────────────────────────────────────────────────────────
interface LocationSearchResult {
  key: string;
  name: string;
  type: 'country' | 'city' | 'region' | 'zip';
  country_code?: string;
  country_name?: string;
}

interface LocationSearchProps {
  geoLocations?: GeoLocations;
  onChange: (next: GeoLocations) => void;
}

interface SelectedPill {
  type: 'country' | 'city' | 'region' | 'zip';
  key: string;
  name: string;
}

function LocationSearch({ geoLocations, onChange }: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const selectedPills: SelectedPill[] = [];
  if (geoLocations) {
    if (geoLocations.countries)
      geoLocations.countries.forEach((c) =>
        selectedPills.push({ type: 'country', key: c, name: c })
      );
    if (geoLocations.cities)
      geoLocations.cities.forEach((c) =>
        selectedPills.push({ type: 'city', key: c.key, name: c.name || c.key })
      );
    if (geoLocations.regions)
      geoLocations.regions.forEach((c) =>
        selectedPills.push({ type: 'region', key: c.key, name: c.name || c.key })
      );
    if (geoLocations.zips)
      geoLocations.zips.forEach((c) =>
        selectedPills.push({ type: 'zip', key: c.key, name: c.name || c.key })
      );
  }

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/meta/locations?q=${encodeURIComponent(query)}`);
        const data = (await res.json()) as LocationSearchResult[];
        setResults(data || []);
        setShowDropdown(true);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: LocationSearchResult) => {
    const newGeo: GeoLocations = {
      ...geoLocations,
      location_types: geoLocations?.location_types || ['home', 'recent'],
    };

    if (item.type === 'country' && item.country_code) {
      newGeo.countries = [...(newGeo.countries || []), item.country_code];
      if (newGeo.cities)
        newGeo.cities = newGeo.cities.filter((c) => c.country_code !== item.country_code);
      if (newGeo.regions)
        newGeo.regions = newGeo.regions.filter((c) => c.country_code !== item.country_code);
      if (newGeo.zips)
        newGeo.zips = newGeo.zips.filter((c) => c.country_code !== item.country_code);
    } else {
      const locObj: GeoEntry = {
        key: item.key,
        name: item.name,
        country_code: item.country_code,
      };
      if (item.type === 'city') newGeo.cities = [...(newGeo.cities || []), locObj];
      if (item.type === 'region') newGeo.regions = [...(newGeo.regions || []), locObj];
      if (item.type === 'zip') newGeo.zips = [...(newGeo.zips || []), locObj];

      if (
        item.country_code &&
        newGeo.countries &&
        newGeo.countries.includes(item.country_code)
      ) {
        newGeo.countries = newGeo.countries.filter((c) => c !== item.country_code);
      }
    }

    if (newGeo.countries && newGeo.countries.length === 0) delete newGeo.countries;
    if (newGeo.cities && newGeo.cities.length === 0) delete newGeo.cities;
    if (newGeo.regions && newGeo.regions.length === 0) delete newGeo.regions;
    if (newGeo.zips && newGeo.zips.length === 0) delete newGeo.zips;

    onChange(newGeo);
    setQuery('');
    setShowDropdown(false);
  };

  const handleRemove = (pill: SelectedPill) => {
    const newGeo: GeoLocations = { ...geoLocations };
    if (pill.type === 'country' && newGeo.countries) {
      newGeo.countries = newGeo.countries.filter((c) => c !== pill.key);
      if (newGeo.countries.length === 0) delete newGeo.countries;
    }
    if (pill.type === 'city' && newGeo.cities) {
      newGeo.cities = newGeo.cities.filter((c) => c.key !== pill.key);
      if (newGeo.cities.length === 0) delete newGeo.cities;
    }
    if (pill.type === 'region' && newGeo.regions) {
      newGeo.regions = newGeo.regions.filter((c) => c.key !== pill.key);
      if (newGeo.regions.length === 0) delete newGeo.regions;
    }
    if (pill.type === 'zip' && newGeo.zips) {
      newGeo.zips = newGeo.zips.filter((c) => c.key !== pill.key);
      if (newGeo.zips.length === 0) delete newGeo.zips;
    }
    onChange(newGeo);
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true);
          }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="Search for countries, cities, or regions..."
          className={cn(inputClass, 'pr-10')}
        />
        {loading && (
          <div className="absolute right-3">
            <Spinner size={16} />
          </div>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[200px] overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg">
          {results.map((r) => (
            <div
              key={r.key}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(r);
              }}
              className="flex cursor-pointer flex-col border-b border-zinc-100 px-3.5 py-2.5 text-[13px] transition-colors hover:bg-zinc-50"
            >
              <div className="font-semibold text-zinc-900">{r.name}</div>
              <div className="text-[11px] text-zinc-500">
                {r.type?.toUpperCase()} • {r.country_name || r.country_code || 'Unknown'}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedPills.map((p) => (
            <div
              key={`${p.type}-${p.key}`}
              className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
            >
              {p.type === 'country' ? '🌐' : p.type === 'city' ? '🏙️' : '🗺️'} {p.name}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleRemove(p);
                }}
                className="border-none bg-transparent p-0 text-sm text-indigo-600"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
