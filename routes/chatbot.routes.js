import express from "express";
import { supabase } from "../supabaseClient.js"; // SDK use karein
import fetch from "node-fetch";

const router = express.Router();

router.post("/chatbot-help", async (req, res) => {
  try {
    const { errorMessage, context } = req.body; // 'context' optional hai (e.g. 'developer' ya 'user')
    if (!errorMessage) return res.status(400).json({ error: "errorMessage required" });

    // 1. AI Call with specialized context
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: `You are a technical support bot for a Premium App Store. 
            Help the ${context || 'user'} fix this specific error: ${errorMessage}. 
            Be concise and professional.` 
          },
          { role: "user", content: errorMessage }
        ]
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";

    // 2. Logging to Admin Insights
    await supabase.from("admin_ai_insights").insert([
      { type: "chatbot_query", result: "success", created_at: new Date().toISOString() }
    ]);

    res.json({ success: true, reply });

  } catch (err) {
    // 3. Error Logging
    await supabase.from("admin_ai_insights").insert([
      { type: "chatbot_query", result: "error" }
    ]);
    res.status(500).json({ error: "Chatbot failed to respond" });
  }
});

export default router;
