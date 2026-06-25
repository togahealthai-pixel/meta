export const maxDuration = 60; // Allow Vercel to run up to 60s for video polling

// ── Helper to parse JSON with fallback ──
async function fetchMetaJson(res) {
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Meta API returned non-JSON. Status: ${res.status}. Body: ${text.slice(0, 200)}...`);
  }
  if (!res.ok) {
    const subcode = parsed.error?.error_subcode;
    const FRIENDLY: Record<number, string> = {
      4834002: "Budget conflict: You cannot use Campaign Budget Optimization (CBO) and Ad Set budget sharing at the same time. Go to Campaign Setup → disable one of them.",
      1487390: "Your ad account has a spend limit reached. Go to Meta Ads Manager → Billing → raise or remove your account spend limit.",
      1885252: "The video is still processing on Meta's servers. Wait a minute and try launching again.",
      1487297: "Your Meta ad account has been disabled. Check Meta Ads Manager → Account Quality for details.",
      2446164: "Ad creative was rejected by Meta's policy review. Edit the ad text or image and try again.",
      1487851: "Invalid targeting: the selected location or audience is too small. Broaden your targeting and try again.",
      100:     "Invalid parameter sent to Meta. Check your Campaign Setup fields (objective, budget, targeting) and try again.",
    };
    const friendly = subcode && FRIENDLY[subcode];
    if (friendly) throw new Error(friendly);
    // Use Meta's own user-facing title/message when available — they're in the user's language but describe the real issue
    const userTitle = parsed.error?.error_user_title;
    const userMsg   = parsed.error?.error_user_msg;
    const metaMsg   = userTitle ? `${userTitle}: ${userMsg || ""}` : (parsed.error?.message || "Unknown Meta API error");
    throw new Error(`Meta: ${metaMsg} (code ${parsed.error?.code || "?"}${subcode ? `, subcode ${subcode}` : ""})`);
  }
  return parsed;
}

// ── STEP 1: Upload media to Meta ──
async function uploadMedia(link_data, isVideo, accessToken, adAccountId) {
  if (!link_data.startsWith("http://") && !link_data.startsWith("https://")) {
    throw new Error(`Invalid media URL: ${link_data}. Must be absolute HTTP/HTTPS URL.`);
  }

  if (isVideo) {
    const uploadForm = new FormData();
    uploadForm.append("file_url", link_data);
    uploadForm.append("access_token", accessToken);

    const uploadRes = await fetch(
      `https://graph.facebook.com/v21.0/act_${adAccountId}/advideos`,
      { method: "POST", body: uploadForm }
    );
    const uploadData = await fetchMetaJson(uploadRes);
    const videoId = uploadData.id;

    if (!videoId) throw new Error("Failed to upload video to Meta: No ID returned.");

    // Poll until video is ready
    let isReady = false;
    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const statusRes = await fetch(
          `https://graph.facebook.com/v21.0/${videoId}?fields=status&access_token=${accessToken}`
        );
        const statusData = await fetchMetaJson(statusRes);
        if (statusData.status?.video_status === "ready") {
          isReady = true;
          break;
        }
      } catch (err) {
        console.log("Polling video status error:", err.message);
      }
    }

    if (!isReady) {
      console.warn(`Video ${videoId} is still processing after 45 seconds. Attempting to proceed, but it may fail with 1885252.`);
    }

    // Get auto-generated thumbnail from Meta, download it, re-upload as adimage to get a stable hash
    let imageHash: string | null = null;
    try {
      // Step A: get the video's generated picture URL
      const picRes = await fetch(
        `https://graph.facebook.com/v21.0/${videoId}?fields=picture&access_token=${accessToken}`
      );
      const picData = await picRes.json();
      const pictureUrl = picData.picture;

      if (pictureUrl) {
        // Step B: download that frame image
        const imgRes = await fetch(pictureUrl);
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer();
          const imgBlob = new Blob([imgBuffer], { type: "image/jpeg" });

          // Step C: upload as adimage to get a proper image_hash
          const thumbForm = new FormData();
          thumbForm.append("source", imgBlob, "video_thumb.jpg");
          thumbForm.append("access_token", accessToken);

          const uploadRes = await fetch(
            `https://graph.facebook.com/v21.0/act_${adAccountId}/adimages`,
            { method: "POST", body: thumbForm }
          );
          const uploadData = await uploadRes.json();
          imageHash = uploadData.images?.["video_thumb.jpg"]?.hash || null;
        }
      }
    } catch (err) {
      console.log("Could not generate video thumbnail hash:", err);
    }

    if (!imageHash) {
      throw new Error("Could not generate a thumbnail for the video. Please wait a moment for the video to finish processing on Meta and try again.");
    }

    return { video_id: videoId, image_hash: imageHash };
  } else {
    // Image upload
    const mediaRes = await fetch(link_data);
    if (!mediaRes.ok) throw new Error(`Failed to fetch image from URL: ${link_data}`);
    const imgBuffer = await mediaRes.arrayBuffer();
    const imgBlob = new Blob([imgBuffer]);

    const uploadForm = new FormData();
    uploadForm.append("source", imgBlob, "ad_image.jpg");
    uploadForm.append("access_token", accessToken);

    const uploadRes = await fetch(
      `https://graph.facebook.com/v21.0/act_${adAccountId}/adimages`,
      { method: "POST", body: uploadForm }
    );
    const uploadData = await fetchMetaJson(uploadRes);
    const imageHash = uploadData.images?.["ad_image.jpg"]?.hash;

    if (!imageHash) {
      throw new Error("Failed to upload image to Meta: No hash returned.");
    }

    return { image_hash: imageHash };
  }
}

