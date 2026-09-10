import express from "express";
import { supabase } from "../supabaseClient.js";
import fetch from "node-fetch";

const router = express.Router();

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
      return res.status(400).json({ error: "appName required" });
    }

    // Text + App Icon + Screenshots
    const content = [
      {
        type: "text",
        text: `
Analyze this mobile app carefully.

App Name: ${appName}
Category: ${category || "Unknown"}
Permissions: ${permissions || "None"}

Analyze the app icon and screenshots if provided.

Return ONLY valid JSON with:
{
  "description": "professional app-store description",
  "tags": ["tag1", "tag2", "tag3"],
  "privacy_summary": "simple privacy explanation",
  "icon_analysis": "short analysis of the app icon",
  "screenshot_analysis": "short analysis of the screenshots",
  "quality_score": 0
}

Quality score must be between 0 and 100.
        `,
      },
    ];

    // App Icon
    if (iconUrl) {
      content.push({
        type: "image_url",
        image_url: {
          url: iconUrl,
        },
      });
    }

    // App Screenshots
    for (const screenshotUrl of screenshotUrls.slice(0, 5)) {
      if (screenshotUrl) {
        content.push({
          type: "image_url",
          image_url: {
            url: screenshotUrl,
          },
        });
      }
    }

    // OpenRouter AI
    const aiResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://zenova-stellar-forge.lovable.app",
          "X-Title": "App Store AI Upload",
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            {
              role: "user",
              content,
            },
          ],
          response_format: {
            type: "json_object",
          },
        }),
      }
    );

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
      throw new Error(
        aiData?.error?.message || `OpenRouter error: ${aiResponse.status}`
      );
    }

    const aiText = aiData?.choices?.[0]?.message?.content;

    if (!aiText) {
      throw new Error("AI returned empty response");
    }

    const result = JSON.parse(aiText);

    // Supabase logging
    await supabase.from("admin_ai_insights").insert([
      {
        type: "ai_upload",
        result: "success",
      },
    ]);

    res.json({
      success: true,
      ...result,
    });

  } catch (err) {
    console.error("AI Upload Error:", err);

    await supabase.from("admin_ai_insights").insert([
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
