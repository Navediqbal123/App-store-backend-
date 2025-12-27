import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/chatbot-help", async (req, res) => {
  try {
    const { errorMessage } = req.body;

    if (!errorMessage) {
      return res.status(400).json({ error: "errorMessage required" });
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://app-store-backend-iodn.onrender.com",
          "X-Title": "App Store Backend"
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a helpful app store support assistant. Explain errors simply and clearly."
            },
            {
              role: "user",
              content: errorMessage
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!data.choices) {
      return res.status(500).json({ error: "AI response failed", data });
    }

    res.json({
      reply: data.choices[0].message.content
    });

  } catch (err) {
    res.status(500).json({ error: "Chatbot failed" });
  }
});

export default router;
