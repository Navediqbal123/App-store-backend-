import express from "express";
import multer from "multer"; // Added Multer for File Upload
import { supabase } from "../supabaseClient.js";

const router = express.Router();

// Multer Setup (Memory Storage)
const upload = multer({ storage: multer.memoryStorage() });

/* ======================================================
   1. GET ALL DEVELOPERS (Admin Only)
   ====================================================== */
router.get("/all", async (req, res) => {
  const { data, error } = await supabase.from("developers").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================
   2. DEVELOPER REGISTRATION (With ID Upload)
   ====================================================== */
router.post("/register", upload.single("id_file"), async (req, res) => {
  try {
    const { user_id, developer_name, bio, website } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "ID Document is required" });
    }

    // 1. Storage mein upload
    const fileName = `ids/${Date.now()}-${file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("developer-ids")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
      });

    if (uploadError) throw uploadError;

    // 2. DB mein URL aur Metadata save
    const { data: urlData } = supabase.storage
      .from("developer-ids")
      .getPublicUrl(fileName);

    const { data, error } = await supabase.from("developers").insert([
      { 
        user_id, 
        developer_name, // Table column match
        bio, 
        website, 
        id_document_url: urlData.publicUrl, // URL column
        status: "pending" 
      }
    ]).select();

    if (error) throw error;
    res.json({ success: true, data: data[0] });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   3. ADMIN - APPROVE/REJECT DEVELOPER
   ====================================================== */
router.post("/update-status", async (req, res) => {
  const { devId, status } = req.body;
  const { data, error } = await supabase
    .from("developers")
    .update({ status })
    .eq("id", devId)
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true, data: data[0] });
});

export default router;
