import express from "express";
import axios from "axios";
import fetch from "node-fetch";

const router = express.Router();

router.post("/virus-scan", async (req, res) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const analysisId = response.data.data.id;

    /* 🔹 AUTO LOG : VIRUS PASSED */
    await fetch(`${SUPABASE_URL}/rest/v1/admin_ai_insights`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        type: "virus_scan",
        result: "passed",
      }),
    });

    return res.json({
      scanned: true,
      analysisId,
    });

  } catch (err) {

    /* 🔹 AUTO LOG : VIRUS FAILED */
    await fetch(`${SUPABASE_URL}/rest/v1/admin_ai_insights`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        type: "virus_scan",
        result: "failed",
      }),
    });

    res.status(500).json({ error: "Virus scan failed" });
  }
});

export default router;
