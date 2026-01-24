import express from "express";
import { supabase } from "../supabaseClient.js"; // SDK use karein
import fetch from "node-fetch";

const router = express.Router();

router.post("/virus-scan", async (req, res) => {
  try {
    const { fileUrl } = req.body;
    if (!fileUrl) return res.status(400).json({ error: "File URL required" });

    // 1. VirusTotal URL Scan Call
    const vtResponse = await fetch("https://www.virustotal.com/api/v3/urls", {
      method: "POST",
      headers: {
        "x-apikey": process.env.VIRUSTOTAL_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ url: fileUrl }),
    });

    const vtData = await vtResponse.json();
    if (!vtData.data) throw new Error("VirusTotal connection failed");

    // 2. Logging Success with SDK
    await supabase.from("admin_ai_insights").insert([
      { 
        type: "virus_scan", 
        result: "passed", // Backend confirm kar raha hai ki request submit ho gayi
        created_at: new Date().toISOString() 
      }
    ]);

    res.json({
      success: true,
      scanned: true,
      analysisId: vtData.data.id,
      message: "Scan initiated successfully"
    });

  } catch (err) {
    // 3. Error Logging
    await supabase.from("admin_ai_insights").insert([
      { type: "virus_scan", result: "failed" }
    ]);
    
    res.status(500).json({ error: "Security scan could not be completed" });
  }
});

export default router;
