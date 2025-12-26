const express = require("express");
const axios = require("axios");
const router = express.Router();

router.post("/virus-scan", async (req, res) => {
  try {
    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ error: "File URL required" });
    }

    const response = await axios.post(
      "https://www.virustotal.com/api/v3/urls",
      new URLSearchParams({ url: fileUrl }),
      {
        headers: {
          "x-apikey": process.env.VIRUSTOTAL_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const analysisId = response.data.data.id;

    return res.json({
      scanned: true,
      analysisId
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
