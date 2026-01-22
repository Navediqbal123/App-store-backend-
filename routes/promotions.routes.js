import express from "express";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

/* 🔐 AUTH */
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

/* 🔐 ADMIN CHECK */
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
ADMIN – TOGGLE PROMOTION (ON / OFF)
POST /api/promotions/admin/toggle/:id
BODY: { is_active: true | false }
===================================================== */
router.post("/admin/toggle/:id", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) {
      return res.status(403).json({ error: "Admin only" });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/promotions?id=eq.${req.params.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          is_active: req.body.is_active,
        }),
      }
    );

    const data = await response.json();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =====================================================
ADMIN – PROMOTIONS LIST
GET /api/promotions/admin/list
===================================================== */
router.get("/admin/list", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) {
      return res.status(403).json({ error: "Admin only" });
    }

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/promotions?select=*`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
      }
    );

    const data = await r.json();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =====================================================
ADMIN – APPROVE / REJECT PROMOTION
POST /api/promotions/admin/decision/:id
BODY:
{
  "status": "approved" | "rejected",
  "reason": "optional"
}
===================================================== */
router.post("/admin/decision/:id", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { status, reason } = req.body;

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/promotions?id=eq.${req.params.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          status,
          reject_reason: status === "rejected" ? reason || null : null,
          is_active: status === "approved",
        }),
      }
    );

    const data = await r.json();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =====================================================
ADMIN – PROMOTION REVENUE ANALYTICS
GET /api/promotions/admin/revenue
===================================================== */
router.get("/admin/revenue", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) {
      return res.status(403).json({ error: "Admin only" });
    }

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/promotions?select=amount,is_active,status`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
      }
    );

    const data = await r.json();

    const total = data.reduce((s, p) => s + (p.amount || 0), 0);
    const active = data.filter(p => p.is_active).length;
    const approved = data.filter(p => p.status === "approved").length;

    res.json({
      success: true,
      total_revenue: total,
      total_promotions: data.length,
      active_promotions: active,
      approved_promotions: approved,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =====================================================
DEVELOPER – READ ONLY PROMOTIONS
GET /api/promotions/developer/:appId
===================================================== */
router.get("/developer/:appId", auth, async (req, res) => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/promotions?app_id=eq.${req.params.appId}&select=*`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
      }
    );

    const data = await response.json();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =====================================================
USER – ACTIVE PROMOTIONS (GLOBAL)
GET /api/promotions/active
===================================================== */
router.get("/active", async (req, res) => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/promotions?is_active=eq.true&select=*`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
      }
    );

    const data = await response.json();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =====================================================
USER – ACTIVE PROMOTIONS FOR APP PAGE
GET /api/promotions/app/:appId
===================================================== */
router.get("/app/:appId", async (req, res) => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/promotions?app_id=eq.${req.params.appId}&is_active=eq.true&select=*`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
      }
    );

    const data = await response.json();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
