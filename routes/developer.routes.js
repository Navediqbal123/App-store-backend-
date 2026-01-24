import express from "express";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

/* ======================================================
   1. GET ALL DEVELOPERS (Admin Only)
   ====================================================== */
router.get("/all", async (req, res) => {
  const { data, error } = await supabase.from("developers").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================
   2. DEVELOPER REGISTRATION (Fixed Column Name)
   ====================================================== */
router.post("/register", async (req, res) => {
  // Database schema match ke liye 'developer_name' use kiya
  const { user_id, developer_name, bio, website } = req.body; 
  
  const { data, error } = await supabase.from("developers").insert([
    { 
      user_id, 
      developer_name, // 👈 Table column match: 'developer_name'
      bio, 
      website, 
      status: "pending" 
    }
  ]).select();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data[0] });
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
        
