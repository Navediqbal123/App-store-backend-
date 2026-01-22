// ✅ START (ESM – सही)
import express from "express";
import multer from "multer";
import path from "path";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

// Memory storage for apk/aab uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ======================================================
   CREATE NEW APP (UPLOAD APK / AAB)
====================================================== */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { name, description, category, developerId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "File (APK or AAB) is required" });
    }

    const fileName = `uploads/${Date.now()}_${file.originalname}`;

    // Upload file to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("app-store-files")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const fileUrl = supabase.storage
      .from("app-store-files")
      .getPublicUrl(fileName).data.publicUrl;

    // Insert app record
    const { data, error } = await supabase.from("apps").insert([
      {
        name,
        description,
        category,
        developer_id: developerId,
        file_url: fileUrl,
        promoted: false,
        status: "pending",
      },
    ]);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, app: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   ADMIN – PROMOTE / UNPROMOTE APP
====================================================== */
router.post("/promote", async (req, res) => {
  try {
    const { appId, promoted } = req.body;

    const { data, error } = await supabase
      .from("apps")
      .update({ promoted })
      .eq("id", appId);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   GET ALL APPS (ADMIN / USER)
====================================================== */
router.get("/all", async (req, res) => {
  const { data, error } = await supabase.from("apps").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================
   GET PROMOTED APPS (HOME PAGE)
====================================================== */
router.get("/promoted", async (req, res) => {
  const { data, error } = await supabase
    .from("apps")
    .select("*")
    .eq("promoted", true);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================
   ✅ MISSING ROUTES (NOW ADDED)
====================================================== */

/* 1️⃣ ADMIN – APPS BY STATUS */
router.get("/status/:status", async (req, res) => {
  const { status } = req.params;

  const { data, error } = await supabase
    .from("apps")
    .select("*")
    .eq("status", status);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* 2️⃣ DEVELOPER – OWN APPS */
router.get("/developer/:developerId", async (req, res) => {
  const { developerId } = req.params;

  const { data, error } = await supabase
    .from("apps")
    .select("*")
    .eq("developer_id", developerId);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* 3️⃣ SINGLE APP DETAIL */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("apps")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