// ── STEP 1b: Fetch Page ID ──
async function fetchPageId(accessToken) {
  let pageId = process.env.META_PAGE_ID;
  if (!pageId || pageId === "me" || pageId === "YOUR_TOGAHH_PAGE_ID_HERE") {
    const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`);
    const pagesData = await fetchMetaJson(pagesRes);
    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error("No Facebook Pages found associated with this Meta Access Token. A Page is strictly required by Meta to create Ad Creatives. Please create a Page in your Facebook Business account.");
    }
    pageId = pagesData.data[0].id;
  }
  return pageId;
}

// ── STEP 1c: Fetch Campaign info (objective + CBO detection) ──
async function fetchCampaignInfo(campaignId, accessToken) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${campaignId}?fields=objective,daily_budget,lifetime_budget&access_token=${accessToken}`
  );
  const data = await fetchMetaJson(res);
  // Campaign has CBO if it already carries a budget
  const hasCampaignBudget = !!(parseInt(data.daily_budget || "0", 10) || parseInt(data.lifetime_budget || "0", 10));
  return { objective: data.objective, isCbo: hasCampaignBudget };
}

// ── STEP 1d: Get or Create Pixel ID (Self-healing discover / create fallback) ──
async function getOrCreatePixelId(accessToken, adAccountId) {
  const url = `https://graph.facebook.com/v21.0/act_${adAccountId}/adspixels?access_token=${accessToken}`;
  const res = await fetch(url);
  const data = await fetchMetaJson(res);

  if (data.data && data.data.length > 0) {
    return data.data[0].id;
  }

  console.log("No pixels found. Attempting programmatic creation of Toga Health AI Pixel...");
  try {
    const createRes = await fetch(
      `https://graph.facebook.com/v21.0/act_${adAccountId}/adspixels`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Toga Health AI Pixel",
          access_token: accessToken,
        }),
      }
    );
    const createData = await fetchMetaJson(createRes);
    if (createData.id) {
      console.log(`Successfully created pixel: ${createData.id}`);
      return createData.id;
    }
  } catch (err: any) {
    console.error("Failed programmatic pixel creation:", err.message);
    throw new Error(
      `Tracking Pixel Required: The campaign objective or optimization goal requires a tracking pixel. ` +
      `No pixels were found on Ad Account ${adAccountId}, and programmatic creation failed. ` +
      `To fix this: (1) Go to Meta Events Manager, create a Pixel/Dataset, assign it to Ad Account ${adAccountId}, and retry. ` +
      `Or (2) Change the Campaign Objective in the UI to 'Traffic' (OUTCOME_TRAFFIC), which does not require a pixel.`
    );
  }

  throw new Error("Unable to locate or create a Meta Tracking Pixel.");
}

