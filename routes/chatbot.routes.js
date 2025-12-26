const express = require("express");
const axios = require("axios");
const router = express.Router();

router.post("/chatbot-help", async (req, res) => {
  const { errorMessage } = req.body;

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful app store support assistant."
        },
        {
          role: "user",
          content: `Explain this error in simple words and how to fix it: ${errorMessage}`
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
    reply: response.data.choices[0].message.content
  });
});

export default router;
