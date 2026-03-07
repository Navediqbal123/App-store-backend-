import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { supabase } from "./supabaseClient.js"; 

/* 🔹 ROUTES IMPORT */
import appsRoutes from "./routes/apps.js";
import adminStatsRoutes from "./routes/adminStats.routes.js";
import adminInsightsRoutes from "./routes/adminInsights.routes.js";
import developerRoutes from "./routes/developer.routes.js";
import virusScanRoutes from "./routes/virusScan.routes.js";
import aiUploadRoutes from "./routes/aiUpload.routes.js";
import chatbotRoutes from "./routes/chatbot.routes.js";
import cloneCheckRoutes from "./routes/cloneCheck.routes.js";
import aiImageRoutes from "./routes/aiImage.js";

dotenv.config();
const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "10mb" }));

/* 🔹 MOUNT ROUTES */
app.use("/api/apps", appsRoutes);              
app.use("/api/admin/stats", adminStatsRoutes);   
app.use("/api/admin/insights", adminInsightsRoutes); 
app.use("/api/developers", developerRoutes);
app.use("/api/virus-scan", virusScanRoutes);
app.use("/api/ai-upload", aiUploadRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/clone-check", cloneCheckRoutes);
app.use("/api/ai-image", aiImageRoutes);

/* -----------------------------------
   AUTH LOGIN (Fixed with Token)
------------------------------------ */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data: u, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !u) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, u.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: u.id, email: u.email, role: u.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: "7d" }
    );

    delete u.password;

    res.json({ success: true, token, user: u });

  } catch (err) {
    res.status(500).json({ error: "Login error", details: err.message });
  }
});

/* -----------------------------------
   ROOT & START
------------------------------------ */
app.get("/", (_, res) => res.send("🔥 App Store Backend Running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
