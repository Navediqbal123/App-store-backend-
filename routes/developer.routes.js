import express from "express";
import multer from "multer";
import { supabase } from "../supabaseClient.js";
import { verifyToken } from "../middleware/auth.js"; // 👈 Middleware Import kiya

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/* ======================================================
   1. GET ALL DEVELOPERS (Admin Only) - Protected
   ====================================================== */
router.get("/all", verifyToken, async (req, res) => { // 👈 verifyToken add kiya
  const { data, error } = await supabase.from("developers").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================
   2. DEVELOPER REGISTRATION - Protected
   ====================================================== */
router.post("/register", verifyToken, upload.single("id_file"), async (req, res) => { // 👈 verifyToken add kiya
  try {
    const { user_id, developer_name, bio, website } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "ID Document is required" });

    const fileName = `ids/${Date.now()}-${file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("developer-ids")
      .upload(fileName, file.buffer, { contentType: file.mimetype });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("developer-ids").getPublicUrl(fileName);

    const { data, error } = await supabase.from("developers").insert([
      { 
        user_id, 
        developer_name, 
        bio, 
        website, 
        id_document_url: urlData.publicUrl, 
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
   3. ADMIN - APPROVE/REJECT DEVELOPER - Protected
   ====================================================== */
router.post("/update-status", verifyToken, async (req, res) => { // 👈 verifyToken add kiya
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
