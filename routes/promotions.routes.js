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

/* ===============================
ADMIN – TOGGLE PROMOTION (FIXED)
=============================== */
router.post("/admin/toggle/:id", auth, async (req, res) => {
  try {
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

    if (!response.ok) {
      return res.status(400).json({ error: data });
    }

    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
