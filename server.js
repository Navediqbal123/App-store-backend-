/* -----------------------------------
APP STORE BACKEND - FINAL (COMPLETE)
------------------------------------ */

import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import fetch from "node-fetch";

/* 🔹 ROUTES */
import virusScanRoutes from "./routes/virusScan.routes.js";
import aiUploadRoutes from "./routes/aiUpload.routes.js";
import chatbotRoutes from "./routes/chatbot.routes.js";
import adminStatsRoutes from "./routes/adminStats.routes.js";
import adminInsightsRoutes from "./routes/adminInsights.routes.js";
import cloneCheckRoutes from "./routes/cloneCheck.routes.js";
import promotionRoutes from "./routes/promotions.routes.js";
import developerAppsRoutes from "./routes/apps.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* 🔹 REGISTER ROUTES */
app.use("/api", virusScanRoutes);
app.use("/api", aiUploadRoutes);
app.use("/api", chatbotRoutes);
app.use("/api", cloneCheckRoutes);
app.use("/api/promotions", promotionRoutes);
app.use("/api/admin", adminStatsRoutes);
app.use("/api/admin", adminInsightsRoutes);
app.use("/api/developer/apps", developerAppsRoutes);

/* -----------------------------------
ENV
------------------------------------ */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
  console.log("❌ Missing env");
  process.exit(1);
}

/* -----------------------------------
SUPABASE HEADERS
------------------------------------ */
const defaultHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

/* -----------------------------------
SUPABASE HELPERS
------------------------------------ */
async function sbGet(table, query = "") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers: defaultHeaders,
  });
  return r.json();
}

async function sbPost(table, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: defaultHeaders,
    body: JSON.stringify(body),
  });
  return r.json();
}

async function sbPatch(table, query, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method: "PATCH",
    headers: defaultHeaders,
    body: JSON.stringify(body),
  });
  return r.json();
}

/* -----------------------------------
AUTH
------------------------------------ */
function createToken(id) {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const d = jwt.verify(token, JWT_SECRET);
    req.userId = d.id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

async function isAdmin(userId) {
  const u = await sbGet("users", `?id=eq.${userId}&select=role`);
  return u?.[0]?.role === "admin";
}

/* -----------------------------------
ROOT
------------------------------------ */
app.get("/", (_, res) => res.send("🔥 Backend Running"));

/* -----------------------------------
AUTH LOGIN
------------------------------------ */
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const u = await sbGet(
    "users",
    `?email=eq.${encodeURIComponent(email)}&select=*`
  );

  if (!u?.length) return res.status(400).json({ error: "User not found" });

  const ok = await bcrypt.compare(password, u[0].password || "");
  if (!ok) return res.status(400).json({ error: "Wrong password" });

  const token = createToken(u[0].id);
  delete u[0].password;
  res.json({ token, user: u[0] });
});

/* -----------------------------------
PUBLIC APP STORE
------------------------------------ */
app.get("/apps", async (req, res) => {
  const apps = await sbGet("apps", "?status=eq.approved&select=*");
  res.json(apps);
});

/* -----------------------------------
DEVELOPER PROFILE (MISSING – FIXED)
------------------------------------ */
app.get("/api/developer/profile", auth, async (req, res) => {
  const data = await sbGet(
    "developer_profiles",
    `?user_id=eq.${req.userId}&select=*`
  );
  res.json(data);
});

app.post("/api/developer/profile", auth, async (req, res) => {
  const payload = {
    ...req.body,
    user_id: req.userId,
    created_at: new Date().toISOString(),
  };
  const out = await sbPost("developer_profiles", payload);
  res.json(out);
});

/* -----------------------------------
DEVELOPER APPS LIST (MISSING – FIXED)
------------------------------------ */
app.get("/api/developer/apps", auth, async (req, res) => {
  const apps = await sbGet(
    "apps",
    `?user_id=eq.${req.userId}&select=*`
  );
  res.json(apps);
});

/* -----------------------------------
DEVELOPER UPDATE APP (MISSING – FIXED)
------------------------------------ */
app.post("/api/developer/apps/update/:id", auth, async (req, res) => {
  const id = req.params.id;

  const out = await sbPatch("apps", `?id=eq.${id}`, {
    ...req.body,
    status: "pending",
    updated_at: new Date().toISOString(),
  });

  res.json({ success: true, data: out });
});

/* -----------------------------------
ADMIN – ALL APPS LIST (MISSING – FIXED)
------------------------------------ */
app.get("/admin/apps", auth, async (req, res) => {
  if (!(await isAdmin(req.userId)))
    return res.status(403).json({ error: "Admin only" });

  const apps = await sbGet("apps", "?select=*");
  res.json(apps);
});

/* -----------------------------------
ADMIN APPROVE APP
------------------------------------ */
app.post("/admin/apps/approve/:id", auth, async (req, res) => {
  if (!(await isAdmin(req.userId)))
    return res.status(403).json({ error: "Admin only" });

  const out = await sbPatch("apps", `?id=eq.${req.params.id}`, {
    status: "approved",
    approved_by: req.userId,
    approved_at: new Date().toISOString(),
  });

  res.json(out);
});

/* -----------------------------------
START SERVER
------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);
