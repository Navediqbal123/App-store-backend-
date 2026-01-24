import express from "express";
import multer from "multer";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

/* ======================================================
   MULTER SETUP (MEMORY)
====================================================== */
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ======================================================
   CREATE NEW APP (UPLOAD APK / AAB)
====================================================== */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const {
      name,
      description,
      category_id,
      developer_id,
      size,
      version,
      icon_url
    } = req.body;

    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "APK or AAB file is required" });
    }

    const fileName = `uploads/${Date.now()}_${file.originalname}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("app-store-files")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const apkUrl = supabase.storage
      .from("app-store-files")
      .getPublicUrl(fileName).data.publicUrl;

    // Insert App Record
    const { data, error } = await supabase
      .from("apps")
      .insert([
        {
          name,
          description,
          category_id: parseInt(category_id),
          developer_id,
          icon_url,
          apk_url: apkUrl,
          size,
          version,
          status: "pending",
          trending: false,
          downloads: 0,
          rating: 5.0,
          review_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, app: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   ADMIN – APPROVE / REJECT / TRENDING
====================================================== */
router.post("/update-status", async (req, res) => {
  try {
    const { appId, status, trending } = req.body;

    const { data, error } = await supabase
      .from("apps")
      .update({
        status,
        trending,
        updated_at: new Date().toISOString()
      })
      .eq("id", appId)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, app: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   GET ALL APPS (ADMIN / STORE)
====================================================== */
router.get("/all", async (req, res) => {
  const { data, error } = await supabase.from("apps").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================
   GET APPROVED APPS (STORE)
====================================================== */
router.get("/store/all", async (req, res) => {
  const { data, error } = await supabase
    .from("apps")
    .select("*, categories(name)")
    .eq("status", "approved");

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================
   GET TRENDING / PROMOTED APPS
====================================================== */
router.get("/trending", async (req, res) => {
  const { data, error } = await supabase
    .from("apps")
    .select("*")
    .eq("trending", true);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================
   ADMIN – APPS BY STATUS
====================================================== */
router.get("/status/:status", async (req, res) => {
  const { data, error } = await supabase
    .from("apps")
    .select("*")
    .eq("status", req.params.status);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================
   SINGLE APP DETAIL
====================================================== */
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("apps")
    .select("*, categories(name)")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================
   DEVELOPER – MY APPS
====================================================== */
router.get("/developer/:devId", async (req, res) => {
  const { data, error } = await supabase
    .from("apps")
    .select("*")
    .eq("developer_id", req.params.devId);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
