import express from "express";
import { supabase } from "../supabaseClient.js";
import jwt from "jsonwebtoken";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

/* ===============================
   AUTH MIDDLEWARE
=============================== */
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.email = decoded.email; // Email extract karna zaroori hai
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* =====================================================
   ADMIN – UPDATE INSIGHTS (POST)
===================================================== */
router.post("/update", auth, async (req, res) => {
  try {
    // 🔒 Admin Email Security Check
    if (req.email !== "navedahmad9012@gmail.com") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { total_apps, total_scans, scan_pass, scan_fail } = req.body;

    const { data, error } = await supabase
      .from("admin_ai_insights")
      .insert([
        {
          total_apps: total_apps ?? 0,
          total_scans: total_scans ?? 0,
          scan_pass: scan_pass ?? 0,
          scan_fail: scan_fail ?? 0,
          created_at: new Date().toISOString(),
        }
      ])
      .select();

    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =====================================================
   ADMIN – GET LATEST INSIGHTS (GET)
===================================================== */
router.get("/", auth, async (req, res) => {
  try {
    if (req.email !== "navedahmad9012@gmail.com") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { data, error } = await supabase
      .from("admin_ai_insights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Handle empty table
    res.json({ success: true, data: data || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
