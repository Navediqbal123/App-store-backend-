import express from "express";
import multer from "multer";
import { supabase } from "../supabaseClient.js";
import { verifyToken } from "../middleware/auth.js"; // 👈 Middleware Import kiya

const router = express.Router();

/* ======================================================
   MULTER SETUP (MEMORY)
====================================================== */
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ======================================================
   1. CREATE NEW APP (UPLOAD APK / AAB) - Protected
   ====================================================== */
router.post("/upload", verifyToken, upload.single("app_file"), async (req, res) => { // 👈 verifyToken added
  try {
    const { 
      developer_id, 
      name, 
      description, 
      category, 
      version,
      size,
      icon_url 
    } = req.body;
    
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "APK or AAB file is required" });
    }

    const fileName = `apps/${Date.now()}-${file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("apps")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: urlData } = supabase.storage
      .from("apps")
      .getPublicUrl(fileName);

    const { data, error } = await supabase
      .from("apps")
      .insert([
        {
          developer_id,
          name,
          description,
          category,
          version,
          file_url: urlData.publicUrl,
          size: size || "0 MB",
          icon_url: icon_url || "",
          status: "pending",
          trending: false,
          downloads: 0,
          rating: 5.0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   2. ADMIN – APPROVE / REJECT / TRENDING - Protected
   ====================================================== */
router.post("/update-status", verifyToken, async (req, res) => { // 👈 verifyToken added
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
   3. GET ALL APPS (ADMIN / STORE) - Protected
   ====================================================== */
router.get("/all", verifyToken, async (req, res) => { // 👈 verifyToken added
  const { data, error } = await supabase.from("apps").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================
   4. GET APPROVED APPS (STORE) - Public
   ====================================================== */
router.get("/store/all", async (req, res) => {
  const { data, error } = await supabase
    .from("apps")
    .select("*")
    .eq("status", "approved");

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================
   5. GET TRENDING / PROMOTED APPS - Public
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
   6. SINGLE APP DETAIL - Public
   ====================================================== */
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("apps")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================
   7. DEVELOPER – MY APPS - Protected
   ====================================================== */
router.get("/developer/:devId", verifyToken, async (req, res) => { // 👈 verifyToken added
  const { data, error } = await supabase
    .from("apps")
    .select("*")
    .eq("developer_id", req.params.devId);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
