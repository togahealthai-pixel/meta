"use client";

import React, { useState, useEffect, useRef } from 'react';
import CustomSelect from './CustomSelect';
import { createPortal } from 'react-dom';
import {
  Clapperboard,
  Image as ImageIcon,
  Share2,
  Play,
  Zap,
  Settings,
  Loader2,
  CheckCircle2,
  Activity,
  MessageSquare,
  RefreshCw,
  Tag,
  Monitor,
  User,
  Mic2,
  Music,
  Clock,
  Sparkles
} from 'lucide-react';

import { Badge, Spinner } from './components';
import { socialSupabase } from '../lib/socialSupabase';
import { supabase } from '../lib/supabase';
import GeneratorModal from './GeneratorModal';
import RetryModal from './RetryModal';
import ImagePromptModal from './ImagePromptModal';
import VoiceExplorerModal from './VoiceExplorerModal';

const VOICE_OPTIONS = {
  male: [
    { id: "KLoLpdGWK7agg0O2TJYg", label: "Charlie - Men" },
    { id: "eqz5FuihuZwmJPuvZ65E", label: "Jess - Men" }
  ],
  female: [
    { id: "wrxvN1LZJIfL3HHvffqe", label: "Bella - Lady" },
    { id: "odyUrTN5HMVKujvVAgWW", label: "Emily - Lady" },
    { id: "aD6riP1btT197c6dACmy", label: "Rachel - Lady" },
    { id: "KClAuq9Hs0wFY7oJmaGN", label: "Maayan - Lady" }
  ]
};

const medicalBlue = "#0284c7";
const medicalTeal = "#0d9488";

function parseDescriptions(rawDescriptions: any) {
  try {
    const desc = typeof rawDescriptions === 'string'
      ? JSON.parse(rawDescriptions)
      : rawDescriptions;

    let instagram = "", facebook = "", tiktok = "", linkedin = "", twitter = "", supabaseTitle = "";

    const hasNested = desc.instagram || desc.facebook || desc.tiktok || desc.linkedin || desc.twitter ||
                      desc.Instagram || desc.Facebook || desc.Tiktok || desc.Linkedin || desc.Twitter;

    if (hasNested) {
      const instaObj = desc.instagram || desc.Instagram || {};
      const fbObj = desc.facebook || desc.Facebook || {};
      const ttObj = desc.tiktok || desc.Tiktok || {};
      const liObj = desc.linkedin || desc.Linkedin || {};
      const twObj = desc.twitter || desc.Twitter || {};
      instagram = instaObj.content || instaObj.caption || instaObj.title || "";
      facebook = fbObj.content || fbObj.caption || fbObj.title || "";
      tiktok = ttObj.caption || ttObj.content || ttObj.title || "";
      linkedin = liObj.content || liObj.caption || liObj.title || "";
      twitter = twObj.content || twObj.caption || twObj.title || "";
      supabaseTitle = fbObj.title || instaObj.title || desc.video_title || "";
    } else {
      const caption = desc.caption || '';
      const post = desc.post || '';
      const tags = desc.tags || '';
      const title = desc.video_title || '';
      supabaseTitle = title || caption;
      instagram = [caption, tags].filter(Boolean).join('\n\n');
      facebook = [post, tags].filter(Boolean).join('\n\n');
      tiktok = caption;
      linkedin = [post, tags].filter(Boolean).join('\n\n');
      twitter = caption;
    }

    return { supabaseTitle, socialDescriptions: { instagram, facebook, tiktok, linkedin, twitter } };
  } catch {
    const descStr = typeof rawDescriptions === 'object' ? JSON.stringify(rawDescriptions) : String(rawDescriptions);
    return {
      supabaseTitle: descStr,
      socialDescriptions: { instagram: descStr, facebook: descStr, tiktok: descStr, linkedin: descStr, twitter: descStr }
    };
  }
}

const findScenesRecursively = (obj: any): any[] => {
  if (!obj) return [];
  let allScenes: any[] = [];
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      allScenes = allScenes.concat(findScenesRecursively(item));
    }
  } else if (typeof obj === 'object') {
    if (obj.scenes && Array.isArray(obj.scenes)) {
      allScenes = allScenes.concat(obj.scenes);
    }
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && key !== 'scenes') {
        allScenes = allScenes.concat(findScenesRecursively(obj[key]));
      }
    }
  }
  return allScenes;
};

interface ToastState {
  message: string;
  type: string;
  persistent?: boolean;
}

