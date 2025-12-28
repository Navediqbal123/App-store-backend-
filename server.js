/* -----------------------------------
APP STORE BACKEND - FINAL (AUTO VERSION + CLONE CHECK ADDED)
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
import adminStatsRoutes from "./routes/adminStats.routes.js";
import chatbotRoutes from "./routes/chatbot.routes.js";
import adminInsightsRoutes from "./routes/adminInsights.routes.js";
import cloneCheckRoutes from "./routes/cloneCheck.routes.js";
import promotionRoutes from "./routes/promotions.routes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* 🔹 REGISTER ROUTES */
app.use("/api", virusScanRoutes);
app.use("/api", aiUploadRoutes);
app.use("/api", chatbotRoutes);
app.use("/api", cloneCheckRoutes);
app.use("/api/admin", adminStatsRoutes);
app.use("/api/admin", adminInsightsRoutes);
app.use("/api/promotions", promotionRoutes);

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

async function sbDelete(table, query) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method: "DELETE",
    headers: defaultHeaders,
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
AUTH ROUTES
------------------------------------ */
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const u = await sbGet("users", `?email=eq.${encodeURIComponent(email)}&select=*`);
  if (!u?.length) return res.status(400).json({ error: "User not found" });
  const ok = await bcrypt.compare(password, u[0].password || "");
  if (!ok) return res.status(400).json({ error: "Wrong password" });
  const token = createToken(u[0].id);
  delete u[0].password;
  res.json({ token, user: u[0] });
});

/* -----------------------------------
DEVELOPER UPLOAD (AUTO VERSION + CLONE CHECK)
------------------------------------ */
app.post("/developer/apps/upload", auth, async (req, res) => {
  try {
    const body = req.body;
    if (!body.name || !body.package_id)
      return res.status(400).json({ error: "name & package_id required" });

    /* 🔹 CLONE CHECK */
    const clone = await sbGet(
      "apps",
      `?package_id=eq.${body.package_id}&select=id`
    );
    if (clone.length) {
      return res.status(409).json({
        clone: true,
        message: "App with same package already exists",
      });
    }

    /* 🔹 AUTO VERSION CODE */
    const last = await sbGet(
      "apps",
      `?package_id=eq.${body.package_id}&order=version_code.desc&limit=1&select=version_code`
    );
    const nextVersionCode =
      last?.length && last[0].version_code ? last[0].version_code + 1 : 1;

    const payload = {
      name: body.name,
      package_id: body.package_id,
      description: body.description || null,
      category: body.category || null,
      logo_url: body.logo_url || null,
      apk_url: body.apk_url || null,
      aab_url: body.aab_url || null,
      version_code: nextVersionCode, // ✅ AUTO
      version_name: body.version_name || null,
      changelog: body.changelog || null,
      screenshots: body.screenshots || [],
      user_id: req.userId,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    const out = await sbPost("apps", payload);
    res.json({ success: true, data: out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* -----------------------------------
UPDATE APP (AUTO VERSION INCREMENT)
------------------------------------ */
app.post("/developer/apps/update/:id", auth, async (req, res) => {
  try {
    const id = req.params.id;
    const cur = await sbGet("apps", `?id=eq.${id}&select=user_id,version_code`);
    if (!cur.length) return res.status(404).json({ error: "Not found" });
    if (cur[0].user_id !== req.userId && !(await isAdmin(req.userId)))
      return res.status(403).json({ error: "Not allowed" });

    const nextVersionCode = (cur[0].version_code || 0) + 1;

    const out = await sbPatch("apps", `?id=eq.${id}`, {
      ...req.body,
      version_code: nextVersionCode,
      status: "pending",
      updated_at: new Date().toISOString(),
    });

    res.json({ success: true, data: out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* -----------------------------------
ADMIN APPROVAL
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
START
------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);
