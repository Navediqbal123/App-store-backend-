import express from "express";
import { supabase } from "../supabaseClient.js"; // SDK Use karein

const router = express.Router();

router.post("/clone-check", async (req, res) => {
  try {
    const { package_id, name } = req.body;
    if (!package_id && !name) return res.status(400).json({ error: "Required fields missing" });

    // 1. Package ID Check (Exact match)
    const { data: pkgData } = await supabase
      .from("apps")
      .select("id")
      .eq("package_id", package_id);

    if (pkgData?.length > 0) {
      return res.json({ clone: true, reason: "Package ID already exists" });
    }

    // 2. Name Check (Fuzzy match)
    const { data: nameData } = await supabase
      .from("apps")
      .select("id")
      .ilike("name", `%${name}%`);

    if (nameData?.length > 0) {
      return res.json({ clone: true, reason: "Similar app name exists" });
    }

    // 3. Success Log
    await supabase.from("admin_ai_insights").insert([
      { type: "clone_check", result: "clean", created_at: new Date().toISOString() }
    ]);

    res.json({ clone: false, reason: "No duplicate found" });

  } catch (err) {
    res.status(500).json({ error: "Clone check failed" });
  }
});

export default router;
