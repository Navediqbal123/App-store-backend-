const express = require("express");
const axios = require("axios");
const router = express.Router();

router.post("/ai-upload", async (req, res) => {
  try {
    const { appName, permissions, category } = req.body;

    const aiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an App Store AI assistant."
          },
          {
            role: "user",
            content: `
Generate app description, tags and privacy summary.
App name: ${appName}
Category: ${category}
Permissions: ${permissions}
            `
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    res.json({
      status: "PENDING",
      aiGenerated: true,
      content: aiResponse.data.choices[0].message.content
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
