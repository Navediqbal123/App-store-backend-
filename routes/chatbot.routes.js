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
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          input: `User error: ${errorMessage}\nGive clear steps to fix it.`,
        }),
      }
    );

    const data = await response.json();

    const reply =
      data.output?.[0]?.content?.[0]?.text ||
      "AI could not generate a response";

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Chatbot failed" });
  }
});

export default router;
