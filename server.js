/* -----------------------------------
APP STORE BACKEND - FINAL + UPLOADS ENDPOINTS ADDED
------------------------------------ */

import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // allow larger payloads for metadata

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

const defaultHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

/* -----------------------------------
SUPABASE HELPERS
------------------------------------ */
async function sbGet(table, query = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers: defaultHeaders,
  });
  return res.json();
}

async function sbPost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: defaultHeaders,
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sbPatch(table, query, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method: "PATCH",
    headers: defaultHeaders,
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sbDelete(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method: "DELETE",
    headers: defaultHeaders,
  });
  return res.json();
}

/* -----------------------------------
JWT AUTH
------------------------------------ */
function createToken(id) {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decode = jwt.verify(token, JWT_SECRET);
    req.userId = decode.id;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* -----------------------------------
ADMIN CHECK
------------------------------------ */
async function isAdmin(userId) {
  const user = await sbGet("users", `?id=eq.${userId}&select=role`);
  return user?.[0]?.role === "admin";
}

/* -----------------------------------
ROOT
------------------------------------ */
app.get("/", (req, res) => {
  res.send("🔥 Backend Running");
});

/* -----------------------------------
AUTH
------------------------------------ */
app.post("/auth/signup", async (req, res) => {
  const { email, password, name } = req.body;
  const existing = await sbGet("users", `?email=eq.${encodeURIComponent(email)}&select=id`);
  if (existing?.length) return res.status(400).json({ error: "Email exists" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await sbPost("users", {
    email,
    password: hashed,
    name,
    role: "user",
    created_at: new Date().toISOString(),
  });
  res.json({ success: true, user });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const userData = await sbGet("users", `?email=eq.${encodeURIComponent(email)}&select=*`);
  if (!userData?.length) return res.status(400).json({ error: "User not found" });

  const user = userData[0];
  const match = await bcrypt.compare(password, user.password || "");
  if (!match) return res.status(400).json({ error: "Wrong password" });

  const token = createToken(user.id);
  delete user.password;
  res.json({ token, user });
});

app.get("/auth/me", auth, async (req, res) => {
  const user = await sbGet("users", `?id=eq.${req.userId}&select=*`);
  if (!user?.length) return res.status(404).json({ error: "User not found" });
  delete user[0].password;
  res.json(user[0]);
});

/* -----------------------------------
APPS CRUD (existing)
------------------------------------ */
app.post("/apps", auth, async (req, res) => {
  const data = {
    ...req.body,
    user_id: req.userId,
    promoted: false,
    downloads: 0,
    created_at: new Date().toISOString(),
    status: req.body.status || "approved", // keep backward-compatible
  };
  const out = await sbPost("apps", data);
  res.json(out);
});

app.get("/apps", async (req, res) => {
  const apps = await sbGet("apps", "?select=*&status=eq.approved"); // show only approved on store
  res.json(apps);
});

app.get("/apps/:id", async (req, res) => {
  const app = await sbGet("apps", `?id=eq.${encodeURIComponent(req.params.id)}&select=*`);
  res.json(app?.[0] || null);
});

app.put("/apps/:id", auth, async (req, res) => {
  const data = await sbGet("apps", `?id=eq.${encodeURIComponent(req.params.id)}&select=user_id`);
  if (!data?.length) return res.status(404).json({ error: "App not found" });
  const owner = data[0].user_id;
  if (req.userId !== owner && !(await isAdmin(req.userId))) return res.status(403).json({ error: "Not allowed" });
  const result = await sbPatch("apps", `?id=eq.${encodeURIComponent(req.params.id)}`, req.body);
  res.json(result);
});

app.delete("/apps/:id", auth, async (req, res) => {
  const data = await sbGet("apps", `?id=eq.${encodeURIComponent(req.params.id)}&select=user_id`);
  if (!data?.length) return res.status(404).json({ error: "App not found" });
  const owner = data[0].user_id;
  if (req.userId !== owner && !(await isAdmin(req.userId))) return res.status(403).json({ error: "Not allowed" });
  const result = await sbDelete("apps", `?id=eq.${encodeURIComponent(req.params.id)}`);
  res.json(result);
});

/* -----------------------------------
NEW: DEVELOPER UPLOAD FLOW (metadata endpoints)
------------------------------------ */

/**
 * POST /developer/apps/upload
 * Body (JSON) expected:
 * {
 *  "name":"My App",
 *  "package_id":"com.example.app",
 *  "description":"desc",
 *  "category":"games",
 *  "logo_url":"https://.../logo.png",        // frontend should upload to Supabase storage and send URL
 *  "apk_url":"https://.../file.apk",         // OR null
 *  "aab_url":"https://.../file.aab",         // OR null
 *  "version_code": 12,
 *  "version_name":"1.2.0",
 *  "changelog":"fixed bugs",
 *  "screenshots": ["https://.../s1.png","..."]
 * }
 *
 * Creates an app record with status = "pending"
 */
app.post("/developer/apps/upload", auth, async (req, res) => {
  try {
    const body = req.body;
    // minimal validation
    if (!body.name || !body.package_id) return res.status(400).json({ error: "name and package_id required" });

    const payload = {
      name: body.name,
      package_id: body.package_id,
      description: body.description || null,
      category: body.category || null,
      logo_url: body.logo_url || null,
      apk_url: body.apk_url || null,
      aab_url: body.aab_url || null,
      version_code: body.version_code || null,
      version_name: body.version_name || null,
      changelog: body.changelog || null,
      screenshots: body.screenshots || [],
      user_id: req.userId,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    const result = await sbPost("apps", payload);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /developer/apps/my
 * Returns apps uploaded by logged-in developer (all statuses)
 */
app.get("/developer/apps/my", auth, async (req, res) => {
  try {
    const rows = await sbGet("apps", `?user_id=eq.${encodeURIComponent(req.userId)}&select=*`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /developer/apps/update/:id
 * Developer uploads a new version for an app.
 * Body same as upload (only fields to update). This will set status -> "pending".
 */
app.post("/developer/apps/update/:id", auth, async (req, res) => {
  try {
    const appId = req.params.id;
    // check ownership
    const rows = await sbGet("apps", `?id=eq.${encodeURIComponent(appId)}&select=user_id`);
    if (!rows?.length) return res.status(404).json({ error: "App not found" });
    if (rows[0].user_id !== req.userId && !(await isAdmin(req.userId))) return res.status(403).json({ error: "Not allowed" });

    const updatePayload = {
      ...req.body,
      status: "pending",
      updated_at: new Date().toISOString(),
    };
    const r = await sbPatch("apps", `?id=eq.${encodeURIComponent(appId)}`, updatePayload);
    res.json({ success: true, data: r });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------------------
NEW: ADMIN PENDING / APPROVE / REJECT
------------------------------------ */

/**
 * GET /admin/apps/pending
 * Admin-only: list pending apps
 */
app.get("/admin/apps/pending", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) return res.status(403).json({ error: "Admin only" });
    const pending = await sbGet("apps", `?status=eq.pending&select=*`);
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /admin/apps/approve/:id
 * Admin-only: approve app (status -> approved)
 * body optional: { notes: "..." }
 */
app.post("/admin/apps/approve/:id", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) return res.status(403).json({ error: "Admin only" });
    const id = req.params.id;
    const r = await sbPatch("apps", `?id=eq.${encodeURIComponent(id)}`, {
      status: "approved",
      approved_by: req.userId,
      approved_at: new Date().toISOString(),
      notes: req.body.notes || null,
    });
    res.json({ success: true, data: r });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /admin/apps/reject/:id
 * Admin-only: reject app (status -> rejected)
 * body: { reason: "..." }
 */
app.post("/admin/apps/reject/:id", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) return res.status(403).json({ error: "Admin only" });
    const id = req.params.id;
    const r = await sbPatch("apps", `?id=eq.${encodeURIComponent(id)}`, {
      status: "rejected",
      rejected_by: req.userId,
      rejected_at: new Date().toISOString(),
      reject_reason: req.body.reason || null,
    });
    res.json({ success: true, data: r });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------------------
ADMIN STATS / DASHBOARD (existing)
------------------------------------ */
app.get("/admin/stats", auth, async (req, res) => {
  if (!(await isAdmin(req.userId))) return res.status(403).json({ error: "Admin only" });
  const users = await sbGet("users", "?select=id");
  const apps = await sbGet("apps", "?select=id");
  res.json({
    users: users?.length || 0,
    apps: apps?.length || 0,
  });
});

app.get("/admin/dashboard", auth, async (req, res) => {
  if (!(await isAdmin(req.userId))) return res.status(403).json({ error: "Admin only" });
  const latest = await sbGet("apps", "?select=*&order=created_at.desc&limit=10");
  res.json({ latest });
});

/* -----------------------------------
START SERVER
------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