// ── SMART LAUNCH: Pause existing ads at ad level so only the new ad goes live ──
async function pauseExistingAdsInCampaign(campaignId: string, excludeAdId: string, accessToken: string, adAccountId: string): Promise<number> {
  const filter = encodeURIComponent(JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: campaignId }]));
  const res = await fetch(
    `https://graph.facebook.com/v21.0/act_${adAccountId}/ads?fields=id,name,status&filtering=${filter}&limit=200&access_token=${accessToken}`
  );
  const data = await fetchMetaJson(res);
  const ads: { id: string; name: string; status: string }[] = (data.data || []).filter(
    (ad: { id: string; status: string }) => ad.id !== excludeAdId && ad.status !== "PAUSED"
  );
  if (ads.length === 0) return 0;
  await Promise.all(
    ads.map((ad) =>
      fetch(`https://graph.facebook.com/v21.0/${ad.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAUSED", access_token: accessToken }),
      })
    )
  );
  console.log(`Smart launch: paused ${ads.length} existing ads → ${ads.map((a) => a.name).join(", ")}`);
  return ads.length;
}

async function resumeCampaignToActive(campaignId: string, accessToken: string): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${campaignId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "ACTIVE", access_token: accessToken }),
  });
  await fetchMetaJson(res);
  console.log(`Smart launch: campaign ${campaignId} resumed to ACTIVE`);
}

// ── STEP 2: Campaign ──
async function createCampaign(existingCampaignId, adAccountId, accessToken, campaignName, objective, specialAdCats, isCbo, budgetType, dailyBudget, lifetimeBudget, adStatus = "PAUSED") {
  if (existingCampaignId) return existingCampaignId;

  const campaignRes = await fetch(
    `https://graph.facebook.com/v21.0/act_${adAccountId}/campaigns`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: campaignName,
        objective,
        status: adStatus,
        special_ad_categories: specialAdCats,
        // CBO (Advantage+ Budget ON): budget at campaign level — Meta enables CBO automatically, no flag needed
        // Non-CBO (Advantage+ Budget OFF): explicit flag=false required by Meta, budget goes on ad set instead
        ...(isCbo
          ? (budgetType === "DAILY" ? { daily_budget: dailyBudget } : { lifetime_budget: lifetimeBudget })
          : { is_adset_budget_sharing_enabled: false }
        ),
        access_token: accessToken,
      }),
    }
  );
  const campaignData = await fetchMetaJson(campaignRes);
  if (!campaignData.id) throw new Error("Failed to create campaign: No ID returned.");
  return campaignData.id;
}

// ── STEP 3: Ad Set ──
async function createAdSet(adAccountId, accessToken, adSetName, campaignId, isCbo, budgetType, dailyBudget, lifetimeBudget, startTime, stopTime, targeting, dsaFields, optimizationGoal, promotedObject, adStatus = "PAUSED", destinationType = null) {
  const bodyPayload: any = {
    name: adSetName,
    campaign_id: campaignId,
    ...(!isCbo ? (budgetType === "DAILY" ? { daily_budget: dailyBudget } : { lifetime_budget: lifetimeBudget }) : {}),
    start_time: startTime,
    ...(stopTime ? { end_time: stopTime } : {}),
    billing_event: "IMPRESSIONS",
    optimization_goal: optimizationGoal,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting,
    ...dsaFields,
    ...(destinationType ? { destination_type: destinationType } : {}),
    status: adStatus,
    access_token: accessToken,
  };

  if (promotedObject) {
    bodyPayload.promoted_object = promotedObject;
  }

  const adSetRes = await fetch(
    `https://graph.facebook.com/v21.0/act_${adAccountId}/adsets`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
    }
  );
  const adSetData = await fetchMetaJson(adSetRes);
  if (!adSetData.id) throw new Error("Failed to create ad set: No ID returned.");
  return adSetData.id;
}

