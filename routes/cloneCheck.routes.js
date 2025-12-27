import express from "express";
import fetch from "node-fetch";

const router = express.Router();

/*
POST /api/clone-check
Body:
{
  "package_id": "com.my.app",
  "name": "My App"
}
*/

router.post("/clone-check", async (req, res) => {
  try {
    const { package_id, name } = req.body;

    if (!package_id && !name) {
      return res.status(400).json({ error: "package_id or name required" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 🔍 package_id match (strong clone)
    const pkgRes = await fetch(
      `${SUPABASE_URL}/rest/v1/apps?package_id=eq.${package_id}&select=id`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
      }
    );

    const pkgData = await pkgRes.json();

    if (pkgData.length > 0) {
      return res.json({
        clone: true,
        reason: "Package ID already exists",
      });
    }

    // 🔍 name match (soft clone)
    const nameRes = await fetch(
      `${SUPABASE_URL}/rest/v1/apps?name=ilike.%${name}%&select=id`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
      }
    );

    const nameData = await nameRes.json();

    if (nameData.length > 0) {
      return res.json({
        clone: true,
        reason: "Similar app name exists",
      });
    }

    res.json({
      clone: false,
      reason: "No duplicate found",
    });

  } catch (err) {
    res.status(500).json({ error: "Clone check failed" });
  }
});

export default router;
