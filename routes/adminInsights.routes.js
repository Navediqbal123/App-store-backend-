import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

/**
 * UPDATE INSIGHTS (call after scan)
 * Body:
 * { total_apps?, total_scans?, scan_pass?, scan_fail? }
 */
router.post("/admin/insights/update", async (req, res) => {
  try {
    const body = {
      total_apps: req.body.total_apps ?? 0,
      total_scans: req.body.total_scans ?? 0,
      scan_pass: req.body.scan_pass ?? 0,
      scan_fail: req.body.scan_fail ?? 0,
    };

    const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_ai_insights`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await r.json();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: "Failed to update insights" });
  }
});

/**
 * GET INSIGHTS (admin dashboard)
 */
router.get("/admin/insights", async (req, res) => {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_ai_insights?order=created_at.desc&limit=1`,
      { headers }
    );
    const data = await r.json();
    res.json(data?.[0] || {});
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch insights" });
  }
});

export default router;
