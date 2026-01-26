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
   1. CREATE NEW APP (UPLOAD APK / AAB)
   ====================================================== */
// User ke snippet ke mutabiq 'app_file' field use kiya hai
router.post("/upload", upload.single("app_file"), async (req, res) => {
  try {
    const { 
      developer_id, 
      name, 
      description, 
      category, 
      version,
      size, // Additional fields from first snippet kept for completeness
      icon_url 
    } = req.body;
    
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "APK or AAB file is required" });
    }

    // 1. Storage mein upload (Bucket: 'apps')
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

    // 2. DB mein file_url aur metadata save
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
          category, // Matches your provided snippet
          version,
          file_url: urlData.publicUrl, // Matches your new SQL schema
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
   2. ADMIN – APPROVE / REJECT / TRENDING
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
   3. GET ALL APPS (ADMIN / STORE)
====================================================== */
router.get("/all", async (req, res) => {
  const { data, error } = await supabase.from("apps").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================
   4. GET APPROVED APPS (STORE)
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
   5. GET TRENDING / PROMOTED APPS
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
   6. SINGLE APP DETAIL
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
   7. DEVELOPER – MY APPS
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
     
