import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/chatbot-help", async (req, res) => {
  try {
    const { errorMessage } = req.body;

    if (!errorMessage) {
      return res.json({ reply: "No message provided" });
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
          model: "llama3-70b-8192",
          messages: [
            {
              role: "user",
              content: errorMessage,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
      return res.json({ reply: "AI service temporarily unavailable" });
    }

    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "AI service temporarily unavailable" });
  }
});

export default router;
