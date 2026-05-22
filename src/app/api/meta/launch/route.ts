import type { NextRequest } from 'next/server';

interface MetaApiError {
  error?: {
    message?: string;
    error_subcode?: string | number;
  };
}

type MetaApiJson = MetaApiError & Record<string, unknown>;

interface VideoMediaPayload {
  video_id: string;
}

interface ImageMediaPayload {
  image_hash: string;
}

type MediaPayload = VideoMediaPayload | ImageMediaPayload;

interface GeoEntry {
  key: string | number;
}

interface RawGeoLocations {
  countries?: string[];
  cities?: GeoEntry[];
  regions?: GeoEntry[];
  zips?: GeoEntry[];
  location_types?: string[];
}

interface CleanGeoLocations {
  location_types: string[];
  countries?: string[];
  cities?: Array<{ key: string; radius: number; distance_unit: string }>;
  regions?: Array<{ key: string }>;
  zips?: Array<{ key: string }>;
}

interface AdSetPayload {
  name?: string;
  budget_type?: string;
  daily_budget?: number;
  lifetime_budget?: number;
  start_time?: string | null;
  has_end_date?: boolean;
  stop_time?: string | null;
  age_min?: number;
  age_max?: number;
  gender?: number;
  dsa_beneficiary?: string;
  dsa_payor?: string;
  geo_locations?: RawGeoLocations;
  geo_targeting?: string[];
}

interface AdPayload {
  name?: string;
  media_type?: string;
  type?: string;
  headline?: string;
  primary_text?: string;
  website_url?: string;
  call_to_action_type?: string;
}

interface CampaignPayload {
  name?: string;
  objective?: string;
  special_ad_categories?: string[];
  is_adset_budget_sharing_enabled?: boolean;
}

interface LaunchSchema {
  campaign?: CampaignPayload;
  ad_set?: AdSetPayload;
  ad?: AdPayload;
  link_data?: string;
}

interface LaunchRequestBody {
  schema?: LaunchSchema;
  campaignId?: string;
}

// ── Helper to parse JSON with fallback ──
async function fetchMetaJson(res: Response): Promise<MetaApiJson> {
  const text = await res.text();
  let parsed: MetaApiJson;
  try {
    parsed = JSON.parse(text) as MetaApiJson;
  } catch {
    throw new Error(
      `Meta API returned non-JSON. Status: ${res.status}. Body: ${text.slice(0, 200)}...`
    );
  }
  if (!res.ok) {
    const msg = parsed.error?.message || 'Unknown Meta API error';
    const subcode = parsed.error?.error_subcode
      ? ` (Subcode: ${parsed.error.error_subcode})`
      : '';
    throw new Error(`Meta API Error: ${msg}${subcode}`);
  }
  return parsed;
}

