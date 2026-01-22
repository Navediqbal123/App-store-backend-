import express from "express";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

/* ===============================
AUTH
=============================== */
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

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
ADMIN – UPDATE INSIGHTS
POST /api/admin/insights/update
(Admin only)
===================================================== */
router.post("/insights/update", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) {
      return res.status(403).json({ error: "Admin only" });
    }

    const payload = {
      total_apps: req.body.total_apps ?? 0,
      total_scans: req.body.total_scans ?? 0,
      scan_pass: req.body.scan_pass ?? 0,
      scan_fail: req.body.scan_fail ?? 0,
      created_at: new Date().toISOString(),
    };

    const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_ai_insights`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ error: "Failed to update insights" });
  }
});

/* =====================================================
ADMIN – GET LATEST INSIGHTS
GET /api/admin/insights
(Admin only)
===================================================== */
router.get("/insights", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) {
      return res.status(403).json({ error: "Admin only" });
    }

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_ai_insights?order=created_at.desc&limit=1`,
      { headers }
    );

    const data = await r.json();
    res.json({ success: true, data: data?.[0] || {} });
  } catch {
    res.status(500).json({ error: "Failed to fetch insights" });
  }
});

export default router;
