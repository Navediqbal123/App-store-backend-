import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js"; 

/* 🔹 ROUTES IMPORT */
import appsRoutes from "./routes/apps.js";
import adminStatsRoutes from "./routes/adminStats.routes.js";
import adminInsightsRoutes from "./routes/adminInsights.routes.js";
import developerRoutes from "./routes/developer.routes.js"; // ✅ Naya Import Added
// ... baki imports (virusScan, aiUpload, etc.) waise hi rakhein

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* 🔹 MOUNT ROUTES (Clean Architecture) */
app.use("/api/apps", appsRoutes);              
app.use("/api/admin/stats", adminStatsRoutes);   
app.use("/api/admin/insights", adminInsightsRoutes); 
app.use("/api/developers", developerRoutes); // ✅ Naya Route Mount Added

/* -----------------------------------
   AUTH LOGIN (Inline)
------------------------------------ */
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  
  const { data: u, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !u) return res.status(400).json({ error: "User not found" });

  res.json({ user: u }); 
});

/* -----------------------------------
   ROOT & START
------------------------------------ */
app.get("/", (_, res) => res.send("🔥 App Store Backend Running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