// ── STEP 1: Upload media to Meta ──
async function uploadMedia(
  link_data: string,
  isVideo: boolean,
  accessToken: string,
  adAccountId: string
): Promise<MediaPayload> {
  if (!link_data.startsWith('http://') && !link_data.startsWith('https://')) {
    throw new Error(`Invalid media URL: ${link_data}. Must be absolute HTTP/HTTPS URL.`);
  }

  if (isVideo) {
    const uploadForm = new FormData();
    uploadForm.append('file_url', link_data);
    uploadForm.append('access_token', accessToken);

    const uploadRes = await fetch(
      `https://graph.facebook.com/v21.0/act_${adAccountId}/advideos`,
      { method: 'POST', body: uploadForm }
    );
    const uploadData = await fetchMetaJson(uploadRes);
    const videoId = uploadData.id as string | undefined;

    if (!videoId) throw new Error('Failed to upload video to Meta: No ID returned.');

    // Poll until video is ready
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const statusRes = await fetch(
          `https://graph.facebook.com/v21.0/${videoId}?fields=status&access_token=${accessToken}`
        );
        const statusData = await fetchMetaJson(statusRes);
        const videoStatus = (statusData.status as { video_status?: string } | undefined)
          ?.video_status;
        if (videoStatus === 'ready') {
          break;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log('Polling video status error:', message);
      }
    }

    return { video_id: videoId };
  } else {
    // Image upload
    const mediaRes = await fetch(link_data);
    if (!mediaRes.ok) throw new Error(`Failed to fetch image from URL: ${link_data}`);
    const imgBuffer = await mediaRes.arrayBuffer();
    const imgBlob = new Blob([imgBuffer]);

    const uploadForm = new FormData();
    uploadForm.append('source', imgBlob, 'ad_image.jpg');
    uploadForm.append('access_token', accessToken);

    const uploadRes = await fetch(
      `https://graph.facebook.com/v21.0/act_${adAccountId}/adimages`,
      { method: 'POST', body: uploadForm }
    );
    const uploadData = await fetchMetaJson(uploadRes);
    const images = uploadData.images as Record<string, { hash?: string }> | undefined;
    const imageHash = images?.['ad_image.jpg']?.hash;

    if (!imageHash) {
      throw new Error('Failed to upload image to Meta: No hash returned.');
    }

    return { image_hash: imageHash };
  }
}

// ── STEP 1b: Fetch Page ID ──
async function fetchPageId(accessToken: string): Promise<string> {
  let pageId = process.env.META_PAGE_ID;
  if (!pageId || pageId === 'me' || pageId === 'YOUR_TOGAHH_PAGE_ID_HERE') {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await fetchMetaJson(pagesRes);
    const pages = pagesData.data as Array<{ id?: string }> | undefined;
    if (!pages || pages.length === 0) {
      throw new Error(
        'No Facebook Pages found associated with this Meta Access Token. A Page is strictly required by Meta to create Ad Creatives. Please create a Page in your Facebook Business account.'
      );
    }
    pageId = pages[0].id;
  }
  if (!pageId) throw new Error('Unable to resolve a Facebook Page ID.');
  return pageId;
}

// ── STEP 2: Campaign ──
async function createCampaign(
  existingCampaignId: string | undefined,
  adAccountId: string,
  accessToken: string,
  campaignName: string,
  objective: string,
  specialAdCats: string[],
  isCbo: boolean,
  budgetType: string,
  dailyBudget: number,
  lifetimeBudget: number
): Promise<string> {
  if (existingCampaignId) return existingCampaignId;

  const campaignRes = await fetch(
    `https://graph.facebook.com/v21.0/act_${adAccountId}/campaigns`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campaignName,
        objective,
        status: 'PAUSED',
        special_ad_categories: specialAdCats,
        is_adset_budget_sharing_enabled: isCbo,
        ...(isCbo
          ? budgetType === 'DAILY'
            ? { daily_budget: dailyBudget }
            : { lifetime_budget: lifetimeBudget }
          : {}),
        access_token: accessToken,
      }),
    }
  );
  const campaignData = await fetchMetaJson(campaignRes);
  const id = campaignData.id as string | undefined;
  if (!id) throw new Error('Failed to create campaign: No ID returned.');
  return id;
}

// ── STEP 3: Ad Set ──
async function createAdSet(
  adAccountId: string,
  accessToken: string,
  adSetName: string,
  campaignId: string,
  isCbo: boolean,
  budgetType: string,
  dailyBudget: number,
  lifetimeBudget: number,
  startTime: string | null,
  stopTime: string | null,
  targeting: unknown,
  dsaBeneficiary: string,
  dsaPayor: string
): Promise<string> {
  const adSetRes = await fetch(
    `https://graph.facebook.com/v21.0/act_${adAccountId}/adsets`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: adSetName,
        campaign_id: campaignId,
        ...(!isCbo
          ? budgetType === 'DAILY'
            ? { daily_budget: dailyBudget }
            : { lifetime_budget: lifetimeBudget }
          : {}),
        start_time: startTime,
        ...(stopTime ? { stop_time: stopTime } : {}),
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting,
        dsa_beneficiary: dsaBeneficiary,
        dsa_payor: dsaPayor,
        status: 'PAUSED',
        access_token: accessToken,
      }),
    }
  );
  const adSetData = await fetchMetaJson(adSetRes);
  const id = adSetData.id as string | undefined;
  if (!id) throw new Error('Failed to create ad set: No ID returned.');
  return id;
}

