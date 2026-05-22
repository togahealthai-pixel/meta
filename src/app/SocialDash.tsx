'use client';

import { useState, useEffect, useRef, type CSSProperties } from 'react';
import {
  Image as ImageIcon,
  Share2,
  Zap,
  Settings,
  Loader2,
  CheckCircle2,
  Activity,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';

import { Badge, Spinner } from './components';
import { socialSupabase } from '../lib/socialSupabase';
import GeneratorModal from './GeneratorModal';
import RetryModal from './RetryModal';

const medicalBlue = '#0284c7';
const medicalTeal = '#0d9488';

type LoadingKind = null | 'images' | 'manual' | 'dynamic' | 'accept' | 'post';
type ToastState = { message: string; type: 'info' | 'success' } | null;

interface GeneratorFormData {
  category: string;
  description: string;
  videoStyle: string;
  language: string;
  voice: string;
  backgroundSong: string;
}

export default function SocialDash() {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState<LoadingKind>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState('Loading...');
  const [showModal, setShowModal] = useState(false);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [generatedStory, setGeneratedStory] = useState<string | null>(null);
  const [lastInputs, setLastInputs] = useState<GeneratorFormData | null>(null);
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const sampleUrl =
      'https://cdssxtquayzijmbnlqmt.supabase.co/storage/v1/object/public/n8n/finalbefore2.mp3';
    setVideoUrl(`${sampleUrl}?t=${Date.now()}`);

    const fetchStatus = async () => {
      try {
        const { data, error } = await socialSupabase
          .from('n8n')
          .select('status')
          .order('id', { ascending: false })
          .limit(1);

        if (error) {
          setStatus('Status Error');
        } else if (data && data.length > 0) {
          setStatus(data[0].status);
        } else {
          setStatus('Waiting for Data...');
        }
      } catch {
        setStatus('Connection Error');
      }
    };

    fetchStatus();

    const channel = socialSupabase
      .channel('n8n-status-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'n8n' },
        (payload) => {
          const next = payload.new as { status?: string } | null;
          if (next?.status) setStatus(next.status);
        }
      )
      .subscribe();

    return () => {
      socialSupabase.removeChannel(channel);
    };
  }, []);

  // Timer logic for progress bar (max 6 minutes = 360s)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isGenerating) {
      const MAX_TIME = 360; // seconds
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 98) {
            if (interval) clearInterval(interval);
            return 98; // Stay at 98% until status changes to success
          }
          return prev + 100 / MAX_TIME;
        });
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

  // Monitor status to trigger refresh and progress completion
  useEffect(() => {
    const isDone =
      status?.toLowerCase().includes('successfully') ||
      status?.toLowerCase().includes('completed');

    if (isDone) {
      setProgress(100);
      setIsGenerating(false);
      handleRefreshPreview();
      if (progress > 0 && progress < 100) {
        showToast('Process completed successfully!', 'success');
      }
    } else if (
      status &&
      status !== 'Waiting for Data...' &&
      status !== 'Status Error' &&
      status !== 'Connection Error' &&
      status !== 'Loading...' &&
      status !== 'Generating images...' &&
      status !== 'Images will be generated soon!'
    ) {
      if (!isGenerating) {
        setIsGenerating(true);
        setProgress(0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleRefreshPreview = () => {
    const sampleUrl =
      'https://cdssxtquayzijmbnlqmt.supabase.co/storage/v1/object/public/n8n/finalbefore2.mp3';
    setVideoUrl(`${sampleUrl}?t=${Date.now()}`);
  };

  const showToast = (message: string, type: 'info' | 'success' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const triggerWebhook = async (
    url: string,
    label: LoadingKind,
    successMessage: string,
    body: unknown = null,
    method: string = 'POST'
  ): Promise<unknown> => {
    setLoading(label);
    try {
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, body, method }),
      });
      if (response.ok) {
        showToast(successMessage, 'success');
        const data = await response.json().catch(() => ({ status: 'ok' }));
        return data;
      } else {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string };
        showToast(`Trigger failed: ${errorData.error || response.statusText}`, 'info');
        return null;
      }
    } catch (err) {
      console.error('Webhook Error:', err);
      showToast('Trigger failed. Check console for details.', 'info');
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateImages = () => {
    setStatus('Generating images...');
    triggerWebhook(
      'https://n8n.srv1208919.hstgr.cloud/webhook/1703fb64-ec58-4e56-9ce7-bd9e16e15220',
      'images',
      'Images will be generated soon!',
      null,
      'GET'
    );
  };

  const handleDynamicTrigger = () => {
    setShowModal(true);
  };

  const handleModalSubmit = async (data: GeneratorFormData) => {
    setShowModal(false);
    setLastInputs(data);
    const result = await triggerWebhook(
      'https://n8n.srv1208919.hstgr.cloud/webhook/7be28969-c4ad-404a-b982-841dda7133af',
      'dynamic',
      'Spotlight Triggered!',
      data
    );

    console.log('Webhook Result:', result);

    const r = result as { output?: { story?: string }; story?: string } | { output?: { story?: string }; story?: string }[];
    const story = Array.isArray(r)
      ? r[0]?.output?.story || r[0]?.story
      : r?.output?.story || r?.story;

    if (story) {
      setGeneratedStory(story);
    }
  };

  const handleAcceptStory = async () => {
    setGeneratedStory(null);
    setIsGenerating(true);
    setProgress(0);
    setStatus('Initiating workflow...');
    await triggerWebhook(
      'https://n8n.srv1208919.hstgr.cloud/webhook/81f0d39d-6344-421a-b3a2-019b2c737483',
      'accept',
      'Story accepted and saved!',
      { ...lastInputs, generated_story: generatedStory, status: 'accepted' }
    );
  };

  const handleRetrySubmit = async (retryPrompt: string) => {
    setShowRetryModal(false);
    const data = {
      ...lastInputs,
      retry_prompt: retryPrompt,
      status: 'retry',
      generated_story: generatedStory,
    };

    const result = await triggerWebhook(
      'https://n8n.srv1208919.hstgr.cloud/webhook/ddcfb213-9313-46e3-8270-dd603301c1bd',
      'dynamic',
      'Retry Triggered!',
      data
    );

    const r = result as { output?: { story?: string }; story?: string } | { output?: { story?: string }; story?: string }[];
    const story = Array.isArray(r)
      ? r[0]?.output?.story || r[0]?.story
      : r?.output?.story || r?.story;

    if (story) {
      setGeneratedStory(story);
    }
  };

  const handlePostVideo = () =>
    triggerWebhook(
      'https://n8n.srv1208919.hstgr.cloud/webhook/8f91f8e3-d06f-4e73-a545-e18065750416',
      'post',
      'Video posted to social media!'
    );

  const postBtnStyle: CSSProperties = {
    background: `linear-gradient(135deg, ${medicalBlue}, ${medicalTeal})`,
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 pb-10 pt-2 text-slate-600 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className="fixed right-5 top-5 z-[100] animate-fade-in">
          <div
            className="flex min-w-[240px] max-w-[360px] items-center gap-2.5 rounded-xl border border-slate-100 bg-white px-[18px] py-3 text-sm font-semibold text-slate-800 shadow-lg"
            style={{
              borderLeftWidth: 3,
              borderLeftColor: toast.type === 'success' ? '#22c55e' : medicalBlue,
            }}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={16} className="text-green-500" />
            ) : (
              <Activity size={16} style={{ color: medicalBlue }} />
            )}
            {toast.message}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-slate-100 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold leading-tight tracking-tight text-slate-900">
            Creator Studio
          </h1>
          <p className="mt-1 text-[13px] text-slate-400">
            Manage your social media content generation pipeline
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          <Badge text="v2.0 Connected" color={medicalBlue} bg="#EEF2FF" />
          <Badge
            text={status}
            color={status === 'video created successfully' ? '#059669' : '#D97706'}
            bg={status === 'video created successfully' ? '#ECFDF5' : '#FFFBEB'}
          />
        </div>
      </header>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[7fr_5fr] lg:items-stretch">
        {/* Left: Action cards */}
        <div className="flex flex-col gap-4">
          {/* Social Image Creator */}
          <div className="rounded-[14px] border border-slate-100 bg-white px-5 py-5 shadow-sm transition-all hover:border-sky-200 hover:shadow-md">
            <div className="mb-3.5 flex items-center gap-3.5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-sky-50 text-sky-600">
                <ImageIcon size={20} />
              </div>
              <h2 className="m-0 text-[15px] font-bold text-slate-800">Social Image Creator</h2>
            </div>
            <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3.5 transition-all hover:bg-white hover:shadow-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Auto-Scale
                </span>
                <Badge text="Instagram · FB · LI" color={medicalBlue} bg="#EEF2FF" />
              </div>
              <p className="mb-3 mt-0 text-xs leading-relaxed text-slate-400">
                Create professional visuals automatically scaled for all major social channels.
              </p>
              <button
                onClick={handleGenerateImages}
                disabled={loading === 'images'}
                style={{ background: medicalBlue }}
                className="flex w-full items-center justify-center gap-2 rounded-[9px] px-4 py-2.5 text-[13px] font-bold tracking-wide text-white transition-all hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {loading === 'images' ? (
                  <>
                    <Spinner size={14} color="#ffffff" /> Processing...
                  </>
                ) : (
                  <>
                    <Zap size={14} /> Generate Social Images
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Custom Spotlight */}
          <div className="rounded-[14px] border border-slate-100 bg-white px-5 py-5 shadow-sm transition-all hover:border-amber-200 hover:shadow-md">
            <div className="mb-3.5 flex items-center gap-3.5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-amber-50 text-amber-600">
                <Settings size={20} />
              </div>
              <h2 className="m-0 text-[15px] font-bold text-slate-800">Custom Spotlight</h2>
            </div>
            <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3.5 transition-all hover:bg-white hover:shadow-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Manual Control
                </span>
                <Badge text="Custom" color="#D97706" bg="#FFFBEB" />
              </div>
              <p className="mb-3 mt-0 text-xs leading-relaxed text-slate-400">
                Input custom scripts, tones, and visual scenes for total creative control.
              </p>
              <button
                onClick={handleDynamicTrigger}
                disabled={loading === 'dynamic'}
                className="flex w-full items-center justify-center gap-2 rounded-[9px] border-[1.5px] border-slate-800 bg-slate-800 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:border-slate-900 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading === 'dynamic' ? (
                  <>
                    <Spinner size={14} /> Processing...
                  </>
                ) : (
                  <>
                    <Settings size={14} /> Dynamic Inputs
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generation Progress Timeline */}
          {isGenerating && (
            <div className="animate-fade-in rounded-[14px] border border-slate-100 bg-white px-5 py-5 shadow-sm transition-all hover:shadow-md">
              <div className="mb-3.5 flex items-center gap-3.5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-teal-50 text-teal-600">
                  <Zap size={20} />
                </div>
                <h2 className="m-0 text-[15px] font-bold text-slate-800">
                  Generation in Progress
                </h2>
              </div>
              <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Progress
                  </span>
                  <span className="text-[11px] font-extrabold text-sky-600">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="relative h-1.5 overflow-hidden rounded-sm bg-slate-100">
                  <div
                    className="h-full rounded-sm bg-gradient-to-r from-sky-600 to-teal-600 transition-[width] duration-1000 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  System is currently processing your request. The preview will update
                  automatically.
                </p>
              </div>
            </div>
          )}

          {/* Generated Story Output */}
          {generatedStory && (
            <div className="animate-fade-in rounded-[14px] border border-slate-100 bg-white px-5 py-5 shadow-sm transition-all hover:shadow-md">
              <div className="mb-3.5 flex items-center gap-3.5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-green-50 text-green-600">
                  <MessageSquare size={20} />
                </div>
                <h2 className="m-0 text-[15px] font-bold text-slate-800">Generated Story</h2>
              </div>
              <div className="rounded-[10px] border border-emerald-100 bg-white px-4 py-3.5 transition-all">
                {loading === 'dynamic' ? (
                  <div className="flex items-center gap-2.5 text-slate-500">
                    <Spinner size={16} /> Generating new story...
                  </div>
                ) : (
                  <textarea
                    value={generatedStory}
                    onChange={(e) => setGeneratedStory(e.target.value)}
                    placeholder="Type or edit your story here..."
                    className="w-full min-h-[180px] resize-y rounded-[10px] border-[1.5px] border-emerald-100 bg-white p-3 text-sm leading-relaxed text-slate-700 transition-all focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
                  />
                )}
                <div className="mt-3 flex justify-end gap-2.5">
                  <button
                    onClick={() => setShowRetryModal(true)}
                    className="flex items-center gap-2 rounded-[9px] border-[1.5px] border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 transition-all hover:bg-slate-100"
                  >
                    <RefreshCw size={14} /> Retry
                  </button>
                  <button
                    onClick={handleAcceptStory}
                    disabled={loading === 'accept'}
                    className="flex items-center gap-2 rounded-[9px] bg-green-600 px-5 py-2 text-xs font-bold text-white transition-all hover:-translate-y-px hover:bg-green-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {loading === 'accept' ? (
                      <>
                        <Spinner size={14} color="#ffffff" /> Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} /> Accept Story
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview panel */}
        <div className="flex flex-col">
          <div className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-[14px] border border-slate-100 bg-white shadow-sm lg:min-h-0">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3.5">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-red-500" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-600">
                  System Preview Output
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefreshPreview}
                  title="Refresh Preview"
                  className="flex h-7 w-7 items-center justify-center rounded-md border-[1.5px] border-slate-200 bg-transparent text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800"
                >
                  <RefreshCw size={14} />
                </button>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Live Feed
                </span>
              </div>
            </div>

            {/* Video area */}
            <div className="relative max-h-[480px] min-h-[300px] flex-1 bg-slate-900">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="block h-full w-full object-contain"
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Loader2 size={36} className="animate-spin text-slate-700" />
                  <p className="text-[13px] font-medium text-slate-600">
                    Loading preview stream...
                  </p>
                </div>
              )}
            </div>

            {/* Approval bar */}
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="m-0 text-[15px] font-bold text-slate-800">
                  Final Creative Approval
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Ready to push this content to your active social channels?
                </p>
              </div>
              <button
                onClick={handlePostVideo}
                disabled={loading === 'post'}
                style={postBtnStyle}
                className="flex flex-shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] px-6 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-px hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {loading === 'post' ? (
                  <Spinner color="#ffffff" size={16} />
                ) : (
                  <>
                    <Share2 size={16} /> Post Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <GeneratorModal
        isOpen={showModal}
        onOpenChange={setShowModal}
        onSubmit={handleModalSubmit}
        loading={loading === 'dynamic'}
      />

      <RetryModal
        isOpen={showRetryModal}
        onOpenChange={setShowRetryModal}
        onSubmit={handleRetrySubmit}
        loading={loading === 'dynamic'}
      />
    </div>
  );
}
