import express from "express";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

/* ===============================
AUTH
=============================== */
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* ===============================
ADMIN CHECK
=============================== */
async function isAdmin(userId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=role`,
    {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
      },
    }
  );
  const d = await r.json();
  return d?.[0]?.role === "admin";
}

/* =====================================================
LOG EVENTS (virus scan / ai upload)
POST /api/admin/stats/log
BODY: { type: "virus_scan" | "ai_upload", result: "passed" | "failed" | "success" | "error" }
===================================================== */
router.post("/log", async (req, res) => {
  try {
    const { type, result } = req.body;

    if (!type || !result) {
      return res.status(400).json({ error: "type & result required" });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_ai_insights`,
      {
        method: "POST",
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          type,
          result,
          created_at: new Date().toISOString(),
        }),
      }
    );

    const data = await response.json();
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ error: "Log failed" });
  }
});

/* =====================================================
ADMIN INSIGHTS – SUMMARY
GET /api/admin/stats/insights
(Admin only)
===================================================== */
router.get("/insights", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) {
      return res.status(403).json({ error: "Admin only" });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_ai_insights?select=type,result`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
      }
    );

    const rows = await response.json();

    const summary = {
      virus_scan: {
        passed: rows.filter(
          r => r.type === "virus_scan" && r.result === "passed"
        ).length,
        failed: rows.filter(
          r => r.type === "virus_scan" && r.result === "failed"
        ).length,
        total: rows.filter(r => r.type === "virus_scan").length,
      },
      ai_upload: {
        success: rows.filter(
          r => r.type === "ai_upload" && r.result === "success"
        ).length,
        error: rows.filter(
          r => r.type === "ai_upload" && r.result === "error"
        ).length,
        total: rows.filter(r => r.type === "ai_upload").length,
      },
    };

    res.json({ success: true, summary });
  } catch {
    res.status(500).json({ error: "Insights failed" });
  }
});

export default router;