// ── STEP 4: Ad Creative ──
async function createAdCreative(adAccountId, accessToken, isVideo, pageId, mediaPayload, headline, primaryText, websiteUrl, ctaType, adName, leadGenFormId = null) {
  // When a lead gen form is selected, CTA value uses form ID instead of a URL
  const ctaValue = leadGenFormId
    ? { lead_gen_form_id: leadGenFormId }
    : { link: websiteUrl };
  // Meta requires an external URL even for lead gen ads — use websiteUrl always
  const adLink = websiteUrl;

  let objectStorySpec;
  if (isVideo) {
    objectStorySpec = {
      page_id: pageId,
      video_data: {
        video_id: mediaPayload.video_id,
        image_hash: mediaPayload.image_hash,
        title: headline,
        message: primaryText,
        link_description: headline,
        call_to_action: {
          type: ctaType,
          value: ctaValue,
        },
      },
    };
  } else {
    objectStorySpec = {
      page_id: pageId,
      link_data: {
        image_hash: mediaPayload.image_hash,
        link: adLink,
        message: primaryText,
        name: headline,
        call_to_action: {
          type: ctaType,
          value: ctaValue,
        },
      },
    };
  }

  const creativeRes = await fetch(
    `https://graph.facebook.com/v21.0/act_${adAccountId}/adcreatives`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Creative_${adName}`,
        object_story_spec: objectStorySpec,
        access_token: accessToken,
      }),
    }
  );
  const creativeData = await fetchMetaJson(creativeRes);
  if (!creativeData.id) throw new Error("Failed to create ad creative: No ID returned.");
  return creativeData.id;
}

// ── STEP 5: Ad ──
async function createAd(adAccountId, accessToken, adName, adSetId, creativeId, trackingSpecs, adStatus = "PAUSED") {
  const bodyPayload: any = {
    name: adName,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: adStatus,
    access_token: accessToken,
  };

  if (trackingSpecs) {
    bodyPayload.tracking_specs = trackingSpecs;
  }

  const adRes = await fetch(
    `https://graph.facebook.com/v21.0/act_${adAccountId}/ads`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
    }
  );
  const adFinalData = await fetchMetaJson(adRes);
  if (!adFinalData.id) throw new Error("Failed to create ad: No ID returned.");
  return adFinalData.id;
}

