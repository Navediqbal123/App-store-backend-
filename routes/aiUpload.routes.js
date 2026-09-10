import express from "express";
import { supabase } from "../supabaseClient.js";
import fetch from "node-fetch";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { appName, category, permissions } = req.body;
    if (!appName) return res.status(400).json({ error: "appName required" });

    // 1. Call AI with Structured Prompt - GPT-5.6 Luna from Experimentallabs
    const aiResponse = await fetch("https://api.experimentallabs.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.EXPERIMENTALLABS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        messages: [
          {
            role: "system",
            content: "Return ONLY a JSON object with keys: description, tags (array), privacy_summary."
          },
          {
            role: "user",
            content: `App: ${appName}, Category: ${category}, Permissions: ${permissions}`
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const aiData = await aiResponse.json();
    const content = JSON.parse(aiData.choices[0].message.content);

    // 2. Logging with Supabase SDK
    await supabase.from("admin_ai_insights").insert([
      { type: "ai_upload", result: "success" }
    ]);

    res.json({ success: true, ...content });

  } catch (err) {
    await supabase.from("admin_ai_insights").insert([
      { type: "ai_upload", result: "error" }
    ]);

    res.status(500).json({ error: "AI failed to generate content" });
  }
});

export default router;
