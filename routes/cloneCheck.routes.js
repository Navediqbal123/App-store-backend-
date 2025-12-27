import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/clone-check", async (req, res) => {
  try {
    const { app_id, package_id, name, category } = req.body;

    if (!app_id || !package_id) {
      return res.status(400).json({ error: "app_id & package_id required" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 🔍 Check same package_id
    const check = await fetch(
      `${SUPABASE_URL}/rest/v1/apps?package_id=eq.${package_id}&select=id`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
      }
    );

    const rows = await check.json();

    let isClone = rows.length > 1;
    let matchedWith = isClone ? rows[0].id : null;

    // 🧾 Log result
    await fetch(`${SUPABASE_URL}/rest/v1/app_clones`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id,
        package_id,
        is_clone: isClone,
        matched_with: matchedWith,
      }),
    });

    res.json({
      clone_checked: true,
      is_clone: isClone,
      matched_with: matchedWith,
    });

  } catch (err) {
    res.status(500).json({ error: "Clone check failed" });
  }
});

export default router;
