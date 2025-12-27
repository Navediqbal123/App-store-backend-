import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/ai-upload", async (req, res) => {
  try {
    const { appName, category, permissions } = req.body;

    if (!appName) {
      return res.status(400).json({ error: "appName required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    const prompt = `
Generate app description, tags and safety notes.
App: ${appName}
Category: ${category || "N/A"}
Permissions: ${permissions || "N/A"}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    const result =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response from Gemini";

    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
