import express from "express";
import fetch from "node-fetch";

const router = express.Router();

/* ===============================
ADMIN – CREATE / UPDATE PROMOTION
=============================== */

/*
POST /api/promotions/admin/create
Body:
{
  "title": "App Promotion",
  "type": "app",        // app | company
  "app_id": "UUID",     // nullable for company promo
  "media_url": "https://video-or-image",
  "show_home": true,
  "show_search": true,
  "show_app_page": true,
  "is_active": true
}
*/
router.post("/admin/create", async (req, res) => {
  try {
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const URL = process.env.SUPABASE_URL;

    const response = await fetch(`${URL}/rest/v1/promotions`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ error: "Promotion create failed" });
  }
});

/* ===============================
ADMIN – TOGGLE PROMOTION
=============================== */
router.post("/admin/toggle/:id", async (req, res) => {
  try {
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const URL = process.env.SUPABASE_URL;

    const response = await fetch(
      `${URL}/rest/v1/promotions?id=eq.${req.params.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: req.body.is_active }),
      }
    );

    const data = await response.json();
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ error: "Toggle failed" });
  }
});

/* ===============================
USER – FETCH PROMOTIONS
=============================== */
router.get("/active", async (req, res) => {
  try {
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const URL = process.env.SUPABASE_URL;

    const response = await fetch(
      `${URL}/rest/v1/promotions?is_active=eq.true&select=*`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
      }
    );

    const data = await response.json();
    res.json(data);
  } catch {
    res.status(500).json({ error: "Fetch failed" });
  }
});

/* ===============================
DEVELOPER – READ ONLY
=============================== */
router.get("/developer/:appId", async (req, res) => {
  try {
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const URL = process.env.SUPABASE_URL;

    const response = await fetch(
      `${URL}/rest/v1/promotions?app_id=eq.${req.params.appId}&select=*`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
      }
    );

    const data = await response.json();
    res.json(data);
  } catch {
    res.status(500).json({ error: "Developer fetch failed" });
  }
});

export default router;
