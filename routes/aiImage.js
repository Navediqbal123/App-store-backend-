import express from "express";

const router = express.Router();

router.post("/generate", async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || !description) return res.status(400).json({ error: "Name and Description are required" });

        const iconPrompt = encodeURIComponent(
            `High quality mobile app icon for "${name}", ${description}. Modern flat design, vibrant gradient colors, centered logo symbol, clean minimalist style, professional app store icon, no text, sharp edges, 512x512`
        );

        const screen1Prompt = encodeURIComponent(
            `Professional mobile app UI screenshot for "${name}", ${description}. Modern dark theme, clean dashboard interface, beautiful typography, real app content visible, high resolution, pixel perfect design, Android app`
        );

        const screen2Prompt = encodeURIComponent(
            `Professional mobile app features screen for "${name}", ${description}. Light theme, elegant UI components, buttons cards and lists visible, modern material design, realistic app screenshot, high quality`
        );

        const icon_url = `https://image.pollinations.ai/prompt/${iconPrompt}?width=512&height=512&nologo=true&seed=${Date.now()}`;
        const screen1_url = `https://image.pollinations.ai/prompt/${screen1Prompt}?width=1080&height=1920&nologo=true&seed=${Date.now()+1}`;
        const screen2_url = `https://image.pollinations.ai/prompt/${screen2Prompt}?width=1080&height=1920&nologo=true&seed=${Date.now()+2}`;

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
