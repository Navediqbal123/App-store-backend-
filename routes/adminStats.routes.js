import express from "express";
import { supabase } from "../supabaseClient.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// Environment Variables
const JWT_SECRET = process.env.JWT_SECRET;

/* ======================================================
   AUTH MIDDLEWARE
====================================================== */
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.email = decoded.email;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* ======================================================
   ADMIN SUMMARY (Dashboard Stats)
====================================================== */
router.get("/summary", auth, async (req, res) => {
  try {
    // Naved ki email security check
    if (req.email !== "navedahmad9012@gmail.com") {
      return res.status(403).json({ error: "Not admin" });
    }

    const { data: devs } = await supabase.from("developers").select("status");
    const { data: apps } = await supabase.from("apps").select("status");
    const { count: categories } = await supabase.from("categories").select("*", { count: "exact", head: true });

    res.json({
      success: true,
      stats: {
        developers: {
          total: devs?.length || 0,
          pending: devs?.filter(d => d.status === "pending").length || 0,
        },
        apps: {
          total: apps?.length || 0,
          pending: apps?.filter(a => a.status === "pending").length || 0,
        },
        categories: categories || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   ADMIN LOGGING (Virus & AI)
====================================================== */
router.post("/log", auth, async (req, res) => {
  const { type, result } = req.body;
  const { data, error } = await supabase
    .from("admin_ai_insights")
    .insert([{ type, result, created_at: new Date().toISOString() }]);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

/* ======================================================
   AI INSIGHTS SUMMARY
====================================================== */
router.get("/insights", auth, async (req, res) => {
  const { data: rows, error } = await supabase.from("admin_ai_insights").select("type, result");
  if (error) return res.status(500).json({ error: error.message });

  res.json({
    success: true,
    summary: {
      virus_scan: {
        passed: rows.filter(r => r.type === "virus_scan" && r.result === "passed").length,
        failed: rows.filter(r => r.type === "virus_scan" && r.result === "failed").length,
      },
      ai_upload: {
        success: rows.filter(r => r.type === "ai_upload" && r.result === "success").length,
        error: rows.filter(r => r.type === "ai_upload" && r.result === "error").length,
      },
    },
  });
});

export default router;
