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
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a helpful app store support assistant.",
            },
            {
              role: "user",
              content: errorMessage,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    res.json({
      reply: data.choices[0].message.content,
    });

  } catch (err) {
    res.status(500).json({ error: "Chatbot failed" });
  }
});

export default router;
