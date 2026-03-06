import express from "express";
import axios from "axios";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

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

        const imageConfigs = [
            { type: 'icon', prompt: `Professional 512x512 app icon for '${name}': ${description}. High-quality, flat vector.` },
            { type: 'screen1', prompt: `Mobile app screenshot for '${name}': Main interface, high resolution, professional UI.` },
            { type: 'screen2', prompt: `Mobile app screenshot for '${name}': Feature showcase, clean design.` }
        ];

        const generatedData = await Promise.all(imageConfigs.map(async (config) => {
            // FIX: Using a more stable OpenRouter model and checking both possible response paths
            const aiRes = await axios.post("https://openrouter.ai/api/v1/images/generations", {
                model: "black-forest-labs/flux-1-schnell", // Much more stable on OpenRouter
                prompt: config.prompt,
                size: "1024x1024" 
            }, { 
                headers: { 
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://lovable.dev",
                    "X-Title": "App Store AI"
                } 
            });
            
            // Fix for different API response structures
            const imageUrl = aiRes.data.data?.[0]?.url || aiRes.data?.[0]?.url;
            if (!imageUrl) throw new Error(`AI returned: ${JSON.stringify(aiRes.data)}`);
            
            return { type: config.type, url: imageUrl };
        }));

        const timestamp = Date.now();
        const folderName = name.replace(/\s+/g, '_').toLowerCase();
        
        const finalUrls = await Promise.all(generatedData.map(img => 
            uploadToSupabase(img.url, `${folderName}/${img.type}_${timestamp}.png`)
        ));

        res.json({
            success: true,
            icon_url: finalUrls[0],
            screenshot_urls: [finalUrls[1], finalUrls[2]],
            message: "All images generated and saved permanently!"
        });

    } catch (error) {
        console.error("Backend Error Detail:", error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: "Generation or Storage failed", 
            details: error.response?.data?.error?.message || error.message 
        });
    }
});

export default router;