// ── STEP 4: Ad Creative ──
async function createAdCreative(
  adAccountId: string,
  accessToken: string,
  isVideo: boolean,
  pageId: string,
  mediaPayload: MediaPayload,
  headline: string,
  primaryText: string,
  websiteUrl: string,
  ctaType: string,
  adName: string
): Promise<string> {
  let objectStorySpec: Record<string, unknown>;
  if (isVideo) {
    objectStorySpec = {
      page_id: pageId,
      video_data: {
        video_id: (mediaPayload as VideoMediaPayload).video_id,
        image_url:
          'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=1080&q=80',
        title: headline,
        message: primaryText,
        link_description: headline,
        call_to_action: {
          type: ctaType,
          value: { link: websiteUrl },
        },
      },
    };
  } else {
    objectStorySpec = {
      page_id: pageId,
      link_data: {
        image_hash: (mediaPayload as ImageMediaPayload).image_hash,
        link: websiteUrl,
        message: primaryText,
        name: headline,
        call_to_action: {
          type: ctaType,
          value: { link: websiteUrl },
        },
      },
    };
  }

  const creativeRes = await fetch(
    `https://graph.facebook.com/v21.0/act_${adAccountId}/adcreatives`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Creative_${adName}`,
        object_story_spec: objectStorySpec,
        access_token: accessToken,
      }),
    }
  );
  const creativeData = await fetchMetaJson(creativeRes);
  const id = creativeData.id as string | undefined;
  if (!id) throw new Error('Failed to create ad creative: No ID returned.');
  return id;
}

// ── STEP 5: Ad ──
async function createAd(
  adAccountId: string,
  accessToken: string,
  adName: string,
  adSetId: string,
  creativeId: string
): Promise<string> {
  const adRes = await fetch(
    `https://graph.facebook.com/v21.0/act_${adAccountId}/ads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: adName,
        adset_id: adSetId,
        creative: { creative_id: creativeId },
        status: 'PAUSED',
        access_token: accessToken,
      }),
    }
  );
  const adFinalData = await fetchMetaJson(adRes);
  const id = adFinalData.id as string | undefined;
  if (!id) throw new Error('Failed to create ad: No ID returned.');
  return id;
}

