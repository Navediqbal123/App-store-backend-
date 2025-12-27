import express from "express";
import fetch from "node-fetch";

const router = express.Router();

/*
POST /api/ai-upload
Body:
{
  "appName": "My App",
  "category": "Tools",
  "permissions": "Camera, Storage"
}
*/

router.post("/ai-upload", async (req, res) => {
  try {
    const { appName, category, permissions } = req.body;

    if (!appName) {
      return res.status(400).json({ error: "appName required" });
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an App Store AI assistant.",
            },
            {
              role: "user",
              content: `
Generate:
- App description
- 5 tags
- Short privacy summary

App name: ${appName}
Category: ${category || "General"}
Permissions: ${permissions || "None"}
              `,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!data.choices) {
      return res.status(500).json({ error: "AI response failed" });
    }

    res.json({
      aiGenerated: true,
      content: data.choices[0].message.content,
    });

  } catch (err) {
    res.status(500).json({ error: "AI upload failed" });
  }
});

export default router;
