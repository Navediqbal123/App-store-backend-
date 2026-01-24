import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js"; // SDK use karein, fetch nahi

/* 🔹 ROUTES IMPORT */
import appsRoutes from "./routes/apps.js";
import adminStatsRoutes from "./routes/adminStats.routes.js";
import adminInsightsRoutes from "./routes/adminInsights.routes.js";
// ... baki imports (virusScan, aiUpload, etc.) waise hi rakhein

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* 🔹 MOUNT ROUTES (Clean Architecture) */
// Jo routes humne fix kiye hain, unhe sahi path par lagayein
app.use("/api/apps", appsRoutes);              // Saari apps aur upload logic yahan hai
app.use("/api/admin/stats", adminStatsRoutes);   // /api/admin/stats/summary
app.use("/api/admin/insights", adminInsightsRoutes); // /api/admin/insights/update

/* -----------------------------------
   AUTH LOGIN (Inline)
------------------------------------ */
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  
  // Seedha Supabase Auth ya Users table check karein
  const { data: u, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !u) return res.status(400).json({ error: "User not found" });

  // Note: Password bcrypt check yahan rahega
  res.json({ user: u }); 
});

/* -----------------------------------
   ROOT & START
------------------------------------ */
app.get("/", (_, res) => res.send("🔥 App Store Backend Running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
