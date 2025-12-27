import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/chatbot-help", async (req, res) => {
  try {
    const { errorMessage } = req.body;

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
        }),
      }
    );

    const data = await response.json();
    res.json({ reply: data.choices[0].message.content });
  } catch (e) {
    res.status(500).json({ error: "Groq failed" });
  }
});

export default router;