export default function SocialDash() {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [supabaseVideoUrl, setSupabaseVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [isVideoPosting, setIsVideoPosting] = useState<boolean>(false);
  const [isImagePosting, setIsImagePosting] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<string>("Loading...");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showRetryModal, setShowRetryModal] = useState<boolean>(false);
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [generatedStory, setGeneratedStory] = useState<string | null>(null);
  const [generatedScenes, setGeneratedScenes] = useState<any[]>([]);
  const [sceneFailures, setSceneFailures] = useState<Record<number, { msg: string; column: 'image' | 'video' }>>({}); // 0-based idx → { msg, column }
  const [acceptedStory, setAcceptedStory] = useState<string | null>(null);
  const [lastInputs, setLastInputs] = useState<any>(null);
  const [videoFormData, setVideoFormData] = useState<{
    character: string;
    category: string;
    description: string;
    videoStyle: string;
    language: string;
    voice: string;
    backgroundSong: string;
    duration: string | number;
  }>({
    character: "male",
    category: "Hair Transplant",
    description: "",
    videoStyle: "Highly Realistic 4k, real life",
    language: "English",
    voice: "KLoLpdGWK7agg0O2TJYg",
    backgroundSong: "Inspirational - Sunrise Bloom",
    duration: 30
  });
  const [imagePrompt, setImagePrompt] = useState<string>("");
  const [imageRatio, setImageRatio] = useState<'16:9' | '9:16'>('16:9');
  const [progress, setProgress] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationType, setGenerationType] = useState<'video' | 'images' | null>(null);
  const [videoIsGenerating, setVideoIsGenerating] = useState<boolean>(false);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [videoKey, setVideoKey] = useState<number>(0);
  const pendingVideoRef = useRef<boolean>(false);
  const videoGenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentVideoUrlRef = useRef<string | null>(null);
  const prevStatusRef = useRef<string | undefined>(undefined); // tracks previous status to detect transitions
  const hasTriggeredInSession = useRef<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [voiceLabel, setVoiceLabel] = useState<string>("Charlie - Men");

  // ── Social Image Workspace States ──
  const [showImageWorkspace, setShowImageWorkspace] = useState<boolean>(true);
  const [isImageGenerating, setIsImageGenerating] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [generatedSocialImage, setGeneratedSocialImage] = useState<string | null>(null);
  const [supabaseImageUrl, setSupabaseImageUrl] = useState<string | null>(null);
  const [supabaseDescription, setSupabaseDescription] = useState<string>('');
  const [socialDescriptions, setSocialDescriptions] = useState<{
    instagram: string;
    facebook: string;
    tiktok: string;
    linkedin: string;
    twitter: string;
  }>({
    instagram: "",
    facebook: "",
    tiktok: "",
    linkedin: "",
    twitter: ""
  });
  const [activePlatform, setActivePlatform] = useState<'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'twitter'>('instagram');
  const [showSocialRetryModal, setShowSocialRetryModal] = useState<boolean>(false);

  const [videoMetadata, setVideoMetadata] = useState<{
    instagram?: { title?: string; content?: string; char_count?: number };
    facebook?: { title?: string; content?: string; char_count?: number };
    linkedin?: { title?: string; content?: string; char_count?: number };
    tiktok?: { title?: string; caption?: string; description?: string; char_count?: number };
    youtube?: { title?: string; description?: string; char_count?: number };
    twitter?: { content?: string; char_count?: number };
  } | null>(null);
  const [activeVideoPlatform, setActiveVideoPlatform] = useState<'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter'>('instagram');

  // ── Supabase Images table: fetch & stream video_link, image_link, Descriptions from row id=1 ──
  useEffect(() => {
    const fetchImageData = async () => {
      try {
        const { data, error } = await supabase
          .from('Images')
          .select('image_link, Descriptions')
          .eq('id', 1)
          .single();
        console.log('[Images fetch] data:', data, '| error:', error);
        if (data?.image_link) {
          setSupabaseImageUrl(data.image_link);
          setGeneratedSocialImage(data.image_link);
          setShowImageWorkspace(true);
        }
        if (data?.Descriptions) {
          const parsed = parseDescriptions(data.Descriptions);
          setSupabaseDescription(parsed.supabaseTitle);
          setSocialDescriptions(parsed.socialDescriptions);
        }
      } catch (err) {
        console.error("Error fetching initial image data from Supabase:", err);
      } finally {
        setIsInitialLoading(false);
      }
    };
    const fetchVideoData = async () => {
      try {
        const res = await fetch('/api/video-metadata');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data?.video_link) {
          if (data.video_link !== currentVideoUrlRef.current) {
            // New video URL written by n8n — update preview
            currentVideoUrlRef.current = data.video_link;
            setSupabaseVideoUrl(data.video_link);
            setVideoKey(k => k + 1);
            if (pendingVideoRef.current) {
              pendingVideoRef.current = false;
              if (videoGenTimeoutRef.current) clearTimeout(videoGenTimeoutRef.current);
              setVideoIsGenerating(false);
              setVideoProgress(100);
            }
          }
        }
        if (data?.metadata) setVideoMetadata(data.metadata);
      } catch (err) {
        console.error("Error fetching video data from server API proxy:", err);
      }
    };

    fetchImageData();
    fetchVideoData();

    // Set up polling for live video metadata (to bypass real-time subscription RLS block)
    const videoPollInterval = setInterval(() => {
      fetchVideoData();
    }, 8000);

    const channel = supabase
      .channel('images-all-cols')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Images', filter: 'id=eq.1' }, (payload: any) => {
        if (payload.new?.image_link) {
          setSupabaseImageUrl(payload.new.image_link);
          setGeneratedSocialImage(payload.new.image_link);
          setShowImageWorkspace(true);
        }
        if (payload.new?.Descriptions) {
          const parsed = parseDescriptions(payload.new.Descriptions);
          setSupabaseDescription(parsed.supabaseTitle);
          setSocialDescriptions(parsed.socialDescriptions);
        }
      })
      .subscribe();

    const videoChannel = supabase
      .channel('videos-all-cols')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'videos', filter: 'id=eq.1' }, (payload: any) => {
        console.log('[Videos channel update] payload:', payload);
        if (payload.new?.video_link && payload.new.video_link !== currentVideoUrlRef.current) {
          currentVideoUrlRef.current = payload.new.video_link;
          setSupabaseVideoUrl(payload.new.video_link);
          setVideoKey(k => k + 1);
          if (pendingVideoRef.current) {
            pendingVideoRef.current = false;
            if (videoGenTimeoutRef.current) clearTimeout(videoGenTimeoutRef.current);
            setVideoIsGenerating(false);
            setVideoProgress(100);
          }
        }
        if (payload.new?.metadata) {
          setVideoMetadata(payload.new.metadata);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(videoChannel);
      clearInterval(videoPollInterval);
    };
  }, []);

  // ── Automatically detect aspect ratio of generated/fetched image ──
  useEffect(() => {
    if (generatedSocialImage) {
      const img = new window.Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        if (ratio > 1) {
          setImageRatio('16:9');
        } else {
          setImageRatio('9:16');
        }
      };
      img.src = generatedSocialImage;
    }
  }, [generatedSocialImage]);

  // ── Clear progress from localStorage on page load (so refresh removes it) ──
  useEffect(() => {
    localStorage.removeItem('sd_generation_start');
  }, []);

  useEffect(() => {
    const sampleUrl = "https://cdssxtquayzijmbnlqmt.supabase.co/storage/v1/object/public/n8n/finalbefore2.mp3";
    setVideoUrl(`${sampleUrl}?t=${Date.now()}`);

    const fetchStatus = async () => {
      try {
        const { data, error } = await socialSupabase
          .from('n8n')
          .select('status')
          .order('id', { ascending: false })
          .limit(1);

        if (error) { setStatus("Status Error"); }
        else if (data && data.length > 0) { setStatus(data[0].status); }
        else { setStatus("Waiting for Data..."); }
      } catch { setStatus("Connection Error"); }
    };

    fetchStatus();

    const channel = socialSupabase
      .channel('n8n-status-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'n8n' }, (payload: any) => {
        if (payload.new?.status) setStatus(payload.new.status);
      })
      .subscribe();

    return () => { socialSupabase.removeChannel(channel); };
  }, []);

  // Timer for video pipeline progress (max 6 minutes = 360s)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (videoIsGenerating) {
      interval = setInterval(() => {
        setVideoProgress((prev) => {
          if (prev >= 98) { clearInterval(interval); return 98; }
          return prev + (100 / 360);
        });
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [videoIsGenerating]);

  // Timer for image pipeline progress (max 60s)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 98) { clearInterval(interval); return 98; }
          return prev + (100 / 60);
        });
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isGenerating]);

  // Monitor status to trigger video preview refresh only (completely decoupled from prompt/image loading progress)
  useEffect(() => {
    const isDone = status?.toLowerCase().includes("successfully") || status?.toLowerCase().includes("completed");
    const prevIsDone = prevStatusRef.current?.toLowerCase().includes("successfully") || prevStatusRef.current?.toLowerCase().includes("completed");
    const isFirstLoad = prevStatusRef.current === undefined;

    if (isDone && !isFirstLoad && !prevIsDone && !isGenerating) {
      // ✅ Status changed to done during video pipeline — refresh preview
      handleRefreshPreview();
      showToast("Video preview updated!", "success");
    }

    prevStatusRef.current = status; // always update after checking
  }, [status]);

  const [isRefreshingVideo, setIsRefreshingVideo] = useState<boolean>(false);

  const handleRefreshPreview = async () => {
    setIsRefreshingVideo(true);
    try {
      const res = await fetch(`/api/video-metadata?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.video_link) {
          if (data.video_link !== currentVideoUrlRef.current) {
            currentVideoUrlRef.current = data.video_link;
            setSupabaseVideoUrl(data.video_link);
          }
          // Force the video element to reload (same or new URL)
          setVideoKey(k => k + 1);
        }
        if (data?.metadata) {
          setVideoMetadata(data.metadata);
        }
      }
    } catch (err) {
      console.error("Error refreshing video preview:", err);
    } finally {
      setIsRefreshingVideo(false);
    }
  };

  const [isRefreshingImage, setIsRefreshingImage] = useState<boolean>(false);

  const handleRefreshImagePreview = async () => {
    setIsRefreshingImage(true);
    try {
      const { data } = await supabase
        .from('Images')
        .select('image_link, Descriptions')
        .eq('id', 1)
        .single();
      if (data?.image_link) {
        setSupabaseImageUrl(data.image_link);
        setGeneratedSocialImage(`${data.image_link}?t=${Date.now()}`);
        setShowImageWorkspace(true);
      }
      if (data?.Descriptions) {
        const parsed = parseDescriptions(data.Descriptions);
        setSupabaseDescription(parsed.supabaseTitle);
        setSocialDescriptions(parsed.socialDescriptions);
      }
    } catch (err) {
      console.error("Error refreshing image preview:", err);
    } finally {
      setIsRefreshingImage(false);
    }
  };


  const showToast = (message: string, type = 'info', persistent = false) => {
    setToast({ message, type, persistent });
    if (!persistent) {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const triggerWebhook = async (url: string, label: string, successMessage: string, body: any = null, method = 'POST') => {
    if (label === 'post') {
      setIsVideoPosting(true);
    } else if (label === 'post_social') {
      setIsImagePosting(true);
    } else {
      setLoading(label);
    }
    console.log(`[UI] Triggering webhook: ${url}`, { body, method });
    try {
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, body, method }),
      });

      console.log(`[UI] Proxy response status: ${response.status} ${response.statusText}`);

      const rawText = await response.text();
      console.log(`[UI] Raw proxy response:`, rawText.slice(0, 1000));

      let data: any;
      try { data = JSON.parse(rawText); }
      catch { data = rawText ? { message: rawText } : { status: 'ok' }; }

      if (response.ok) {
        const isPostAction = label === 'post' || label === 'post_social';
        showToast(successMessage, 'success', isPostAction);
        return data;
      } else {
        console.error(`[UI] Webhook failed:`, data);
        showToast(`Trigger failed: ${data?.error || response.statusText}`, 'info');
        return null;
      }
    } catch (err) {
      console.error("[UI] Webhook fetch error:", err);
      showToast("Trigger failed. Check browser console for details.", 'info');
      return null;
    } finally {
      if (label === 'post') {
        setIsVideoPosting(false);
      } else if (label === 'post_social') {
        setIsImagePosting(false);
      } else {
        setLoading(null);
      }
    }
  };

  const handleGenerateImages = () => {
    setShowImageModal(true);
  };

  const handleImagePromptSubmit = async (prompt: string) => {
    setShowImageModal(false);
    setStatus("Generating images...");
    setIsGenerating(true);
    setGenerationType('images');
    setProgress(0);
    hasTriggeredInSession.current = true;

    // Switch to visual workspace & show mobile screen loader instantly
    setShowImageWorkspace(true);
    setIsImageGenerating(true);
    setGeneratedSocialImage(null);

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_SOCIAL_IMAGE_URL || "https://n8n.srv1208919.hstgr.cloud/webhook/1703fb64-ec58-4e56-9ce7-bd9e16e15220";
    const result = await triggerWebhook(
      webhookUrl,
      "images",
      "Images generated successfully!",
      { prompt, text: prompt, ratio: imageRatio, aspect_ratio: imageRatio },
      "POST"
    );

    if (result) {
      setProgress(100);
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationType(null);
      }, 1000);

      // Parse n8n response payload structure
      try {
        const payload = Array.isArray(result) ? result[0] : result;
        const imageUrl = payload?.image_url || payload?.image || "https://tempfile.aiquickdraw.com/workers/nano/image_1779862412111_eo1ssy.png";
        const platforms = payload?.platforms || {};

        const instaText = platforms.instagram?.content || 
                          platforms.instagram?.caption || 
                          "What Nobody Tells You About DHI Hair Transplants 🇹🇷\n\nWaiting for hair restoration in Canada felt endless and costly. Discovering the DHI hair transplant with TOGA Health in Turkey changed everything — a no-shave, minimally invasive method that offers precision and faster recovery. Unlike traditional transplants, DHI uses direct implantation for a natural look without long downtime. Now, I can enjoy fuller hair without hiding behind scars or shaved areas. TOGA Health helped me skip the wait and regain confidence with cutting-edge care tailored just for me. Visit TOGA Health to learn more about transforming your life\n\n.\n.\n.\n#HairTransplant #HairRestoration #HairTransplantTurkey #MedicalTourismTurkey #IstanbulHealthcare #CanadianPatients #ConfidenceRestored #LifeTransformation #NewBeginnings #SelfCareJourney #TransformationStory #TOGAHealth #MedicalTourism #AffordableHealthcare";

        const fbText = platforms.facebook?.content || 
                       platforms.facebook?.caption || 
                       "What Nobody Tells You About DHI Hair Transplants 🇹🇷\n\nWaiting for hair restoration in Canada felt endless and costly. Discovering the DHI hair transplant with TOGA Health in Turkey changed everything — a no-shave, minimally invasive method that offers precision and faster recovery. Unlike traditional transplants, DHI uses direct implantation for a natural look without long downtime. Now, I can enjoy fuller hair without hiding behind scars or shaved areas. TOGA Health helped me skip the wait and regain confidence with cutting-edge care tailored just for me. Visit TOGA Health to learn more about transforming your life\n\n#HairTransplant #HairRestoration #HairTransplantTurkey #MedicalTourismTurkey #IstanbulHealthcare #CanadianPatients #ConfidenceRestored #LifeTransformation #NewBeginnings #SelfCareJourney #TransformationStory #TOGAHealth #MedicalTourism #AffordableHealthcare";

        const ttText = payload?.raw?.caption ||
                       payload?.Descriptions?.caption ||
                       platforms.tiktok?.caption || 
                       platforms.tiktok?.content || 
                       platforms.tiktok?.description || 
                       "What Nobody Tells You About DHI Hair Transplants 🇹🇷\n\n#HairTransplant #HairRestoration #HairTransplantTurkey";

        const twText = platforms.twitter?.content || 
                       platforms.twitter?.caption || 
                       platforms.twitter?.description || 
                       "What Nobody Tells You About DHI Hair Transplants 🇹🇷\n\nWaiting for hair restoration in Canada felt endless. Discovering DHI with TOGA Health changed everything! #HairTransplant #Turkey";

        const liText = platforms.linkedin?.content || 
                       platforms.linkedin?.caption || 
                       "What Nobody Tells You About DHI Hair Transplants 🇹🇷\n\nWaiting for hair restoration in Canada felt endless and costly. Discovering the DHI hair transplant with TOGA Health in Turkey changed everything — a no-shave, minimally invasive method that offers precision and faster recovery. Unlike traditional transplants, DHI uses direct implantation for a natural look without long downtime. Now, I can enjoy fuller hair without hiding behind scars or shaved areas. TOGA Health helped me skip the wait and regain confidence with cutting-edge care tailored just for me. Visit TOGA Health to learn more about transforming your life\n\n#HairTransplant #HairRestoration #HairTransplantTurkey #MedicalTourismTurkey #IstanbulHealthcare #CanadianPatients #ConfidenceRestored";

        setGeneratedSocialImage(imageUrl);
        setSocialDescriptions({
          instagram: instaText,
          facebook: fbText,
          tiktok: ttText,
          linkedin: liText,
          twitter: twText
        });
        // Auto-refresh image preview from Supabase after successful generation
        setTimeout(() => handleRefreshImagePreview(), 1500);
      } catch (err) {
        console.error("Error parsing webhook social data:", err);
      } finally {
        setIsImageGenerating(false);
      }
    } else {
      setIsGenerating(false);
      setGenerationType(null);
      setIsImageGenerating(false);
      
      setSocialDescriptions({
        instagram: "What Nobody Tells You About DHI Hair Transplants 🇹🇷\n\nWaiting for hair restoration in Canada felt endless and costly. Discovering the DHI hair transplant with TOGA Health in Turkey changed everything — a no-shave, minimally invasive method that offers precision and faster recovery. Unlike traditional transplants, DHI uses direct implantation for a natural look without long downtime. Now, I can enjoy fuller hair without hiding behind scars or shaved areas. TOGA Health helped me skip the wait and regain confidence with cutting-edge care tailored just for me. Visit TOGA Health to learn more about transforming your life\n\n.\n.\n.\n#HairTransplant #HairRestoration #HairTransplantTurkey #MedicalTourismTurkey #IstanbulHealthcare #CanadianPatients #ConfidenceRestored #LifeTransformation #NewBeginnings #SelfCareJourney #TransformationStory #TOGAHealth #MedicalTourism #AffordableHealthcare",
        facebook: "What Nobody Tells You About DHI Hair Transplants 🇹🇷\n\nWaiting for hair restoration in Canada felt endless and costly. Discovering the DHI hair transplant with TOGA Health in Turkey changed everything — a no-shave, minimally invasive method that offers precision and faster recovery. Unlike traditional transplants, DHI uses direct implantation for a natural look without long downtime. Now, I can enjoy fuller hair without hiding behind scars or shaved areas. TOGA Health helped me skip the wait and regain confidence with cutting-edge care tailored just for me. Visit TOGA Health to learn more about transforming your life\n\n#HairTransplant #HairRestoration #HairTransplantTurkey #MedicalTourismTurkey #IstanbulHealthcare #CanadianPatients #ConfidenceRestored #LifeTransformation #NewBeginnings #SelfCareJourney #TransformationStory #TOGAHealth #MedicalTourism #AffordableHealthcare",
        tiktok: "What Nobody Tells You About DHI Hair Transplants 🇹🇷\n\n#HairTransplant #HairRestoration #HairTransplantTurkey",
        linkedin: "What Nobody Tells You About DHI Hair Transplants 🇹🇷\n\nWaiting for hair restoration in Canada felt endless and costly. Discovering the DHI hair transplant with TOGA Health in Turkey changed everything — a no-shave, minimally invasive method that offers precision and faster recovery. Unlike traditional transplants, DHI uses direct implantation for a natural look without long downtime. Now, I can enjoy fuller hair without hiding behind scars or shaved areas. TOGA Health helped me skip the wait and regain confidence with cutting-edge care tailored just for me. Visit TOGA Health to learn more about transforming your life\n\n#HairTransplant #HairRestoration #HairTransplantTurkey #MedicalTourismTurkey #IstanbulHealthcare #CanadianPatients #ConfidenceRestored",
        twitter: "What Nobody Tells You About DHI Hair Transplants 🇹🇷\n\nWaiting for hair restoration in Canada felt endless. Discovering DHI with TOGA Health changed everything! #HairTransplant #Turkey"
      });
    }
  };

  const handleSocialPost = async () => {
    setIsImagePosting(true);
    try {
      const webhookUrl = process.env.NEXT_PUBLIC_N8N_SOCIAL_POST_IMAGE_URL;
      await triggerWebhook(
        webhookUrl,
        "post_social",
        "IMAGE PUBLISHED SUCCESSFULLY",
        {
          image_url: generatedSocialImage,
          descriptions: socialDescriptions,
          status: "Approved"
        },
        "POST"
      );
    } finally {
      setIsImagePosting(false);
    }
  };

  const handleSocialRetrySubmit = async (retryPrompt: string) => {
    setShowSocialRetryModal(false);
    setStatus("Regenerating images...");
    setIsGenerating(true);
    setGenerationType('images');
    setProgress(0);
    hasTriggeredInSession.current = true;

    // Switch to visual workspace & show mobile screen loader instantly
    setShowImageWorkspace(true);
    setIsImageGenerating(true);
    setGeneratedSocialImage(null);

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_SOCIAL_REGEN_URL;
    const result = await triggerWebhook(
      webhookUrl,
      "images",
      "Social campaign regenerated successfully!",
      {
        prompt: retryPrompt,
        text: retryPrompt,
        previous_prompt: imagePrompt,
        ratio: imageRatio,
        aspect_ratio: imageRatio,
        is_retry: true,
        status: "Reject",
        image_link: supabaseImageUrl || generatedSocialImage,
        previous_image: generatedSocialImage,
        descriptions: socialDescriptions,
        supabase_description: supabaseDescription,
      },
      "POST"
    );

    if (result) {
      setProgress(100);
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationType(null);
      }, 1000);

      // Parse n8n response payload structure
      try {
        const payload = Array.isArray(result) ? result[0] : result;
        const imageUrl = payload?.image_url || payload?.image || "https://tempfile.aiquickdraw.com/workers/nano/image_1779862412111_eo1ssy.png";
        const platforms = payload?.platforms || {};

        const instaText = platforms.instagram?.content || 
                          platforms.instagram?.caption || 
                          "";

        const fbText = platforms.facebook?.content || 
                       platforms.facebook?.caption || 
                       "";

        const ttText = payload?.raw?.caption ||
                       payload?.Descriptions?.caption ||
                       platforms.tiktok?.caption || 
                       platforms.tiktok?.content || 
                       platforms.tiktok?.description || 
                       "";

        const liText = platforms.linkedin?.content || 
                       platforms.linkedin?.caption || 
                       "";

        const twText = platforms.twitter?.content || 
                       platforms.twitter?.caption || 
                       platforms.twitter?.description || 
                       "";

        setGeneratedSocialImage(imageUrl);
        setSocialDescriptions({
          instagram: instaText,
          facebook: fbText,
          tiktok: ttText,
          linkedin: liText,
          twitter: twText
        });
      } catch (err) {
        console.error("Error parsing webhook social data in retry:", err);
      } finally {
        setIsImageGenerating(false);
      }
    } else {
      setIsGenerating(false);
      setGenerationType(null);
      setIsImageGenerating(false);
    }
  };

  const handleManualTrigger = () => {
    setIsGenerating(true);
    setProgress(0);
    hasTriggeredInSession.current = true;
    localStorage.setItem('sd_generation_start', Date.now().toString()); // ── Persist start time
    setStatus("Starting video process...");
    const webhookUrl = process.env.NEXT_PUBLIC_N8N_SOCIAL_MANUAL_URL || "https://n8n.srv1208919.hstgr.cloud/webhook/289d4090-ac38-4c90-9876-5ca765e46211";
    triggerWebhook(
      webhookUrl,
      "manual", "Video processing started. Check email!"
    );
  };

  const handleDynamicTrigger = () => {
    setShowModal(true);
    setGeneratedScenes([]);
  };

  const handleModalSubmit = async (data: any) => {
    console.log("[UI] Modal submitted with data:", data);
    setShowModal(false);
    
    // Normalize duration value (append 's' if numeric or missing 's')
    const formattedData = {
      ...data,
      duration: typeof data.duration === 'number' || (typeof data.duration === 'string' && !data.duration.endsWith('s'))
        ? `${data.duration}s`
        : data.duration
    };
    
    setLastInputs(formattedData);
    setGeneratedScenes([]);

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_SOCIAL_DYNAMIC_URL || "https://n8n.srv1208919.hstgr.cloud/webhook/7be28969-c4ad-404a-b982-841dda7133af";
    const result = await triggerWebhook(
      webhookUrl,
      "dynamic",
      "Spotlight Triggered!",
      formattedData
    );

    console.log("[UI] handleModalSubmit result:", result);

    const story = Array.isArray(result)
      ? (result[0]?.output?.story || result[0]?.story)
      : (result?.output?.story || result?.story);

    console.log("[UI] Extracted story:", story ? story.slice(0, 100) : "NONE");

    if (story) {
      setGeneratedStory(story);
    } else {
      console.warn("[UI] No story found in result. Full result:", JSON.stringify(result));
    }
  };

  const handleAcceptStory = async () => {
    const backupStory = generatedStory;
    setGeneratedStory(null); // Clear immediately as requested
    setGeneratedScenes([]);
    setAcceptedStory(null); // Clear any previous accepted story
    
    // Start progress bar loader immediately on click
    setVideoIsGenerating(true);
    setVideoProgress(0);
    hasTriggeredInSession.current = true;
    localStorage.setItem('sd_generation_start', Date.now().toString()); // ── Persist start time
    setStatus("Accepting story and generating prompts...");

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_SOCIAL_ACCEPT_URL || "https://n8n.srv1208919.hstgr.cloud/webhook/81f0d39d-6344-421a-b3a2-019b2c737483";
    const result = await triggerWebhook(
      webhookUrl,
      "accept",
      "Story accepted and saved!",
      { ...lastInputs, generated_story: backupStory, status: "accepted" }
    );

    console.log("[UI] handleAcceptStory result:", result);

    const scenes = findScenesRecursively(result) || [];

    const isAccepted = (scenes && scenes.length > 0) || (
      Array.isArray(result)
        ? (result[0]?.body?.status === "accepted" || result[0]?.status === "accepted" || (result[0]?.body && result[0].body.status === "accepted") || (result[0] && result[0].status === "accepted"))
        : (result?.body?.status === "accepted" || result?.status === "accepted" || (result?.body && result.body.status === "accepted") || (result && result.status === "accepted"))
    );

    if (isAccepted && scenes && scenes.length > 0) {
      console.log("[UI] Story accepted, scenes returned directly from webhook response. Rendering.");
      setGeneratedScenes(scenes);
      setAcceptedStory(backupStory); // Retain accepted story text
      setVideoProgress(100);
      setTimeout(() => {
        setVideoIsGenerating(false);
      }, 1000);
    } else {
      if (isAccepted) {
        console.warn("[UI] Story accepted but no scenes returned in webhook response. Decoupling progress check.");
      } else {
        console.warn("[UI] Accept webhook failed or was rejected.");
      }
      setVideoIsGenerating(false);
    }
  };

  const handleConfirmPrompts = async () => {
    setSceneFailures({}); // clear any previous failures
    setVideoIsGenerating(true);
    setVideoProgress(0);
    setIsConfirming(true);
    hasTriggeredInSession.current = true;
    localStorage.setItem('sd_generation_start', Date.now().toString());
    setStatus("Generating your social video preview...");

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_SOCIAL_CONFIRM_URL;
    console.log("[UI] Confirming prompts to:", webhookUrl);

    let result: any = null;
    try {
      // Use direct fetch through proxy so we can read the body even on non-200 responses
      const proxyRes = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          method: 'POST',
          body: { story: acceptedStory, scenes: generatedScenes, status: "confirmed" }
        })
      });
      const rawText = await proxyRes.text();
      try { result = JSON.parse(rawText); } catch { result = rawText ? { message: rawText } : null; }
      console.log("[UI] Confirm prompts raw response:", rawText.slice(0, 500));
    } catch (err) {
      console.error("[UI] Confirm prompts fetch error:", err);
    } finally {
      setIsConfirming(false);
    }

    if (result) {
      // Check for partial/full failures due to policy violations (present in both 200 and non-200 responses)
      const responseArr = Array.isArray(result) ? result : [result];
      const responseObj = responseArr[0] ?? result;
      const failedResults: any[] = responseObj?.results?.filter((r: any) => r.state === 'fail') || [];

      if (failedResults.length > 0) {
        const failures: Record<number, { msg: string; column: 'image' | 'video' }> = {};
        failedResults.forEach((r: any) => {
          // Detect failure type: video tasks have duration/aspect_ratio fields
          const isVideoTask = r.duration !== undefined || r.aspect_ratio !== undefined;
          const column: 'image' | 'video' = isVideoTask ? 'video' : 'image';
          const sceneIdx = (r.index ?? 0) - 1; // 1-based → 0-based
          failures[sceneIdx] = {
            msg: r.failMsg || 'This prompt violated content policy.',
            column,
          };
        });
        setSceneFailures(failures);
        setVideoIsGenerating(false);
        showToast(`${failedResults.length} prompt(s) failed — edit the highlighted scenes and resubmit.`, 'info');
        return;
      }

      // All succeeded — prompts accepted, video is now rendering async in n8n
      console.log("[UI] Prompts confirmed, video rendering started:", result);
      setGeneratedScenes([]);
      setAcceptedStory(null);
      // Keep videoIsGenerating=true — will be cleared when Supabase videos row is updated
      pendingVideoRef.current = true;
      // Safety fallback: clear after 8 minutes if Supabase never fires
      videoGenTimeoutRef.current = setTimeout(() => {
        if (pendingVideoRef.current) {
          pendingVideoRef.current = false;
          setVideoIsGenerating(false);
        }
      }, 8 * 60 * 1000);
      showToast("Video is rendering — preview will update automatically when ready.", "success");
    } else {
      console.warn("[UI] Confirm prompts webhook failed with no data.");
      setVideoIsGenerating(false);
    }
  };

  const handleRetrySubmit = async (retryPrompt: string) => {
    setShowRetryModal(false);
    setGeneratedScenes([]);
    setSceneFailures({});
    const data = { ...lastInputs, retry_prompt: retryPrompt, status: "retry", generated_story: generatedStory };
    
    const webhookUrl = process.env.NEXT_PUBLIC_N8N_SOCIAL_RETRY_URL || "https://n8n.srv1208919.hstgr.cloud/webhook/ddcfb213-9313-46e3-8270-dd603301c1bd";
    const result = await triggerWebhook(
      webhookUrl,
      "dynamic", 
      "Retry Triggered!",
      data
    );

    const story = Array.isArray(result) 
      ? (result[0]?.output?.story || result[0]?.story)
      : (result?.output?.story || result?.story);
    
    if (story) {
      setGeneratedStory(story);
    }
  };

  const getPlatformConfig = (platform: 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'twitter') => {
    switch (platform) {
      case 'instagram':
        return {
          color: '#e1306c',
          bgActive: 'rgba(225, 48, 108, 0.15)',
          borderColor: 'rgba(225, 48, 108, 0.3)',
          charLimit: 2200,
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
          )
        };
      case 'facebook':
        return {
          color: '#1877f2',
          bgActive: 'rgba(24, 119, 242, 0.15)',
          borderColor: 'rgba(24, 119, 242, 0.3)',
          charLimit: 63206,
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          )
        };
      case 'tiktok':
        return {
          color: '#00f2fe',
          bgActive: 'rgba(0, 242, 254, 0.15)',
          borderColor: 'rgba(0, 242, 254, 0.3)',
          charLimit: 2200,
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.07-2.88-.53-4.13-1.28-.24-.15-.47-.32-.69-.49v7.1c0 2.22-.64 4.51-2.22 6.09-1.63 1.67-4.14 2.59-6.45 2.44-2.83-.16-5.61-2.07-6.52-4.78C1.23 15.81 1.76 12 3.86 9.77c1.7-1.85 4.41-2.71 6.89-2.22V11.7c-1.39-.47-3.07-.13-4.08.88a4.13 4.13 0 00-1.07 3.52c.28 1.54 1.61 2.87 3.16 3.03 1.79.16 3.61-.95 4.09-2.67.14-.52.17-1.06.17-1.6V.02z" />
            </svg>
          )
        };
      case 'linkedin':
        return {
          color: '#0a66c2',
          bgActive: 'rgba(10, 102, 194, 0.15)',
          borderColor: 'rgba(10, 102, 194, 0.3)',
          charLimit: 3000,
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z" />
            </svg>
          )
        };
      case 'twitter':
        return {
          color: '#000000',
          bgActive: 'rgba(0, 0, 0, 0.08)',
          borderColor: 'rgba(0, 0, 0, 0.2)',
          charLimit: 280,
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.734l7.736-8.852L2.017 2.25H8.1l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
            </svg>
          )
        };
      default:
        return {
          color: '#64748b',
          bgActive: 'rgba(100,116,139,0.1)',
          borderColor: 'rgba(100,116,139,0.2)',
          charLimit: 2200,
          icon: null
        };
    }
  };

  const renderAvatar = () => (
    <div style={{
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      background: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      border: '1px solid #e2e8f0'
    }}>
      <img src="/toga-health-logo.png" alt="Toga Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );

  const renderInstagramMock = () => {
    const text = socialDescriptions.instagram;
    const formattedText = text.split(/(\s+)/).map((word, i) => {
      if (word.startsWith('#')) {
        return <span key={i} style={{ color: '#00376b', fontWeight: 600 }}>{word}</span>;
      }
      return word;
    });

    return (
      <div style={{ paddingBottom: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {renderAvatar()}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, margin: 0 }}>toga_health_ai</p>
              <p style={{ fontSize: '9px', color: '#64748b', margin: 0 }}>AI Medical Center · Istanbul, Turkey</p>
            </div>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#64748b', cursor: 'pointer' }}>•••</span>
        </div>

        {/* Media Block */}
        <div style={{ background: '#000000', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', aspectRatio: imageRatio === '16:9' ? '16/9' : '9/16', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
          <img
            src={generatedSocialImage || ""}
            alt="Instagram Mockup"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* Action icons bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px' }}>
          <div style={{ display: 'flex', gap: '14px' }}>
            <span style={{ cursor: 'pointer', fontSize: '16px' }}>❤️</span>
            <span style={{ cursor: 'pointer', fontSize: '16px' }}>💬</span>
            <span style={{ cursor: 'pointer', fontSize: '16px' }}>➡️</span>
          </div>
          <span style={{ cursor: 'pointer', fontSize: '16px' }}>🔖</span>
        </div>

        {/* Likes */}
        <p style={{ fontSize: '11px', fontWeight: 700, padding: '0 12px', margin: '0 0 6px 0' }}>1,482 likes</p>

        {/* Description text */}
        <div style={{ padding: '0 12px', fontSize: '11px', lineHeight: '1.5', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          <span style={{ fontWeight: 700, marginRight: '6px' }}>toga_health_ai</span>
          {formattedText}
        </div>
      </div>
    );
  };

  const renderFacebookMock = () => {
    const text = socialDescriptions.facebook;
    const formattedText = text.split(/(\s+)/).map((word, i) => {
      if (word.startsWith('#')) {
        return <span key={i} style={{ color: '#1877f2', fontWeight: 500 }}>{word}</span>;
      }
      return word;
    });

    return (
      <div style={{ padding: '12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          {renderAvatar()}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, margin: 0 }}>Toga Health AI</p>
              <span style={{ color: '#1877f2', fontSize: '10px' }}>✔️</span>
            </div>
            <p style={{ fontSize: '9px', color: '#65676b', margin: 0 }}>Sponsored · 🌍</p>
          </div>
        </div>

        {/* Facebook Caption is ABOVE the image */}
        <p style={{ fontSize: '11px', lineHeight: '1.6', margin: '0 0 10px 0', wordBreak: 'break-word', whiteSpace: 'pre-wrap', color: '#0f172a' }}>
          {formattedText}
        </p>

        {/* Media Block */}
        <div style={{ background: '#f0f2f5', border: '1px solid #e4e6eb', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ width: '100%', aspectRatio: imageRatio === '16:9' ? '16/9' : '9/16', background: '#000000' }}>
            <img
              src={generatedSocialImage || ""}
              alt="Facebook Mockup"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div style={{ padding: '10px', background: '#f0f2f5', borderTop: '1px solid #e4e6eb' }}>
            <p style={{ fontSize: '9px', color: '#65676b', textTransform: 'uppercase', margin: 0 }}>togahealth.ai</p>
            <p style={{ fontSize: '12px', fontWeight: 700, margin: '4px 0 0 0', color: '#050505' }}>Skip the Canadian Medical Wait times</p>
          </div>
        </div>

        {/* Likes Count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e4e6eb', padding: '8px 0', marginTop: '8px' }}>
          <span style={{ fontSize: '10px', color: '#65676b' }}>👍❤️ 244</span>
          <span style={{ fontSize: '10px', color: '#65676b' }}>42 Comments · 18 Shares</span>
        </div>

        {/* Engagement buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px' }}>
          <button style={{ flex: 1, background: 'none', border: 'none', color: '#65676b', fontSize: '10px', fontWeight: 600, padding: '4px', cursor: 'pointer' }}>👍 Like</button>
          <button style={{ flex: 1, background: 'none', border: 'none', color: '#65676b', fontSize: '10px', fontWeight: 600, padding: '4px', cursor: 'pointer' }}>💬 Comment</button>
          <button style={{ flex: 1, background: 'none', border: 'none', color: '#65676b', fontSize: '10px', fontWeight: 600, padding: '4px', cursor: 'pointer' }}>➡️ Share</button>
        </div>
      </div>
    );
  };

  const renderLinkedInMock = () => {
    const text = socialDescriptions.linkedin;
    const formattedText = text.split(/(\s+)/).map((word, i) => {
      if (word.startsWith('#')) {
        return <span key={i} style={{ color: '#0a66c2', fontWeight: 600 }}>{word}</span>;
      }
      return word;
    });

    return (
      <div style={{ padding: '12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          {renderAvatar()}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, margin: 0, color: '#000000' }}>Toga Health AI</p>
            <p style={{ fontSize: '9px', color: '#64748b', margin: 0 }}>Innovative Patient Operations Hub · 10,240 followers</p>
            <p style={{ fontSize: '9px', color: '#64748b', margin: 0 }}>1h · 🌍</p>
          </div>
        </div>

        {/* LinkedIn Caption ABOVE the image */}
        <p style={{ fontSize: '11px', lineHeight: '1.6', margin: '0 0 10px 0', color: '#000000', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {formattedText}
        </p>

        {/* Media card */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden', background: '#000000', aspectRatio: imageRatio === '16:9' ? '16/9' : '9/16' }}>
          <img
            src={generatedSocialImage || ""}
            alt="LinkedIn Mockup"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* Likes Count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', padding: '8px 0', marginTop: '8px' }}>
          <span style={{ fontSize: '9px', color: '#64748b' }}>👍👏❤️ 82 · 12 comments</span>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px' }}>
          <button style={{ flex: 1, background: 'none', border: 'none', color: '#64748b', fontSize: '9px', fontWeight: 600, padding: '4px' }}>👍 Like</button>
          <button style={{ flex: 1, background: 'none', border: 'none', color: '#64748b', fontSize: '9px', fontWeight: 600, padding: '4px' }}>💬 Comment</button>
          <button style={{ flex: 1, background: 'none', border: 'none', color: '#64748b', fontSize: '9px', fontWeight: 600, padding: '4px' }}>➡️ Share</button>
          <button style={{ flex: 1, background: 'none', border: 'none', color: '#64748b', fontSize: '9px', fontWeight: 600, padding: '4px' }}>Send</button>
        </div>
      </div>
    );
  };

  const renderTikTokMock = () => {
    const text = socialDescriptions.tiktok;

    return (
      <div style={{ minHeight: '100%', width: '100%', background: '#000000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        
        {/* Background Image full fit */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
          <img
            src={generatedSocialImage || ""}
            alt="TikTok Mockup"
            style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.85 }}
          />
          {/* Subtle bottom gradient cover */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '140px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }} />
        </div>

        {/* Top Spacer */}
        <div style={{ zIndex: 2, height: '30px' }} />

        {/* Mid-content: Left User Details & Right floats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '10px', zIndex: 2, marginTop: 'auto', width: '100%' }}>
          
          {/* User & Caption Info */}
          <div style={{ flex: 1, paddingRight: '20px', color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.8)', textAlign: 'left' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, margin: '0 0 4px 0' }}>@toga_health_ai</p>
            <p style={{ fontSize: '9px', lineHeight: '1.4', margin: 0, maxHeight: '60px', overflowY: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
              {text}
            </p>
            <p style={{ fontSize: '8px', color: '#d4d4d8', marginTop: '4px' }}>🎵 original sound - Toga Health AI</p>
          </div>

          {/* Right Floating Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            {/* Avatar with Pink Plus */}
            <div style={{ position: 'relative', width: '28px', height: '28px' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '1.5px solid #ffffff', overflow: 'hidden', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/toga-health-logo.png" alt="Toga" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', background: '#ff0050', color: '#ffffff', borderRadius: '50%', width: '10px', height: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', fontWeight: 800 }}>+</div>
            </div>

            {/* Heart */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', cursor: 'pointer' }}>❤️</span>
              <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 600 }}>34.2K</span>
            </div>

            {/* Comment */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', cursor: 'pointer' }}>💬</span>
              <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 600 }}>822</span>
            </div>

            {/* Share */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', cursor: 'pointer' }}>➡️</span>
              <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 600 }}>154</span>
            </div>
            
            {/* Audio Vinyl */}
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#334155', border: '3px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0284c7' }} />
            </div>
          </div>

        </div>

      </div>
    );
  };

  const renderTwitterMock = () => {
    const text = socialDescriptions.twitter;
    const formattedText = text.split(/(\s+)/).map((word, i) => {
      if (word.startsWith('#') || word.startsWith('@')) {
        return <span key={i} style={{ color: '#1d9bf0', fontWeight: 600 }}>{word}</span>;
      }
      return word;
    });

    return (
      <div style={{ padding: '12px', background: '#ffffff' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {renderAvatar()}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Toga Health AI</p>
              <p style={{ fontSize: '9px', color: '#64748b', margin: 0 }}>@toga_health_ai · 1h</p>
            </div>
          </div>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="#000000">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.734l7.736-8.852L2.017 2.25H8.1l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
          </svg>
        </div>

        {/* Tweet Text */}
        <p style={{ fontSize: '12px', lineHeight: '1.6', margin: '0 0 10px 0', color: '#0f172a', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {formattedText}
        </p>

        {/* Image */}
        {generatedSocialImage && (
          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: '8px', background: '#000', aspectRatio: imageRatio === '16:9' ? '16/9' : '9/16' }}>
            <img src={generatedSocialImage} alt="X Post" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        )}

        {/* Char count */}
        <p style={{ fontSize: '9px', color: text.length > 280 ? '#ef4444' : '#94a3b8', margin: '0 0 8px 0', textAlign: 'right', fontWeight: 500 }}>
          {text.length} / 280
        </p>

        {/* Engagement */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
          {[['💬','84'],['🔁','312'],['❤️','2.1K'],['📊','18.4K'],['🔖','']].map(([icon, count], i) => (
            <button key={i} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '9px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
              {icon}{count && <span>{count}</span>}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const getVideoPlatformConfig = (platform: 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter') => {
    switch (platform) {
      case 'instagram':
        return {
          color: '#e1306c',
          bgActive: 'rgba(225, 48, 108, 0.15)',
          borderColor: 'rgba(225, 48, 108, 0.3)',
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
          )
        };
      case 'facebook':
        return {
          color: '#1877f2',
          bgActive: 'rgba(24, 119, 242, 0.15)',
          borderColor: 'rgba(24, 119, 242, 0.3)',
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          )
        };
      case 'linkedin':
        return {
          color: '#0a66c2',
          bgActive: 'rgba(10, 102, 194, 0.15)',
          borderColor: 'rgba(10, 102, 194, 0.3)',
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z" />
            </svg>
          )
        };
      case 'tiktok':
        return {
          color: '#00f2fe',
          bgActive: 'rgba(0, 242, 254, 0.15)',
          borderColor: 'rgba(0, 242, 254, 0.3)',
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.07-2.88-.53-4.13-1.28-.24-.15-.47-.32-.69-.49v7.1c0 2.22-.64 4.51-2.22 6.09-1.63 1.67-4.14 2.59-6.45 2.44-2.83-.16-5.61-2.07-6.52-4.78C1.23 15.81 1.76 12 3.86 9.77c1.7-1.85 4.41-2.71 6.89-2.22V11.7c-1.39-.47-3.07-.13-4.08.88a4.13 4.13 0 00-1.07 3.52c.28 1.54 1.61 2.87 3.16 3.03 1.79.16 3.61-.95 4.09-2.67.14-.52.17-1.06.17-1.6V.02z" />
            </svg>
          )
        };
      case 'youtube':
        return {
          color: '#ff0000',
          bgActive: 'rgba(255, 0, 0, 0.15)',
          borderColor: 'rgba(255, 0, 0, 0.3)',
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.107C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.388.511a3.002 3.002 0 0 0-2.11 2.107C0 8.053 0 12 0 12s0 3.947.502 5.837a3.003 3.003 0 0 0 2.11 2.107C4.495 20.455 12 20.455 12 20.455s7.505 0 9.388-.511a3.002 3.002 0 0 0 2.11-2.107C24 15.947 24 12 24 12s0-3.947-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          )
        };
      case 'twitter':
        return {
          color: '#000000',
          bgActive: 'rgba(0, 0, 0, 0.08)',
          borderColor: 'rgba(0, 0, 0, 0.2)',
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.734l7.736-8.852L2.017 2.25H8.1l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
            </svg>
          )
        };
    }
  };

  const renderVideoAvatar = () => (
    <div style={{
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      background: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      border: '1px solid #e2e8f0',
      flexShrink: 0
    }}>
      <img src="/toga-health-logo.png" alt="Toga Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );

  const renderInstagramVideoMock = (videoSrc: string, text: string) => {
    const formattedText = text.split(/(\s+)/).map((word, i) => {
      if (word.startsWith('#') || word.startsWith('@')) {
        return <span key={i} style={{ color: '#00376b', fontWeight: 600 }}>{word}</span>;
      }
      return word;
    });

    return (
      <div style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #efefef' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {renderVideoAvatar()}
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, margin: 0, color: '#262626' }}>toga_health_ai</p>
              <p style={{ fontSize: '8px', color: '#8e8e8e', margin: 0 }}>Istanbul, Turkey</p>
            </div>
          </div>
          <span style={{ fontSize: '12px', color: '#262626', fontWeight: 700, cursor: 'pointer' }}>•••</span>
        </div>

        {/* Video Player */}
        <div style={{ width: '100%', background: '#000000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}>
          <video ref={videoRef} src={videoSrc} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} key={videoKey} />
        </div>

        {/* Engagement Icons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px 4px 10px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span style={{ fontSize: '14px', cursor: 'pointer' }}>❤️</span>
            <span style={{ fontSize: '14px', cursor: 'pointer' }}>💬</span>
            <span style={{ fontSize: '14px', cursor: 'pointer' }}>✈️</span>
          </div>
          <span style={{ fontSize: '14px', cursor: 'pointer' }}>🔖</span>
        </div>

        {/* Caption */}
        <div style={{ padding: '0 10px 12px 10px', flex: 1 }}>
          <p style={{ fontSize: '9px', margin: '0 0 2px 0', color: '#262626', fontWeight: 700 }}>4,812 views</p>
          <p style={{ fontSize: '9px', lineHeight: '1.4', margin: 0, color: '#262626', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
            <span style={{ fontWeight: 700, marginRight: '4px' }}>toga_health_ai</span>
            {formattedText}
          </p>
        </div>
      </div>
    );
  };

  const renderFacebookVideoMock = (videoSrc: string, text: string) => {
    return (
      <div style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 8px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {renderVideoAvatar()}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, margin: 0, color: '#050505' }}>Toga Health AI</p>
                <span style={{ color: '#1877f2', fontSize: '9px' }}>✓</span>
              </div>
              <p style={{ fontSize: '8px', color: '#65676b', margin: 0 }}>Sponsored · 🌐</p>
            </div>
          </div>
          <span style={{ fontSize: '14px', color: '#65676b', cursor: 'pointer' }}>•••</span>
        </div>

        {/* Text Caption */}
        <p style={{ fontSize: '9px', lineHeight: '1.4', padding: '0 12px 8px 12px', margin: 0, color: '#050505', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {text}
        </p>

        {/* Video Player */}
        <div style={{ width: '100%', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px' }}>
          <video ref={videoRef} src={videoSrc} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} key={videoKey} />
        </div>

        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid #f0f2f5', borderBottom: '1px solid #f0f2f5' }}>
          {[['👍','Like'],['💬','Comment'],['➡️','Share']].map(([icon, label], i) => (
            <button key={i} style={{ background: 'none', border: 'none', color: '#65676b', fontSize: '9px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderLinkedInVideoMock = (videoSrc: string, text: string) => {
    return (
      <div style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 6px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {renderVideoAvatar()}
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, margin: 0, color: '#000000' }}>Toga Health AI</p>
              <p style={{ fontSize: '7px', color: '#00000099', margin: '1px 0 0 0' }}>AI-Powered Healthcare Solutions</p>
              <p style={{ fontSize: '7px', color: '#00000099', margin: 0 }}>1d · Edited · 🌐</p>
            </div>
          </div>
          <span style={{ fontSize: '14px', color: '#00000099', cursor: 'pointer' }}>•••</span>
        </div>

        {/* Text Caption */}
        <p style={{ fontSize: '9px', lineHeight: '1.4', padding: '4px 12px 8px 12px', margin: 0, color: '#000000e6', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {text}
        </p>

        {/* Video Player */}
        <div style={{ width: '100%', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px' }}>
          <video ref={videoRef} src={videoSrc} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} key={videoKey} />
        </div>

        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid #ebebeb' }}>
          {[['👍','Like'],['💬','Comment'],['🔁','Repost'],['✈️','Send']].map(([icon, label], i) => (
            <button key={i} style={{ background: 'none', border: 'none', color: '#00000099', fontSize: '9px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderTikTokVideoMock = (videoSrc: string, text: string) => {
    return (
      <div style={{ height: '100%', width: '100%', background: '#000000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        
        {/* Fullscreen Video Background */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
          <video ref={videoRef} src={videoSrc} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} key={videoKey} />
          {/* Subtle bottom gradient cover */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '140px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', pointerEvents: 'none' }} />
        </div>

        {/* Top Spacer */}
        <div style={{ zIndex: 2, height: '30px' }} />

        {/* Left overlays & Right engagement buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '10px', zIndex: 2, marginTop: 'auto', width: '100%' }}>
          
          {/* User Details & Caption Overlay */}
          <div style={{ flex: 1, paddingRight: '20px', color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.8)', textAlign: 'left' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, margin: '0 0 4px 0' }}>@toga_health_ai</p>
            <p style={{ fontSize: '9px', lineHeight: '1.4', margin: 0, maxHeight: '60px', overflowY: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
              {text}
            </p>
            <p style={{ fontSize: '8px', color: '#d4d4d8', marginTop: '4px' }}>🎵 original sound - Toga Health AI</p>
          </div>

          {/* Right Floating Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative', width: '28px', height: '28px' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '1.5px solid #ffffff', overflow: 'hidden', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/toga-health-logo.png" alt="Toga" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', background: '#ff0050', color: '#ffffff', borderRadius: '50%', width: '10px', height: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', fontWeight: 800 }}>+</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', cursor: 'pointer' }}>❤️</span>
              <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 600 }}>4.8K</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', cursor: 'pointer' }}>💬</span>
              <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 600 }}>188</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', cursor: 'pointer' }}>➡️</span>
              <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 600 }}>98</span>
            </div>
            
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#334155', border: '3px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0284c7' }} />
            </div>
          </div>

        </div>
      </div>
    );
  };

  const renderYouTubeVideoMock = (videoSrc: string, titleText: string, descriptionText: string) => {
    return (
      <div style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Video Player */}
        <div style={{ width: '100%', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '16/9' }}>
          <video ref={videoRef} src={videoSrc} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} key={videoKey} />
        </div>

        {/* Video metadata */}
        <div style={{ padding: '10px 12px 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ fontSize: '11px', fontWeight: 700, margin: 0, color: '#0f172a', lineHeight: '1.4' }}>
            {titleText || "Transforming Lives with Toga Health AI"}
          </h3>
          <p style={{ fontSize: '7.5px', color: '#64748b', margin: 0 }}>4.2K views · 2 hours ago</p>

          {/* Channel Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '6px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {renderVideoAvatar()}
              <div>
                <p style={{ fontSize: '9px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Toga Health AI</p>
                <p style={{ fontSize: '7.5px', color: '#64748b', margin: 0 }}>12.4K subscribers</p>
              </div>
            </div>
            <button style={{ background: '#cc0000', border: 'none', color: '#ffffff', fontSize: '8.5px', fontWeight: 700, borderRadius: '16px', padding: '5px 10px', cursor: 'pointer' }}>
              SUBSCRIBE
            </button>
          </div>

          {/* Video Description Box */}
          <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px 10px' }}>
            <p style={{ fontSize: '8px', color: '#334155', fontWeight: 700, margin: '0 0 4px 0' }}>Description</p>
            <p style={{ fontSize: '8px', lineHeight: '1.4', margin: 0, color: '#475569', wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto' }}>
              {descriptionText || "Welcome to Toga Health! Discover cutting-edge DHI hair transplant techniques and cosmetic dentistry in Istanbul, Turkey."}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderTwitterVideoMock = (videoSrc: string, text: string) => {
    const formattedText = text.split(/(\s+)/).map((word, i) => {
      if (word.startsWith('#') || word.startsWith('@')) {
        return <span key={i} style={{ color: '#1d9bf0', fontWeight: 600 }}>{word}</span>;
      }
      return word;
    });

    return (
      <div style={{ padding: '12px', background: '#ffffff', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {renderVideoAvatar()}
            <div>
              <p style={{ fontSize: '10px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Toga Health AI</p>
              <p style={{ fontSize: '8px', color: '#64748b', margin: 0 }}>@toga_health_ai · 1h</p>
            </div>
          </div>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="#000000">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.734l7.736-8.852L2.017 2.25H8.1l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
          </svg>
        </div>

        {/* Tweet Content */}
        <p style={{ fontSize: '10px', lineHeight: '1.5', margin: '0 0 10px 0', color: '#0f172a', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {formattedText}
        </p>

        {/* Video Player */}
        <div style={{ width: '100%', background: '#000000', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', marginBottom: '10px' }}>
          <video ref={videoRef} src={videoSrc} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} key={videoKey} />
        </div>

        {/* Engagement Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: 'auto' }}>
          {[['💬','42'],['🔁','112'],['❤️','812'],['📊','9.4K'],['🔖','']].map(([icon, count], i) => (
            <button key={i} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
              {icon}{count && <span>{count}</span>}
            </button>
          ))}
        </div>
      </div>
    );
  };
const handlePostVideo = () => {
  const webhookUrl = process.env.NEXT_PUBLIC_N8N_SOCIAL_POST_VIDEO_URL;
  triggerWebhook(
    webhookUrl,
    "post",
    "VIDEO PUBLISHED SUCCESSFULLY",
    {
      video_url: supabaseVideoUrl || videoUrl,
      metadata: videoMetadata,
      status: "Approved"
    },
    "POST"
  );
};

  /* ---- Portal Toast (renders directly into document.body, fully independent) ---- */
  const toastPortal = typeof window !== 'undefined' && toast
    ? createPortal(
        <div className="sd-portal-toast" style={{ pointerEvents: 'auto' }}>
          <div className="sd-portal-toast-inner">
            <div className="sd-portal-toast-icon">
              {toast.type === 'success'
                ? <CheckCircle2 size={18} strokeWidth={2.5} color="#6ee7b7" />
                : <Activity size={18} strokeWidth={2.5} color="#93c5fd" />}
            </div>
            <div className="sd-portal-toast-body">
              <span className="sd-portal-toast-label">
                {toast.type === 'success' ? 'Success' : 'Info'}
              </span>
              <span className="sd-portal-toast-msg">{toast.message}</span>
            </div>
            {toast.persistent && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setToast(null);
                }}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 16,
                  fontWeight: 700,
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginLeft: 4,
                  pointerEvents: 'auto',
                  position: 'relative',
                  zIndex: 10,
                }}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="sd-root">

      {/* ---- Portal Toast injected outside sd-root via React Portal ---- */}
      {toastPortal}


      {/* ---- Header ---- */}
      <header className="sd-header">
        <div>
          <h1 className="sd-header-title">Creator Studio</h1>
          <p className="sd-header-sub">Manage your social media content generation pipeline</p>
        </div>
        <div className="sd-badge-row">
          <Badge text="v2.0 Connected" color={medicalBlue} bg="var(--primary-light)" />
          <Badge text={status} color={status === "video created successfully" ? "var(--green)" : "var(--amber)"} bg={status === "video created successfully" ? "var(--green-light)" : "var(--amber-light)"} />
        </div>
      </header>


      {/* ---- Main Layout: 2 rows ---- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', paddingBottom: '40px' }}>

        {/* ROW 1: Video input (left) | Video preview (right) */}
        <div className="sd-grid">

          {/* LEFT: video action cards */}
          <div className="sd-left">


          {/* Video Generation Config Form */}
          <div className="sd-action-card sd-action-card-amber" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '480px', boxSizing: 'border-box' }}>
            <div className="sd-card-head" style={{ marginBottom: '14px' }}>
              <div className="sd-card-icon sd-card-icon-amber">
                <Settings size={20} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h2 className="sd-card-title">Video AI Generation Config</h2>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>Configure video story, styles and details directly</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              {/* Form Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Category */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <Tag size={12} color="#d97706" /> Category
                  </label>
                  <CustomSelect
                    value={videoFormData.category}
                    onChange={v => setVideoFormData(prev => ({ ...prev, category: v }))}
                    options={[
                      { value: "Hair Transplant", label: "Hair Transplant" },
                      { value: "Dental Implants", label: "Dental Implants" },
                      { value: "Rhinoplasty", label: "Rhinoplasty" },
                    ]}
                  />
                </div>

                {/* Video Style */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <Monitor size={12} color="#d97706" /> Video Style
                  </label>
                  <CustomSelect
                    value={videoFormData.videoStyle}
                    onChange={v => setVideoFormData(prev => ({ ...prev, videoStyle: v }))}
                    options={[
                      { value: "Highly Realistic 4k, real life", label: "Realistic 4k" },
                      { value: "Cinematic Drone - Smooth", label: "Cinematic Drone" },
                      { value: "Studio Professional - Clean", label: "Studio Clean" },
                    ]}
                  />
                </div>

                {/* Character */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <User size={12} color="#d97706" /> Character
                  </label>
                  <CustomSelect
                    value={videoFormData.character}
                    onChange={v => {
                      const newChar = v as 'male' | 'female';
                      const firstVoice = VOICE_OPTIONS[newChar][0].id;
                      setVideoFormData(prev => ({ ...prev, character: newChar, voice: firstVoice }));
                    }}
                    options={[{ value: "male", label: "👨 Male" }, { value: "female", label: "👩 Female" }]}
                  />
                </div>

                {/* Voice */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setIsVoiceModalOpen(true)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      fontSize: '13px',
                      fontWeight: 700,
                      border: 'none',
                      borderRadius: '8px',
                      background: '#d97706',
                      color: '#ffffff',
                      outline: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#b45309'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#d97706'; }}
                  >
                    <Mic2 size={14} color="#ffffff" />
                    Voices
                  </button>
                  {voiceLabel && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      background: '#fefce8',
                      border: '1px solid #fde68a',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#92400e',
                    }}>
                      <Mic2 size={11} color="#d97706" />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {voiceLabel}
                      </span>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', background: '#fef3c7', padding: '1px 5px', borderRadius: '3px', flexShrink: 0 }}>
                        Selected
                      </span>
                    </div>
                  )}
                </div>

                {/* Language */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Language
                  </label>
                  <CustomSelect
                    value={videoFormData.language}
                    onChange={v => setVideoFormData(prev => ({ ...prev, language: v }))}
                    options={["English","Spanish","French","Hebrew","Turkish"].map(l => ({ value: l, label: l }))}
                  />
                </div>

                {/* Background Song */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <Music size={12} color="#d97706" /> Background
                  </label>
                  <CustomSelect
                    value={videoFormData.backgroundSong}
                    onChange={v => setVideoFormData(prev => ({ ...prev, backgroundSong: v }))}
                    options={[
                      { value: "Inspirational - Sunrise Bloom", label: "Sunrise Bloom" },
                      { value: "Upbeat - Corporate Drive", label: "Upbeat Drive" },
                      { value: "Lo-fi - Midnight Study", label: "Lo-fi Midnight" },
                      { value: "Cinematic - Epic Journey", label: "Epic Journey" },
                      { value: "Ambient - Calm Waters", label: "Calm Waters" },
                    ]}
                  />
                </div>

                {/* Duration */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <Clock size={12} color="#d97706" /> Duration (seconds)
                  </label>
                  <input
                    type="number"
                    name="duration"
                    value={videoFormData.duration}
                    onKeyDown={(e) => {
                      // Block e, +, -, . and decimal characters
                      if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                        e.preventDefault();
                        return;
                      }
                      // Block if adding this digit would push value above 90
                      const current = String(videoFormData.duration ?? '');
                      const wouldBe = parseInt(current + e.key, 10);
                      if (!isNaN(wouldBe) && wouldBe > 90) {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) => {
                      const raw = parseInt(e.target.value, 10);
                      // Hard cap at 90 immediately
                      if (!isNaN(raw) && raw > 90) {
                        setVideoFormData(prev => ({ ...prev, duration: 90 }));
                      } else if (e.target.value === '') {
                        setVideoFormData(prev => ({ ...prev, duration: '' as any }));
                      } else if (!isNaN(raw)) {
                        setVideoFormData(prev => ({ ...prev, duration: raw }));
                      }
                    }}
                    onBlur={(e) => {
                      // Enforce minimum of 30 when user leaves field
                      const raw = parseInt(e.target.value, 10);
                      const clamped = (isNaN(raw) || raw < 30) ? 30 : Math.min(raw, 90);
                      setVideoFormData(prev => ({ ...prev, duration: clamped }));
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.background = '#f8fafc';
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#0284c7';
                      e.target.style.background = '#ffffff';
                    }}
                    min={30}
                    max={90}
                    style={{ padding: '11px 14px', fontSize: '13px', border: '1.5px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc', color: '#0f172a', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                    placeholder="30 – 90"
                  />
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>Min 30s · Max 90s</span>
                </div>

              </div>

              {/* Story Description Textarea */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  <MessageSquare size={12} color="#d97706" /> Story Description
                </label>
                <textarea 
                  name="description"
                  value={videoFormData.description}
                  onChange={(e) => setVideoFormData(prev => ({ ...prev, description: e.target.value }))}
                  onFocus={(e) => { e.target.style.borderColor = '#0284c7'; e.target.style.background = '#ffffff'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                  placeholder="Tell your patient story or describe the blog post content..."
                  style={{
                    height: '80px',
                    minHeight: '70px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    color: '#0f172a',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              {/* Submit Button */}
              <button
                className="sd-btn-primary"
                onClick={() => handleModalSubmit(videoFormData)}
                disabled={loading === 'dynamic' || !videoFormData.description.trim()}
                style={{ background: '#d97706', boxShadow: 'none', padding: '11px 16px' }}
              >
                {loading === 'dynamic'
                  ? <><Spinner size={14} color="white" /> Processing...</>
                  : <><Zap size={14} /> Generate Video AI Campaign</>}
              </button>

              {/* ---- Generation Progress (inside the input card) ---- */}
              {videoIsGenerating && (
                <div style={{ marginTop: 4, padding: '16px', borderRadius: 12, background: '#f0fdfa', border: '1.5px solid #99f6e4' }} className="animate-fade-in">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Zap size={16} color="#0d9488" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Video Generation in Progress</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>System is processing your request. Preview will update automatically.</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: '#0d9488' }}>{Math.round(videoProgress)}%</span>
                  </div>
                  <div style={{ height: 6, background: '#ccfbf1', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${videoProgress}%`, background: 'linear-gradient(90deg, #0d9488, #0284c7)', borderRadius: 6, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Generated Story Output */}

          {generatedStory && (
            <div className="sd-action-card sd-action-card-success animate-fade-in">
              <div className="sd-card-head">
                <div className="sd-card-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                  <MessageSquare size={20} />
                </div>
                <h2 className="sd-card-title">Generated Story</h2>
              </div>
              <div className="sd-card-inner" style={{ background: '#ffffff', border: '1px solid #dcfce7' }}>
                <div className="sd-generated-text">
                  {loading === 'dynamic' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b' }}>
                      <Spinner size={16} /> Generating new story...
                    </div>
                  ) : (
                    <textarea 
                      className="sd-story-textarea"
                      value={generatedStory}
                      onChange={(e) => setGeneratedStory(e.target.value)}
                      placeholder="Type or edit your story here..."
                    />
                  )}
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button 
                    className="sd-btn-secondary" 
                    style={{ width: 'auto', fontSize: 12, padding: '8px 16px', background: '#f8fafc', color: '#1e293b' }}
                    onClick={() => setShowRetryModal(true)}
                  >
                    <RefreshCw size={14} /> Retry
                  </button>
                  <button 
                    className="sd-btn-primary" 
                    style={{ width: 'auto', fontSize: 12, padding: '8px 20px', background: '#16a34a' }}
                    onClick={handleAcceptStory}
                    disabled={loading === 'accept' || videoIsGenerating}
                  >
                    {loading === 'accept'
                      ? <><Spinner size={14} color="white" /> Processing...</>
                      : <><CheckCircle2 size={14} /> Accept Story</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {generatedScenes && generatedScenes.length > 0 && !isConfirming && !videoIsGenerating && (() => {
            const failCount = Object.keys(sceneFailures).length;
            return (
            <div className="sd-action-card animate-fade-in" style={{ paddingBottom: 0, border: failCount > 0 ? '2px solid #ef4444' : undefined, boxShadow: failCount > 0 ? '0 8px 32px rgba(220,38,38,0.15)' : undefined }}>
              <div className="sd-card-head" style={{ borderBottom: failCount > 0 ? '1px solid #fecaca' : '1px solid #dcfce7', paddingBottom: 16, background: failCount > 0 ? 'linear-gradient(135deg, #dc2626, #ef4444)' : undefined, margin: failCount > 0 ? '-20px -20px 0 -20px' : undefined, padding: failCount > 0 ? '18px 20px' : undefined, borderRadius: failCount > 0 ? '14px 14px 0 0' : undefined }}>
                <div className="sd-card-icon" style={{ background: failCount > 0 ? 'rgba(255,255,255,0.2)' : '#f0fdf4', color: failCount > 0 ? '#fff' : '#16a34a' }}>
                  {failCount > 0 ? <span style={{ fontSize: 18 }}>⚠️</span> : <ImageIcon size={20} />}
                </div>
                <div style={{ flex: 1 }}>
                  <h2 className="sd-card-title" style={{ color: failCount > 0 ? '#fff' : undefined }}>
                    {failCount > 0 ? 'Policy Violation — Fix & Resubmit' : 'Generated Ad Scenes'}
                  </h2>
                  <p style={{ fontSize: 11, color: failCount > 0 ? 'rgba(255,255,255,0.8)' : '#64748b', marginTop: 2 }}>
                    {failCount > 0
                      ? `${failCount} scene${failCount > 1 ? 's' : ''} failed content policy check — edit the highlighted prompt${failCount > 1 ? 's' : ''} and click Resubmit.`
                      : 'Inspect and edit your scaled image and video scenario prompts.'}
                  </p>
                </div>
                <Badge text={failCount > 0 ? `${failCount} failed` : `${generatedScenes.length} scenes`} color={failCount > 0 ? '#fff' : '#16a34a'} bg={failCount > 0 ? 'rgba(255,255,255,0.2)' : '#f0fdf4'} />
              </div>
              <div className="sd-card-inner" style={{ padding: 0, background: '#ffffff' }}>
                <div style={{ display: "grid", gridTemplateColumns: "44px 1.1fr 1.3fr 1.3fr", padding: "10px 20px", background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>#</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.05em", paddingRight: 16 }}>📖 Voiceover Storyline</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.05em", paddingRight: 16 }}>🖼️ Image Prompt</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.05em", paddingLeft: 16 }}>🎬 Video Scenario</div>
                </div>

                <div style={{ overflowY: "auto", maxHeight: "450px" }}>
                  {generatedScenes.map((scene: any, i: number) => {
                    const failure = sceneFailures[i];
                    const isFailed = failure !== undefined;
                    const isImageFail = isFailed && failure.column === 'image';
                    const isVideoFail = isFailed && failure.column === 'video';
                    const clearFailure = () => setSceneFailures(prev => { const n = { ...prev }; delete n[i]; return n; });
                    return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 1.1fr 1.3fr 1.3fr", borderBottom: "1px solid #f1f5f9", background: isFailed ? "#fff5f5" : (i % 2 === 0 ? "#fff" : "#f8fafc"), outline: isFailed ? "2px solid #fca5a5" : undefined }}>
                      {/* Scene number */}
                      <div style={{ padding: "16px 8px", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 18 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 24, height: 24, borderRadius: "50%",
                          background: isFailed ? "#ef4444" : "#0284c7",
                          color: "#fff", fontSize: 11, fontWeight: 800,
                          boxShadow: isFailed ? "0 0 0 3px rgba(239,68,68,0.2)" : undefined
                        }}>{scene.scene}</span>
                      </div>

                      {/* Storyline / Story Sentence — editable */}
                      <div style={{ padding: "12px 12px 12px 0", borderRight: "1px solid #e2e8f0" }}>
                        <textarea
                          value={scene.story_sentence || ""}
                          onChange={(e) => {
                            setGeneratedScenes((prev: any[]) => {
                              const arr = [...prev];
                              arr[i] = { ...arr[i], story_sentence: e.target.value };
                              return arr;
                            });
                          }}
                          rows={4}
                          style={{
                            width: "100%", fontSize: 11, color: "#15803d", fontWeight: 500, lineHeight: 1.75,
                            border: "1.5px solid #dcfce7", borderRadius: 8, padding: "10px 12px",
                            resize: "vertical", fontFamily: "inherit", outline: "none",
                            background: "#f0fdf4", transition: "border 0.15s",
                          }}
                          onFocus={e => e.target.style.borderColor = "#16a34a"}
                          onBlur={e => e.target.style.borderColor = "#dcfce7"}
                          placeholder="No voiceover storyline sentence..."
                        />
                      </div>

                      {/* Image Prompt — red if image failure */}
                      <div style={{ padding: "12px 12px 12px 12px", borderRight: "1px solid #e2e8f0" }}>
                        <textarea
                          value={scene.prompt || ""}
                          onChange={(e) => {
                            setGeneratedScenes((prev: any[]) => {
                              const arr = [...prev];
                              arr[i] = { ...arr[i], prompt: e.target.value };
                              return arr;
                            });
                            if (isImageFail) clearFailure();
                          }}
                          rows={4}
                          style={{
                            width: "100%", fontSize: 11, color: isImageFail ? "#991b1b" : "#334155", lineHeight: 1.75,
                            border: isImageFail ? "2px solid #ef4444" : "1.5px solid #e2e8f0",
                            borderRadius: 8, padding: "10px 12px",
                            resize: "vertical", fontFamily: "inherit", outline: "none",
                            background: isImageFail ? "#fff1f2" : "#f8fafc", transition: "border 0.15s",
                            boxShadow: isImageFail ? "0 0 0 3px rgba(239,68,68,0.12)" : undefined,
                          }}
                          onFocus={e => e.target.style.borderColor = isImageFail ? "#dc2626" : "#0284c7"}
                          onBlur={e => e.target.style.borderColor = isImageFail ? "#ef4444" : "#e2e8f0"}
                          placeholder="No image prompt..."
                        />
                        {isImageFail && (
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 6, padding: "7px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7 }}>
                            <span style={{ fontSize: 13, flexShrink: 0 }}>🚫</span>
                            <span style={{ fontSize: 10, color: "#991b1b", lineHeight: 1.5, fontWeight: 600 }}>{failure.msg}</span>
                          </div>
                        )}
                      </div>

                      {/* Video Scenario — red if video failure */}
                      <div style={{ padding: "12px 12px" }}>
                        <textarea
                          value={scene.video_scenario || ""}
                          onChange={(e) => {
                            setGeneratedScenes((prev: any[]) => {
                              const arr = [...prev];
                              arr[i] = { ...arr[i], video_scenario: e.target.value };
                              return arr;
                            });
                            if (isVideoFail) clearFailure();
                          }}
                          rows={4}
                          style={{
                            width: "100%", fontSize: 11, lineHeight: 1.75,
                            color: isVideoFail ? "#991b1b" : "#6d28d9",
                            border: isVideoFail ? "2px solid #ef4444" : "1.5px solid #e2e8f0",
                            borderRadius: 8, padding: "10px 12px",
                            resize: "vertical", fontFamily: "inherit", outline: "none",
                            background: isVideoFail ? "#fff1f2" : "#f5f3ff", transition: "border 0.15s",
                            boxShadow: isVideoFail ? "0 0 0 3px rgba(239,68,68,0.12)" : undefined,
                          }}
                          onFocus={e => e.target.style.borderColor = isVideoFail ? "#dc2626" : "#7c3aed"}
                          onBlur={e => e.target.style.borderColor = isVideoFail ? "#ef4444" : "#e2e8f0"}
                          placeholder="No video scenario..."
                        />
                        {isVideoFail && (
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 6, padding: "7px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7 }}>
                            <span style={{ fontSize: 13, flexShrink: 0 }}>🚫</span>
                            <span style={{ fontSize: 10, color: "#991b1b", lineHeight: 1.5, fontWeight: 600 }}>{failure.msg}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* Footer bar with Confirm Prompts button */}
                <div style={{
                  padding: "14px 20px",
                  borderTop: "1.5px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "flex-end",
                  background: "#f8fafc",
                  borderBottomLeftRadius: 12,
                  borderBottomRightRadius: 12
                }}>
                  <button
                    className="sd-btn-primary"
                    style={{
                      width: "auto",
                      padding: "10px 24px",
                      background: `linear-gradient(135deg, ${medicalBlue}, ${medicalTeal})`,
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 8
                    }}
                    onClick={handleConfirmPrompts}
                    disabled={isConfirming || videoIsGenerating}
                  >
                    {isConfirming ? (
                      <><Spinner size={14} color="white" /> Confirming...</>
                    ) : failCount > 0 ? (
                      <><CheckCircle2 size={14} /> Resubmit Prompts →</>
                    ) : (
                      <><CheckCircle2 size={14} /> Confirm Prompts</>
                    )}
                  </button>
                </div>
              </div>
            </div>
            );
          })()}

          </div>

          {/* RIGHT: video preview */}
          <div className="sd-right">
            <div className="sd-preview-panel">

              {/* Panel header */}
              <div className="sd-preview-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="sd-live-dot" />
                  <span className="sd-preview-label">System Preview Output</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    className="sd-btn-refresh-small"
                    onClick={handleRefreshPreview}
                    disabled={isRefreshingVideo}
                    title="Refresh Preview"
                  >
                    <RefreshCw size={14} style={{ animation: isRefreshingVideo ? 'spin 1s linear infinite' : 'none' }} />
                  </button>
                  <span className="sd-live-tag">Live Feed</span>
                </div>
              </div>


              {/* Mobile Preview & Platform Selector */}
              {(() => {
                const getActiveVideoText = () => {
                  if (videoMetadata) {
                    const meta = videoMetadata[activeVideoPlatform];
                    if (meta) {
                      if (activeVideoPlatform === 'tiktok') return (meta as any).caption || (meta as any).content || "";
                      if (activeVideoPlatform === 'youtube') return (meta as any).description || "";
                      return (meta as any).content || (meta as any).description || (meta as any).caption || "";
                    }
                  }
                  const socialFallback = (socialDescriptions as any)[activeVideoPlatform === 'youtube' ? 'instagram' : activeVideoPlatform];
                  return socialFallback || "From Hiding My Smile to Loving It 💙 #DentalTransformation #SmileMakeover #TOGAHealth";
                };

                const getActiveVideoTitle = () => {
                  if (videoMetadata) {
                    const meta = videoMetadata[activeVideoPlatform];
                    if (meta) {
                      return (meta as any).title || "From Hiding My Smile to Loving It 💙";
                    }
                  }
                  return "From Hiding My Smile to Loving It 💙";
                };

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {/* Horizontal 6 Brand Buttons Group for Video */}
                    <div style={{
                      display: 'flex',
                      gap: '4px',
                      justifyContent: 'space-between',
                      background: '#ffffff',
                      borderRadius: '12px',
                      padding: '4px',
                      border: '1px solid #e2e8f0'
                    }}>
                      {(['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter'] as const).map((p) => {
                        const isActive = activeVideoPlatform === p;
                        const config = getVideoPlatformConfig(p);
                        return (
                          <button
                            key={p}
                            onClick={() => setActiveVideoPlatform(p)}
                            style={{
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px',
                              padding: '6px 2px',
                              borderRadius: '8px',
                              background: isActive ? config.bgActive : 'transparent',
                              border: isActive ? `1px solid ${config.borderColor}` : '1px solid transparent',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              color: isActive ? config.color : '#64748b'
                            }}
                          >
                            <span style={{ color: isActive ? config.color : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {config.icon}
                            </span>
                            <span style={{ fontSize: '8px', fontWeight: isActive ? 700 : 500, textTransform: 'capitalize' }}>{p}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Phone Simulator Frame */}
                    <div className="sd-phone-frame" style={{
                      width: '100%',
                      maxWidth: '285px',
                      margin: '0 auto',
                      background: '#f8fafc',
                      border: '8px solid #cbd5e1',
                      borderRadius: '36px',
                      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1), inset 0 0 20px rgba(0,0,0,0.02)',
                      overflow: 'hidden',
                      position: 'relative',
                      height: '530px'
                    }}>
                      {/* Simulated Notch / Dynamic Island */}
                      <div style={{
                        width: '110px',
                        height: '20px',
                        background: '#cbd5e1',
                        borderRadius: '0 0 16px 16px',
                        margin: '0 auto',
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        top: 0,
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#64748b', marginRight: '6px' }} />
                        <div style={{ width: '30px', height: '3px', borderRadius: '3px', background: '#94a3b8' }} />
                      </div>

                      {/* Simulated Mobile Device screen viewport */}
                      <div style={{
                        height: '100%',
                        overflowY: 'auto',
                        background: activeVideoPlatform === 'tiktok' ? '#000000' : '#ffffff',
                        color: activeVideoPlatform === 'tiktok' ? '#ffffff' : '#0f172a',
                        position: 'relative',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                        paddingTop: '20px' // Leave space for simulated notch
                      }} className="sd-phone-screen">
                        {isVideoPosting ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', padding: '20px', background: 'rgba(255, 255, 255, 0.96)', zIndex: 20, position: 'absolute', top: 0, left: 0, width: '100%' }}>
                            <Loader2 size={36} color="#0284c7" style={{ animation: 'spin 1.5s linear infinite' }} />
                            <div style={{ textAlign: 'center' }}>
                              <p style={{ color: '#0f172a', fontSize: '13px', fontWeight: 700, margin: 0 }}>posting content</p>
                              <p style={{ color: '#64748b', fontSize: '9px', marginTop: '4px', maxWidth: '200px', margin: '4px 0 0 0' }}>Syncing video asset and native copy to active social accounts...</p>
                            </div>
                          </div>
                        ) : supabaseVideoUrl || videoUrl ? (
                          (() => {
                            const videoSrc = supabaseVideoUrl || videoUrl;
                            const activeText = getActiveVideoText();
                            const activeTitle = getActiveVideoTitle();

                            switch (activeVideoPlatform) {
                              case 'instagram':
                                return renderInstagramVideoMock(videoSrc, activeText);
                              case 'facebook':
                                return renderFacebookVideoMock(videoSrc, activeText);
                              case 'linkedin':
                                return renderLinkedInVideoMock(videoSrc, activeText);
                              case 'tiktok':
                                return renderTikTokVideoMock(videoSrc, activeText);
                              case 'youtube':
                                return renderYouTubeVideoMock(videoSrc, activeTitle, activeText);
                              case 'twitter':
                                return renderTwitterVideoMock(videoSrc, activeText);
                              default:
                                return null;
                            }
                          })()
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', padding: '20px' }}>
                            <Loader2 size={36} color="#0284c7" style={{ animation: 'spin 1s linear infinite' }} />
                            <p style={{ color: '#475569', fontSize: '11px', fontWeight: 500, textAlign: 'center' }}>Loading preview stream...</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Edit Native Platform Copy Section */}
                    <div style={{
                      background: '#ffffff',
                      borderRadius: '16px',
                      padding: '16px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      marginTop: '8px',
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      overflowX: 'hidden'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>✍️</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Edit {activeVideoPlatform} Post Copy
                        </span>
                      </div>

                      {activeVideoPlatform === 'youtube' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>YouTube Video Title</label>
                          <input
                            type="text"
                            value={getActiveVideoTitle()}
                            onChange={(e) => {
                              const val = e.target.value;
                              setVideoMetadata((prev: any) => {
                                const currentMetadata = prev ? { ...prev } : {
                                  instagram: { content: socialDescriptions.instagram },
                                  facebook: { content: socialDescriptions.facebook },
                                  linkedin: { content: socialDescriptions.linkedin },
                                  tiktok: { caption: socialDescriptions.tiktok },
                                  youtube: { title: "From Hiding My Smile to Loving It 💙", description: socialDescriptions.instagram },
                                  twitter: { content: socialDescriptions.twitter }
                                };
                                const updatedPlatformData = { ...currentMetadata.youtube, title: val };
                                return { ...currentMetadata, youtube: updatedPlatformData };
                              });
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1.5px solid #e2e8f0',
                              fontSize: '11px',
                              color: '#0f172a',
                              outline: 'none',
                              fontFamily: 'inherit',
                              background: '#f8fafc',
                              transition: 'all 0.15s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#0284c7'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                          {activeVideoPlatform === 'tiktok' ? 'Video Caption' : activeVideoPlatform === 'youtube' ? 'Video Description' : 'Post Content'}
                        </label>
                        <textarea
                          value={getActiveVideoText()}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVideoMetadata((prev: any) => {
                              const currentMetadata = prev ? { ...prev } : {
                                instagram: { content: socialDescriptions.instagram },
                                facebook: { content: socialDescriptions.facebook },
                                linkedin: { content: socialDescriptions.linkedin },
                                tiktok: { caption: socialDescriptions.tiktok },
                                youtube: { title: "From Hiding My Smile to Loving It 💙", description: socialDescriptions.instagram },
                                twitter: { content: socialDescriptions.twitter }
                              };
                              const updatedPlatformData = { ...currentMetadata[activeVideoPlatform] };
                              if (activeVideoPlatform === 'tiktok') {
                                updatedPlatformData.caption = val;
                              } else if (activeVideoPlatform === 'youtube') {
                                updatedPlatformData.description = val;
                              } else {
                                updatedPlatformData.content = val;
                              }
                              return { ...currentMetadata, [activeVideoPlatform]: updatedPlatformData };
                            });
                          }}
                          rows={4}
                   placeholder={`Draft your perfect native ${activeVideoPlatform} copy...`}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #e2e8f0',
                            fontSize: '11px',
                            color: '#0f172a',
                            outline: 'none',
                            resize: 'none',
                            fontFamily: 'inherit',
                            background: '#f8fafc',
                            lineHeight: '1.6',
                            transition: 'all 0.15s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#0284c7'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />

                        {/* Clickable Medical Hashtag Palette — Video */}
                        <div style={{ marginTop: '10px' }}>
                          <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '6px', margin: '0 0 6px 0' }}>⚕️ Tap to Append Healthcare Hashtags</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {['#TOGAHealth', '#HairTransplantTurkey', '#DHITransplant', '#MedicalTourism', '#ConfidenceRestored'].map((tag) => (
                              <button
                                key={tag}
                                onClick={() => {
                                  const currentText = getActiveVideoText();
                                  const space = currentText.endsWith(' ') || currentText === '' ? '' : ' ';
                                  const newText = currentText + space + tag;
                                  setVideoMetadata((prev: any) => {
                                    const currentMetadata = prev ? { ...prev } : {
                                      instagram: { content: socialDescriptions.instagram },
                                      facebook: { content: socialDescriptions.facebook },
                                      linkedin: { content: socialDescriptions.linkedin },
                                      tiktok: { caption: socialDescriptions.tiktok },
                                      youtube: { title: "From Hiding My Smile to Loving It 💙", description: socialDescriptions.instagram },
                                      twitter: { content: socialDescriptions.twitter }
                                    };
                                    const updatedPlatformData = { ...currentMetadata[activeVideoPlatform] };
                                    if (activeVideoPlatform === 'tiktok') {
                                      updatedPlatformData.caption = newText;
                                    } else if (activeVideoPlatform === 'youtube') {
                                      updatedPlatformData.description = newText;
                                    } else {
                                      updatedPlatformData.content = newText;
                                    }
                                    return { ...currentMetadata, [activeVideoPlatform]: updatedPlatformData };
                                  });
                                }}
                                style={{
                                  background: '#f1f5f9',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  fontSize: '9px',
                                  fontWeight: 600,
                                  color: '#475569',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Approval bar */}
              <div className="sd-approval-bar">
                <div>
                  <p className="sd-approval-title">Final Creative Approval</p>
                  <p className="sd-approval-sub">Ready to push this content to your active social channels?</p>
                </div>
                <button
                  className="sd-btn-post"
                  onClick={handlePostVideo}
                  disabled={isVideoPosting}
                  style={{ background: `linear-gradient(135deg, ${medicalBlue}, ${medicalTeal})` }}
                >
                  {isVideoPosting
                    ? <Spinner color="white" size={16} />
                    : <><Share2 size={16} /> Post Now</>}
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* ROW 2: Social Images (left inputs, right preview) */}
        <div className="sd-grid">

          {/* LEFT: Social Image Creator */}
          <div className="sd-left">
            {/* Social Image Creator Config Form */}
             <div className="sd-action-card sd-action-card-sky" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '270px', boxSizing: 'border-box' }}>
              <div className="sd-card-head" style={{ marginBottom: '14px', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div className="sd-card-icon sd-card-icon-sky">
                    <ImageIcon size={20} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h2 className="sd-card-title">Social Image Creator</h2>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>Configure scaled prompt directly</p>
                  </div>
                </div>
                <Badge text="Auto-Scale" color={medicalBlue} bg="var(--primary-light)" />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                
                {/* Image Prompt Textarea */}
                {(() => {
                  const wordCount = imagePrompt.trim() ? imagePrompt.trim().split(/\s+/).length : 0;
                  const meetsMin = wordCount >= 10;
                  return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Image Generation Prompt
                    </label>
                    <textarea
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="e.g. Modern dental clinic interior, professional lighting, warm patient care atmosphere, highly detailed..."
                      style={{
                        height: '65px',
                        minHeight: '50px',
                        padding: '10px 12px',
                        fontSize: '12px',
                        border: `1px solid ${imagePrompt.trim() && !meetsMin ? '#f97316' : '#cbd5e1'}`,
                        borderRadius: '8px',
                        background: '#f8fafc',
                        color: '#0f172a',
                        resize: 'none',
                        fontFamily: 'inherit',
                        outline: 'none'
                      }}
                      onFocus={(e) => { e.target.style.borderColor = '#0284c7'; e.target.style.background = '#ffffff'; }}
                      onBlur={(e) => { e.target.style.borderColor = imagePrompt.trim() && !meetsMin ? '#f97316' : '#cbd5e1'; e.target.style.background = '#f8fafc'; }}
                      required
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {imagePrompt.trim() && !meetsMin && (
                        <span style={{ fontSize: '10px', color: '#f97316', fontWeight: 600 }}>Minimum 10 words required</span>
                      )}
                      <span style={{ fontSize: '10px', color: meetsMin ? '#16a34a' : '#94a3b8', fontWeight: 600, marginLeft: 'auto' }}>
                        {wordCount}/10 words
                      </span>
                    </div>
                  </div>
                  );
                })()}

                {/* Aspect Ratio Toggle Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Aspect Ratio
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['16:9', '9:16'] as const).map((ratio) => {
                      const isActive = imageRatio === ratio;
                      return (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setImageRatio(ratio)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '8px',
                            border: isActive ? `1.5px solid ${medicalBlue}` : '1.5px solid #cbd5e1',
                            background: isActive ? 'var(--primary-light)' : '#f8fafc',
                            color: isActive ? medicalBlue : '#475569',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <span style={{
                            display: 'inline-block',
                            width: ratio === '16:9' ? '12px' : '8px',
                            height: ratio === '16:9' ? '8px' : '12px',
                            border: `1.5px solid ${isActive ? medicalBlue : '#64748b'}`,
                            borderRadius: '2px',
                            background: isActive ? 'rgba(2, 132, 199, 0.1)' : 'transparent'
                          }} />
                          {ratio === '16:9' ? '16:9 Landscape' : '9:16 Portrait'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  className="sd-btn-primary"
                  onClick={() => handleImagePromptSubmit(imagePrompt)}
                  disabled={loading === 'images' || isImageGenerating || imagePrompt.trim().split(/\s+/).filter(Boolean).length < 10}
                  style={{ background: medicalBlue, boxShadow: 'none', padding: '11px 16px' }}
                >
                  {loading === 'images'
                    ? <><Spinner size={14} color="white" /> Generating...</>
                    : <><Zap size={14} /> Generate Social Images</>}
                </button>

              </div>
            </div>
          </div>

          {/* RIGHT: Social image preview */}
          <div className="sd-right">
            {!showImageWorkspace ? (
              <div className="sd-preview-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: '300px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ImageIcon size={28} color="#94a3b8" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#475569', margin: 0 }}>No Image Generated Yet</p>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Click "Generate Social Images" on the left to create platform-ready visuals.</p>
                </div>
              </div>
            ) : (
            <div className="sd-preview-panel sd-image-workspace-panel animate-fade-in" style={{ padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', color: '#0f172a', position: 'relative', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
              {/* Workspace Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7', boxShadow: '0 0 8px #0284c7' }} />
                    Social Campaign Mockup
                  </h3>
                  <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', margin: 0 }}>High-fidelity social feed preview & editor</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="sd-btn-refresh-small"
                    onClick={handleRefreshImagePreview}
                    disabled={isRefreshingImage}
                    title="Refresh Image Preview"
                  >
                    <RefreshCw size={14} style={{ animation: isRefreshingImage ? 'spin 1s linear infinite' : 'none' }} />
                  </button>
                  <span className="sd-live-tag">Live Feed</span>
                </div>
              </div>

              {isInitialLoading || isImageGenerating || isImagePosting ? (
                /* Mobile Screen - Loader State */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '520px', background: 'rgba(255, 255, 255, 0.8)', border: '2px dashed #cbd5e1', borderRadius: '24px', position: 'relative' }}>
                  {/* Glowing light pulse */}
                  <div style={{ position: 'absolute', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(2, 132, 199, 0.1)', filter: 'blur(40px)', animation: 'pulse 2s infinite' }} />
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 1 }}>
                    <div style={{ position: 'relative' }}>
                      <Loader2 size={42} color="#0284c7" style={{ animation: 'spin 1.5s linear infinite' }} />
                      <ImageIcon size={18} color="#0284c7" style={{ position: 'absolute', top: '12px', left: '12px' }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ color: '#0f172a', fontSize: '14px', fontWeight: 600, margin: 0 }}>
                        {isInitialLoading 
                          ? "Loading Platform Preview..." 
                          : isImagePosting 
                            ? "Posting Content on Social Media..." 
                            : "Drafting Platform Creatives..."}
                      </p>
                      <p style={{ color: '#64748b', fontSize: '11px', marginTop: '6px', maxWidth: '240px', margin: '6px 0 0 0' }}>
                        {isInitialLoading
                          ? "Connecting to Supabase and retrieving the latest campaign details..."
                          : isImagePosting
                            ? "Broadcasting your approved campaign images and copywriting to your active channels..."
                            : "Generating scaled images & tailoring custom copywriting for social distribution"}
                      </p>
                      {generationType === 'images' && (
                        <div style={{ width: '200px', margin: '14px auto 0 auto', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 800, color: '#0284c7', letterSpacing: '0.05em' }}>
                            <span>PROGRESS</span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <div style={{ height: '6px', width: '100%', background: '#cbd5e1', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress}%`, background: '#0284c7', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Interactive Social Campaign Workspace (Mobile View + Editor) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Phone Simulator Frame */}
                  <div className="sd-phone-frame" style={{
                    width: '100%',
                    maxWidth: '285px',
                    margin: '0 auto',
                    background: '#f8fafc',
                    border: '8px solid #cbd5e1',
                    borderRadius: '36px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1), inset 0 0 20px rgba(0,0,0,0.02)',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    
                    {/* Simulated Notch / Dynamic Island */}
                    <div style={{
                      width: '110px',
                      height: '20px',
                      background: '#cbd5e1',
                      borderRadius: '0 0 16px 16px',
                      margin: '0 auto',
                      position: 'absolute',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      top: 0,
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#64748b', marginRight: '6px' }} />
                      <div style={{ width: '30px', height: '3px', borderRadius: '3px', background: '#94a3b8' }} />
                    </div>

                    {/* Horizontal 4 Brand Buttons Group inside Phone Simulator */}
                    <div style={{
                      display: 'flex',
                      background: 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(8px)',
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                      padding: '24px 8px 8px 8px', // padding top 24px to clear notch
                      gap: '4px',
                      justifyContent: 'space-between',
                      zIndex: 5,
                      position: 'relative'
                    }}>
                      {(['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter'] as const).map((p) => {
                        const isActive = activePlatform === p;
                        const config = getPlatformConfig(p);
                        return (
                          <button
                            key={p}
                            onClick={() => setActivePlatform(p)}
                            style={{
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              padding: '6px 2px',
                              borderRadius: '10px',
                              background: isActive ? config.bgActive : 'transparent',
                              border: isActive ? `1px solid ${config.borderColor}` : '1px solid transparent',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              color: isActive ? config.color : '#64748b'
                            }}
                          >
                            <span style={{ color: isActive ? config.color : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {config.icon}
                            </span>
                            <span style={{ fontSize: '8px', fontWeight: isActive ? 700 : 500, textTransform: 'capitalize' }}>{p}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Simulated Mobile Device screen viewport */}
                    <div style={{
                      height: '456px',
                      overflowY: 'auto',
                      background: activePlatform === 'tiktok' ? '#000000' : '#ffffff',
                      color: activePlatform === 'tiktok' ? '#ffffff' : '#0f172a',
                      position: 'relative',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                    }} className="sd-phone-screen">
                      
                      {activePlatform === 'instagram' && renderInstagramMock()}
                      {activePlatform === 'facebook' && renderFacebookMock()}
                      {activePlatform === 'linkedin' && renderLinkedInMock()}
                      {activePlatform === 'tiktok' && renderTikTokMock()}
                      {activePlatform === 'twitter' && renderTwitterMock()}

                    </div>
                  </div>

                  {/* Real-time Caption Editor Workspace Card */}
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '14px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    textAlign: 'left'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: getPlatformConfig(activePlatform).color, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {getPlatformConfig(activePlatform).icon}
                        </span>
                        Edit {activePlatform} Post
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: socialDescriptions[activePlatform].length > getPlatformConfig(activePlatform).charLimit ? '#ef4444' : '#64748b'
                      }}>
                        {socialDescriptions[activePlatform].length.toLocaleString()} / {getPlatformConfig(activePlatform).charLimit.toLocaleString()} chars
                      </span>
                    </div>

                    <textarea
                      value={socialDescriptions[activePlatform]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSocialDescriptions(prev => ({
                          ...prev,
                          [activePlatform]: val
                        }));
                      }}
                      rows={4}
                      style={{
                        width: '100%',
                        background: '#f8fafc',
                        border: `1.5px solid #e2e8f0`,
                        borderRadius: '12px',
                        padding: '12px',
                        fontSize: '12px',
                        color: '#0f172a',
                        fontFamily: 'inherit',
                        outline: 'none',
                        resize: 'none',
                        transition: 'all 0.2s',
                        lineHeight: '1.6'
                      }}
                      onFocus={(e) => { e.target.style.borderColor = getPlatformConfig(activePlatform).color; e.target.style.boxShadow = `0 0 10px ${getPlatformConfig(activePlatform).color}22`; e.target.style.background = '#ffffff'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f8fafc'; }}
                      placeholder={`Draft your perfect ${activePlatform} post here...`}
                    />

                    {/* Clickable Medical Hashtag Palette */}
                    <div style={{ marginTop: '12px' }}>
                      <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '6px', margin: '0 0 6px 0' }}>⚕️ Tap to Append Healthcare Hashtags</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {['#TOGAHealth', '#HairTransplantTurkey', '#DHITransplant', '#MedicalTourism', '#ConfidenceRestored'].map((tag) => (
                          <button
                            key={tag}
                            onClick={() => {
                              const currentText = socialDescriptions[activePlatform];
                              const space = currentText.endsWith(' ') || currentText === '' ? '' : ' ';
                              setSocialDescriptions(prev => ({
                                ...prev,
                                [activePlatform]: currentText + space + tag
                              }));
                            }}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '9px',
                              fontWeight: 600,
                              color: '#475569',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Approve & Publish Bar */}
                  <div style={{
                    padding: '14px 16px',
                    borderTop: '1px solid #e2e8f0',
                    background: '#ffffff',
                    borderRadius: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Creative Approved</p>
                      <p style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', margin: '2px 0 0 0' }}>Verify scaling & descriptions before pushing live</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => setShowSocialRetryModal(true)}
                        disabled={isImagePosting}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '10px 20px',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#475569',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <RefreshCw size={13} /> Retry
                      </button>
                      <button
                        onClick={handleSocialPost}
                        disabled={isImagePosting}
                        style={{
                          background: `linear-gradient(135deg, ${medicalBlue}, ${medicalTeal})`,
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 20px',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
                        }}
                      >
                        {isImagePosting ? <Spinner size={12} color="white" /> : <Share2 size={13} />}
                        Post
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </div>
            )}
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

      <ImagePromptModal 
        isOpen={showImageModal}
        onOpenChange={setShowImageModal}
        onSubmit={handleImagePromptSubmit}
        loading={loading === 'images'}
      />

      <RetryModal 
        isOpen={showSocialRetryModal}
        onOpenChange={setShowSocialRetryModal}
        onSubmit={handleSocialRetrySubmit}
        loading={loading === 'post_social'}
      />

      <VoiceExplorerModal 
        isOpen={isVoiceModalOpen}
        onOpenChange={setIsVoiceModalOpen}
        selectedVoiceId={videoFormData.voice}
        onSelectVoice={(id, label) => {
          setVideoFormData(prev => ({ ...prev, voice: id }));
          setVoiceLabel(label);
          setIsVoiceModalOpen(false);
        }}
      />

    </div>
  );
}