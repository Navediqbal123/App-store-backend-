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
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [
            {
              role: "user",
              content: errorMessage,
            },
          ],
          temperature: 0.4,
        }),
      }
    );

    const data = await response.json();

    // 🔒 SAFETY CHECK (VERY IMPORTANT)
    if (!data.choices || !data.choices[0]) {
      return res.json({
        reply: "AI service temporarily unavailable",
      });
    }

    res.json({
      reply: data.choices[0].message.content,
    });
  } catch (err) {
    console.error("Groq error:", err);
    res.status(500).json({ error: "Groq failed" });
  }
});

export default router;
