import express from "express";
import axios from "axios";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

// Helper function to download and upload to Supabase
async function uploadToSupabase(url, fileName) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const { data, error } = await supabase.storage
        .from('apps')
        .upload(fileName, response.data, { contentType: 'image/png', upsert: true });
    
    if (error) throw error;
    return supabase.storage.from('apps').getPublicUrl(fileName).data.publicUrl;
}

router.post("/generate", async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || !description) return res.status(400).json({ error: "Name and Description are required" });

        // 1. Prompts for Premium Quality
        const imageConfigs = [
            { type: 'icon', prompt: `Professional 512x512 app icon for '${name}': ${description}. High-quality, flat vector, modern app store style.` },
            { type: 'screen1', prompt: `Mobile app screenshot for '${name}': Main interface, high resolution, professional UI.` },
            { type: 'screen2', prompt: `Mobile app screenshot for '${name}': Feature showcase, clean design.` }
        ];

        // 2. Generate Images via OpenRouter (Updated Endpoint & Model)
        const generatedData = await Promise.all(imageConfigs.map(async (config) => {
            // OpenRouter ke liye "openai/dall-e-3" ya "google/imagen-3" best hain
            const aiRes = await axios.post("https://openrouter.ai/api/v1/images/generations", {
                model: "openai/dall-e-3", 
                prompt: config.prompt,
                response_format: "url"
            }, { 
                headers: { 
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://lovable.dev", // OpenRouter requires this
                    "X-Title": "App Store AI"
                } 
            });
            
            if (!aiRes.data.data || !aiRes.data.data[0]) throw new Error("AI Generation returned no data");
            return { type: config.type, url: aiRes.data.data[0].url };
        }));

        // 3. Upload to Supabase to make them Permanent
        const timestamp = Date.now();
        const folderName = name.replace(/\s+/g, '_').toLowerCase();
        
        const finalUrls = await Promise.all(generatedData.map(img => 
            uploadToSupabase(img.url, `${folderName}/${img.type}_${timestamp}.png`)
        ));

        // 4. Send Clean Response
        res.json({
            success: true,
            icon_url: finalUrls[0],
            screenshot_urls: [finalUrls[1], finalUrls[2]],
            message: "All images generated and saved permanently!"
        });

    } catch (error) {
        // Detailed error logging for Render
        console.error("Backend Error Detail:", error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: "Generation or Storage failed", 
            details: error.response?.data?.error?.message || error.message 
        });
    }
});

export default router;
