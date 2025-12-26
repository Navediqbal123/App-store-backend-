const express = require("express");
const router = express.Router();
const { supabase } = require("../supabaseClient");

router.post("/log-security", async (req, res) => {
  const { virusDetected } = req.body;

  await supabase.from("admin_stats").insert([
    {
      virus_detected: virusDetected
    }
  ]);

  res.json({ success: true });
});

router.get("/stats", async (req, res) => {
  const { data } = await supabase
    .from("admin_stats")
    .select("*");

  res.json(data);
});

module.exports = router;
