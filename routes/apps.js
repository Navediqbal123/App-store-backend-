// ✅ START (ESM – सही)
import express from "express";
import multer from "multer";
import path from "path";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

// Memory storage for apk/aab uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create new App (with APK/AAB upload)
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { name, description, category, developerId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "File (APK or AAB) is required" });
    }

    const fileExt = path.extname(file.originalname);
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

    // Insert App record in DB
    const { data, error } = await supabase.from("apps").insert([
      {
        name,
        description,
        category,
        developer_id: developerId,
        file_url: fileUrl,
        promoted: false, // default promotion status
      },
    ]);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      message: "App uploaded successfully!",
      app: data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Mark app as Promoted
router.post("/promote", async (req, res) => {
  try {
    const { appId, promoted } = req.body;

    const { data, error } = await supabase
      .from("apps")
      .update({ promoted })
      .eq("id", appId);

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: promoted ? "App promoted!" : "App un-promoted!",
      data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all apps (developer + users)
router.get("/all", async (req, res) => {
  try {
    const { data, error } = await supabase.from("apps").select("*");

    if (error) return res.status(400).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get promoted apps
router.get("/promoted", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("apps")
      .select("*")
      .eq("promoted", true);

    if (error) return res.status(400).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
