import express from "express";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";

const router = express.Router();

/* ===============================
ADMIN AUTH CHECK
=============================== */
async function requireAdmin(req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return false;

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userId = decoded.id;

  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=role`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  const data = await res.json();
  return data?.[0]?.role === "admin";
}

/* ===============================
ADMIN – CREATE PROMOTION
=============================== */
router.post("/admin/create", async (req, res) => {
  try {
    if (!(await requireAdmin(req)))
      return res.status(403).json({ error: "Admin only" });

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/promotions`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(req.body),
      }
    );

    const data = await response.json();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: "Create failed" });
  }
});

/* ===============================
ADMIN – TOGGLE PROMOTION (FIXED)
=============================== */
router.post("/admin/toggle/:id", async (req, res) => {
  try {
    if (!(await requireAdmin(req)))
      return res.status(403).json({ error: "Admin only" });

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/promotions?id=eq.${req.params.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_active: req.body.is_active,
        }),
      }
    );

    const data = await response.json();
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ error: "Toggle failed" });
  }
});

/* ===============================
USER – FETCH ACTIVE PROMOS
=============================== */
router.get("/active", async (req, res) => {
  const r = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/promotions?is_active=eq.true`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  res.json(await r.json());
});

export default router;
