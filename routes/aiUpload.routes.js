import express from "express";
import { supabase } from "../supabaseClient.js";
import fetch from "node-fetch";

const router = express.Router();

const OPENROUTER_URL = "https://openrouter.ai/api/v1";
const FAST_MODEL = "google/gemini-3.1-flash-lite";
const IMAGE_MODEL = "openai/gpt-image-1";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
  "HTTP-Referer": "https://zenova-stellar-forge.lovable.app",
  "X-Title": "App Store AI Upload",
};

router.post("/", async (req, res) => {
  try {
    const {
      appName,
      category,
      permissions,
      iconUrl,
      screenshotUrls = [],
    } = req.body;

    if (!appName) {
      return res.status(400).json({
        error: "appName required",
      });
    }

    /*
    ============================================================
    1. BUILD IMAGE INPUTS FOR AI ANALYSIS
    ============================================================
    */

    const analysisContent = [
      {
        type: "text",
        text: `
Analyze this mobile application professionally for an app store.

APP NAME:
${appName}

CATEGORY:
${category || "Unknown"}

PERMISSIONS:
${Array.isArray(permissions)
  ? permissions.join(", ")
  : permissions || "None"}

Analyze the application information, icon and screenshots if available.

Return ONLY valid JSON.

Required format:

{
  "description": "Professional and attractive app-store description.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "privacy_summary": "Simple privacy explanation.",
  "icon_analysis": "Short professional analysis of the icon.",
  "screenshot_analysis": "Short professional analysis of the screenshots.",
  "quality_score": 0
}

Rules:
- quality_score must be between 0 and 100.
- Description should sound professional.
- Do not invent permissions.
- Keep the response concise.
- Return JSON only.
        `,
      },
    ];

    /*
    ============================================================
    2. ADD EXISTING APP ICON FOR ANALYSIS
    ============================================================
    */

    if (iconUrl) {
      analysisContent.push({
        type: "image_url",
        image_url: {
          url: iconUrl,
        },
      });
    }

    /*
    ============================================================
    3. ADD EXISTING SCREENSHOTS FOR ANALYSIS
    ============================================================
    */

    for (const screenshotUrl of screenshotUrls.slice(0, 5)) {
      if (screenshotUrl) {
        analysisContent.push({
          type: "image_url",
          image_url: {
            url: screenshotUrl,
          },
        });
      }
    }

    /*
    ============================================================
    4. FAST AI ANALYSIS
    ============================================================
    */

    const analysisRequest = fetch(
      `${OPENROUTER_URL}/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: FAST_MODEL,

          messages: [
            {
              role: "user",
              content: analysisContent,
            },
          ],

          temperature: 0.2,

          max_tokens: 600,

          response_format: {
            type: "json_object",
          },
        }),
      }
    );

    /*
    ============================================================
    5. PREMIUM APP ICON GENERATION
    ============================================================
    */

    const iconGenerationRequest = fetch(
      `${OPENROUTER_URL}/images`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: IMAGE_MODEL,

          prompt: `
Create a premium modern mobile app icon for:

App Name: ${appName}
Category: ${category || "mobile application"}

Design requirements:
- Premium professional App Store quality
- Modern minimal visual identity
- Strong recognizable central symbol
- Clean polished 3D/high-end finish
- Excellent lighting
- Beautiful depth
- Smooth edges
- Professional color palette based on the app category
- No unnecessary text
- No watermark
- No phone frame
- Square app icon
- Suitable for a real commercial mobile application
`,

          aspect_ratio: "1:1",
          quality: "medium",
          background: "opaque",
          n: 1,
        }),
      }
    );

    /*
    ============================================================
    6. PREMIUM APP SCREENSHOT GENERATION
    ============================================================
    */

    const screenshotGenerationRequest = fetch(
      `${OPENROUTER_URL}/images`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: IMAGE_MODEL,

          prompt: `
Create a premium mobile app store promotional screenshot for:

App Name: ${appName}
Category: ${category || "mobile application"}

Create a realistic modern mobile application screen concept.

Requirements:
- Professional real-app UI
- Premium modern design
- Clean layout
- Excellent typography
- Beautiful spacing
- App-specific interface
- UI should clearly match the app name and category
- Mobile portrait composition
- No phone mockup
- No watermark
- No random logos
- No unrelated content
- Suitable for an official App Store listing

Create a visually impressive first-screen experience.
`,

          aspect_ratio: "2:3",
          quality: "medium",
          background: "opaque",
          n: 3,
        }),
      }
    );

    /*
    ============================================================
    7. RUN ALL AI TASKS TOGETHER
    ============================================================
    */

    const [
      analysisResponse,
      iconResponse,
      screenshotsResponse,
    ] = await Promise.all([
      analysisRequest,
      iconGenerationRequest,
      screenshotGenerationRequest,
    ]);

    /*
    ============================================================
    8. READ ANALYSIS RESPONSE
    ============================================================
    */

    const analysisData = await analysisResponse.json();

    if (!analysisResponse.ok) {
      throw new Error(
        analysisData?.error?.message ||
          `Analysis API error: ${analysisResponse.status}`
      );
    }

    const aiText =
      analysisData?.choices?.[0]?.message?.content;

    if (!aiText) {
      throw new Error("AI analysis returned empty response");
    }

    let result;

    try {
      result = JSON.parse(aiText);
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    /*
    ============================================================
    9. READ GENERATED ICON
    ============================================================
    */

    const iconData = await iconResponse.json();

    if (!iconResponse.ok) {
      throw new Error(
        iconData?.error?.message ||
          `Icon generation error: ${iconResponse.status}`
      );
    }

    const generatedIcon =
      iconData?.data?.[0]?.b64_json
        ? `data:${iconData.data[0].media_type || "image/png"};base64,${iconData.data[0].b64_json}`
        : null;

    /*
    ============================================================
    10. READ GENERATED SCREENSHOTS
    ============================================================
    */

    const screenshotsData =
      await screenshotsResponse.json();

    if (!screenshotsResponse.ok) {
      throw new Error(
        screenshotsData?.error?.message ||
          `Screenshot generation error: ${screenshotsResponse.status}`
      );
    }

    const generatedScreenshots = (
      screenshotsData?.data || []
    )
      .filter((image) => image?.b64_json)
      .map(
        (image) =>
          `data:${image.media_type || "image/png"};base64,${image.b64_json}`
      );

    /*
    ============================================================
    11. SAVE SUCCESS LOG
    ============================================================
    */

    await supabase
      .from("admin_ai_insights")
      .insert([
        {
          type: "ai_upload",
          result: "success",
        },
      ]);

    /*
    ============================================================
    12. SEND FINAL RESULT
    ============================================================
    */

    res.json({
      success: true,

      ...result,

      generated_icon: generatedIcon,

      generated_screenshots: generatedScreenshots,

      ai_models: {
        analysis: FAST_MODEL,
        image: IMAGE_MODEL,
      },
    });

  } catch (err) {
    console.error("AI Upload Error:", err);

    /*
    ============================================================
    ERROR LOG
    ============================================================
    */

    await supabase
      .from("admin_ai_insights")
      .insert([
        {
          type: "ai_upload",
          result: "error",
        },
      ]);

    res.status(500).json({
      error: "AI failed to generate content",
      details: err.message,
    });
  }
});

export default router;
