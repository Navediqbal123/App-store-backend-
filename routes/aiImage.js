import express from "express";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

router.post("/generate", async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || !description) return res.status(400).json({ error: "Name and Description are required" });

        const encodedIcon = encodeURIComponent(`Professional app icon for '${name}': ${description}. Flat vector style.`);
        const encodedScreen1 = encodeURIComponent(`Mobile app screenshot for '${name}': Main interface, professional UI.`);
        const encodedScreen2 = encodeURIComponent(`Mobile app screenshot for '${name}': Feature showcase, clean design.`);

        // ✅ Seedha Pollinations URL return karo - download/upload nahi
        const icon_url = `https://image.pollinations.ai/prompt/${encodedIcon}?width=512&height=512&nologo=true`;
        const screen1_url = `https://image.pollinations.ai/prompt/${encodedScreen1}?width=1024&height=1024&nologo=true`;
        const screen2_url = `https://image.pollinations.ai/prompt/${encodedScreen2}?width=1024&height=1024&nologo=true`;

        res.json({
            success: true,
            icon_url,
            screenshot_urls: [screen1_url, screen2_url],
            message: "Images generated successfully!"
        });

    } catch (error) {
        console.error("Backend Error:", error.message);
        res.status(500).json({ 
            success: false, 
            error: "Generation failed", 
            details: error.message 
        });
    }
});

export default router;