export async function POST(request) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    return Response.json({ error: "Missing Meta credentials" }, { status: 500 });
  }

  try {
    const { schema, campaignId: existingCampaignId } = await request.json();

    if (!schema) {
      return Response.json({ error: "Missing schema payload" }, { status: 400 });
    }

    const { campaign, ad_set, ad, link_data } = schema;

    if (!link_data) {
      return Response.json({ error: "Missing link_data (media URL)" }, { status: 400 });
    }

    const isVideo =
      (ad?.media_type || "").toLowerCase() === "video" ||
      (ad?.type || "").toLowerCase() === "video";

    // ── Resolve config values ──
    let objective = campaign?.objective || "OUTCOME_TRAFFIC";
    let isCbo     = campaign?.is_adset_budget_sharing_enabled || false;

    if (existingCampaignId) {
      try {
        const campaignInfo = await fetchCampaignInfo(existingCampaignId, accessToken);
        objective = campaignInfo.objective;
        // Override isCbo from actual campaign data — existing CBO campaigns already
        // have a budget set, so sending ad-set budget would trigger error 4834011
        isCbo = campaignInfo.isCbo;
        console.log(`Existing campaign: objective=${objective}, isCbo=${isCbo}`);
      } catch (err: any) {
        console.warn(`Failed to fetch campaign info for ${existingCampaignId}:`, err.message);
      }
    }

    const campaignName    = campaign?.name             || `[DRAFT] ${objective}_${Date.now()}`;
    const specialAdCats   = (campaign?.special_ad_categories || []).filter((c: string) => c && c !== "NONE");
    
    // Budget & Schedule
    const budgetType      = ad_set?.budget_type       || "LIFETIME";
    const dailyBudget     = ad_set?.daily_budget  > 0 ? ad_set.daily_budget  : 5000;
    const lifetimeBudget  = ad_set?.lifetime_budget > 0 ? ad_set.lifetime_budget : 50000;
    const publishNow      = !!ad_set?.publish_immediately;
    const rawStartTime    = ad_set?.start_time;
    const startTime       = publishNow
      ? Math.floor(Date.now() / 1000)
      : rawStartTime ? Math.floor(new Date(rawStartTime).getTime() / 1000) : null;
    // Convert datetime-local string to Unix timestamp so Meta accepts it
    const rawStopTime     = ad_set?.has_end_date ? ad_set?.stop_time : null;
    const stopTime        = rawStopTime ? Math.floor(new Date(rawStopTime).getTime() / 1000) : null;

    // API-side guard: lifetime budget requires a valid end date
    if (budgetType === "LIFETIME" && !stopTime) {
      return Response.json({ error: "Lifetime budget requires an end date. Please set an end date at least 24 hours after the start time." }, { status: 400 });
    }
    // Always ACTIVE: Meta auto-starts scheduled campaigns at start_time when status=ACTIVE.
    // PAUSED campaigns are never auto-activated by Meta regardless of start_time.
    const adStatus        = "ACTIVE";

    const adSetName       = ad_set?.name              || "Ad Set";
    const ageMin          = ad_set?.age_min            || 18;
    const ageMax          = ad_set?.age_max            || 65;
    const gender          = ad_set?.gender             ?? 0; // 0=all,1=male,2=female
    const dsaBeneficiary  = ad_set?.dsa_beneficiary   || ad?.facebook_page || "Toga Health";
    const dsaPayor        = ad_set?.dsa_payor          || ad?.facebook_page || "Toga Health";
    const adName          = ad?.name                  || "Ad";
    const headline        = ad?.headline              || "";
    const primaryText     = ad?.primary_text          || "";
    const websiteUrl      = ad?.website_url           || "https://togahh.com";
    const ctaType         = ad?.call_to_action_type   || "LEARN_MORE";

    // Clean geo_locations for Meta API
    let rawGeo = ad_set?.geo_locations || {
      countries: ad_set?.geo_targeting || ["US"],
      location_types: ["home", "recent"],
    };
    
    const cleanGeo: any = { location_types: rawGeo.location_types || ["home", "recent"] };
    let hasLocation = false;
    
    if (rawGeo.countries && rawGeo.countries.length > 0) { 
      cleanGeo.countries = rawGeo.countries; 
      hasLocation = true; 
    }
    if (rawGeo.cities && rawGeo.cities.length > 0) { 
      cleanGeo.cities = rawGeo.cities.map(c => ({ key: String(c.key), radius: 25, distance_unit: "mile" })); 
      hasLocation = true; 
    }
    if (rawGeo.regions && rawGeo.regions.length > 0) { 
      cleanGeo.regions = rawGeo.regions.map(c => ({ key: String(c.key) })); 
      hasLocation = true; 
    }
    if (rawGeo.zips && rawGeo.zips.length > 0) { 
      cleanGeo.zips = rawGeo.zips.map(c => ({ key: String(c.key) })); 
      hasLocation = true; 
    }

    // Meta API requires at least one valid location targeting
    if (!hasLocation) {
      cleanGeo.countries = ["US"];
    }

    const targeting: any = {
      geo_locations: cleanGeo,
      age_min: ageMin,
      age_max: ageMax,
      ...(gender !== 0 ? { genders: [gender] } : {}),
      targeting_automation: {
        advantage_audience: 0,
      },
    };

    // Meta enforces DSA transparency fields on all ACTIVE ads globally (not just EU)
    const dsaFields = {
      dsa_beneficiary: dsaBeneficiary,
      dsa_payor: dsaPayor,
    };

    const leadGenFormId = ad?.lead_gen_form_id || null;
    // When a lead gen form is attached, use LEAD_GENERATION optimization — no pixel needed
    const isLeadGenForm = objective === "OUTCOME_LEADS" && !!leadGenFormId;

    // Dynamic Optimization Goal and Pixel requirements
    const userGoal = ad_set?.optimization_goal || "LINK_CLICKS";
    const isPixelRequired = !isLeadGenForm && (
      objective === "OUTCOME_SALES" ||
      objective === "OUTCOME_LEADS" ||
      userGoal === "OFFSITE_CONVERSIONS"
    );

    let promotedObject: any = null;
    let trackingSpecs: any = null;
    let optimizationGoal = isLeadGenForm ? "LEAD_GENERATION" : userGoal;

    if (isPixelRequired) {
      const pixelId = await getOrCreatePixelId(accessToken, adAccountId);
      console.log(`Using pixel ID: ${pixelId} for objective ${objective}`);

      const customEvent = objective === "OUTCOME_SALES" ? "PURCHASE" : "LEAD";
      promotedObject = {
        pixel_id: pixelId,
        custom_event_type: customEvent,
      };

      trackingSpecs = [
        {
          "action.type": ["offsite_conversion"],
          "fb_pixel": [pixelId],
        }
      ];

      // Ensure optimization goal is conversion-compatible if pixel is required
      if (optimizationGoal !== "OFFSITE_CONVERSIONS" && optimizationGoal !== "LINK_CLICKS") {
        optimizationGoal = "OFFSITE_CONVERSIONS";
      }
    }

    // ── Execute Concurrent Tasks: Media Upload & Page ID Fetch ──
    const [mediaPayload, pageId] = await Promise.all([
      uploadMedia(link_data, isVideo, accessToken, adAccountId),
      fetchPageId(accessToken)
    ]);

    // For lead gen forms, promoted_object references the Page (not a pixel)
    if (isLeadGenForm) {
      promotedObject = { page_id: pageId };
    }

    // ── Sequential Tasks: Campaign -> Ad Set -> Creative -> Ad ──
    const campaignId = await createCampaign(
      existingCampaignId, adAccountId, accessToken, campaignName, objective,
      specialAdCats, isCbo, budgetType, dailyBudget, lifetimeBudget, adStatus
    );

    const adSetId = await createAdSet(
      adAccountId, accessToken, adSetName, campaignId, isCbo,
      budgetType, dailyBudget, lifetimeBudget, startTime, stopTime,
      targeting, dsaFields, optimizationGoal, promotedObject, adStatus,
      isLeadGenForm ? "ON_AD" : null
    );

    const creativeId = await createAdCreative(
      adAccountId, accessToken, isVideo, pageId, mediaPayload,
      headline, primaryText, websiteUrl, ctaType, adName, leadGenFormId
    );

    const adId = await createAd(
      adAccountId, accessToken, adName, adSetId, creativeId, trackingSpecs, adStatus
    );

    // Smart launch: when adding a new live ad to an existing campaign,
    // pause all previous ads at the ad level, then resume the campaign so only the new ad runs.
    let pausedAdsCount = 0;
    if (existingCampaignId && publishNow) {
      pausedAdsCount = await pauseExistingAdsInCampaign(existingCampaignId, adId, accessToken, adAccountId);
      await resumeCampaignToActive(existingCampaignId, accessToken);
    }

    return Response.json({
      success: true,
      campaignId,
      adSetId,
      adId,
      pausedAdsCount,
    });
  } catch (error) {
    console.error("Launch Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
