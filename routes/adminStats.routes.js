import express from "express";
import fetch from "node-fetch";

const router = express.Router();

/* 🔹 LOG EVENTS (virus scan / ai upload) */
router.post("/log", async (req, res) => {
  try {
    const { type, result } = req.body;

    if (!type || !result) {
      return res.status(400).json({ error: "type & result required" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_stats`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ type, result }),
    });

    const data = await response.json();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: "Log failed" });
  }
});

/* 🔹 ADMIN INSIGHTS (summary) */
router.get("/insights", async (req, res) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_stats?select=type,result`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
      }
    );

    const rows = await response.json();

    const summary = {
      virus_passed: rows.filter(r => r.type === "virus_scan" && r.result === "passed").length,
      virus_failed: rows.filter(r => r.type === "virus_scan" && r.result === "failed").length,
      ai_success: rows.filter(r => r.type === "ai_upload" && r.result === "success").length,
      ai_error: rows.filter(r => r.type === "ai_upload" && r.result === "error").length,
    };

    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: "Insights failed" });
  }
});

export default router;
