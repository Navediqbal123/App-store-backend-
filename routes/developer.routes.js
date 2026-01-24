import express from "express";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

// 1. Get All Developers (Admin ke liye)
router.get("/all", async (req, res) => {
  const { data, error } = await supabase.from("developers").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 2. Developer Registration / Profile Create
router.post("/register", async (req, res) => {
  const { user_id, name, bio, website } = req.body;
  const { data, error } = await supabase.from("developers").insert([
    { user_id, name, bio, website, status: "pending" }
  ]).select();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data[0] });
});

// 3. Admin - Approve/Reject Developer
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