export async function POST(request: NextRequest) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    return Response.json({ error: 'Missing Meta credentials' }, { status: 500 });
  }

  try {
    const { schema, campaignId: existingCampaignId } =
      (await request.json()) as LaunchRequestBody;

    if (!schema) {
      return Response.json({ error: 'Missing schema payload' }, { status: 400 });
    }

    const { campaign, ad_set, ad, link_data } = schema;

    if (!link_data) {
      return Response.json({ error: 'Missing link_data (media URL)' }, { status: 400 });
    }

    const isVideo =
      (ad?.media_type || '').toLowerCase() === 'video' ||
      (ad?.type || '').toLowerCase() === 'video';

    // ── Resolve config values ──
    const objective       = campaign?.objective                       || 'OUTCOME_TRAFFIC';
    const campaignName    = campaign?.name                            || `[DRAFT] ${objective}_${Date.now()}`;
    const specialAdCats   = campaign?.special_ad_categories           || ['NONE'];
    const isCbo           = campaign?.is_adset_budget_sharing_enabled || false;

    // Budget & Schedule
    const budgetType      = ad_set?.budget_type                       || 'DAILY';
    const dailyBudget     = ad_set?.daily_budget                      || 5000;
    const lifetimeBudget  = ad_set?.lifetime_budget                   || 50000;
    const startTime       = ad_set?.start_time                        || null;
    const stopTime        = ad_set?.has_end_date ? ad_set?.stop_time || null : null;

    const adSetName       = ad_set?.name                              || 'Ad Set';
    const ageMin          = ad_set?.age_min                           || 18;
    const ageMax          = ad_set?.age_max                           || 65;
    const gender          = ad_set?.gender                            ?? 0; // 0=all,1=male,2=female
    const dsaBeneficiary  = ad_set?.dsa_beneficiary                   || 'Advertiser';
    const dsaPayor        = ad_set?.dsa_payor                         || 'Advertiser';
    const adName          = ad?.name                                  || 'Ad';
    const headline        = ad?.headline                              || '';
    const primaryText     = ad?.primary_text                          || '';
    const websiteUrl      = ad?.website_url                           || 'https://togahh.com';
    const ctaType         = ad?.call_to_action_type                   || 'LEARN_MORE';

    // Clean geo_locations for Meta API
    const rawGeo: RawGeoLocations = ad_set?.geo_locations || {
      countries: ad_set?.geo_targeting || ['US'],
      location_types: ['home', 'recent'],
    };

    const cleanGeo: CleanGeoLocations = {
      location_types: rawGeo.location_types || ['home', 'recent'],
    };
    let hasLocation = false;

    if (rawGeo.countries && rawGeo.countries.length > 0) {
      cleanGeo.countries = rawGeo.countries;
      hasLocation = true;
    }
    if (rawGeo.cities && rawGeo.cities.length > 0) {
      cleanGeo.cities = rawGeo.cities.map((c) => ({
        key: String(c.key),
        radius: 25,
        distance_unit: 'mile',
      }));
      hasLocation = true;
    }
    if (rawGeo.regions && rawGeo.regions.length > 0) {
      cleanGeo.regions = rawGeo.regions.map((c) => ({ key: String(c.key) }));
      hasLocation = true;
    }
    if (rawGeo.zips && rawGeo.zips.length > 0) {
      cleanGeo.zips = rawGeo.zips.map((c) => ({ key: String(c.key) }));
      hasLocation = true;
    }

    // Meta API requires at least one valid location targeting
    if (!hasLocation) {
      cleanGeo.countries = ['US'];
    }

    const targeting = {
      geo_locations: cleanGeo,
      age_min: ageMin,
      age_max: ageMax,
      ...(gender !== 0 ? { genders: [gender] } : {}),
      targeting_automation: {
        advantage_audience: 0,
      },
    };

    // ── Execute Concurrent Tasks: Media Upload & Page ID Fetch ──
    const [mediaPayload, pageId] = await Promise.all([
      uploadMedia(link_data, isVideo, accessToken, adAccountId),
      fetchPageId(accessToken),
    ]);

    // ── Sequential Tasks: Campaign -> Ad Set -> Creative -> Ad ──
    const campaignId = await createCampaign(
      existingCampaignId,
      adAccountId,
      accessToken,
      campaignName,
      objective,
      specialAdCats,
      isCbo,
      budgetType,
      dailyBudget,
      lifetimeBudget
    );

    const adSetId = await createAdSet(
      adAccountId,
      accessToken,
      adSetName,
      campaignId,
      isCbo,
      budgetType,
      dailyBudget,
      lifetimeBudget,
      startTime,
      stopTime,
      targeting,
      dsaBeneficiary,
      dsaPayor
    );

    const creativeId = await createAdCreative(
      adAccountId,
      accessToken,
      isVideo,
      pageId,
      mediaPayload,
      headline,
      primaryText,
      websiteUrl,
      ctaType,
      adName
    );

    const adId = await createAd(adAccountId, accessToken, adName, adSetId, creativeId);

    return Response.json({
      success: true,
      campaignId,
      adSetId,
      adId,
    });
  } catch (error) {
    console.error('Launch Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
