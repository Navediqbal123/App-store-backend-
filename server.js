/* -----------------------------------
APP STORE BACKEND - FINAL STABLE VERSION
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
app.use(express.json());

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
SUPABASE HELPERS (FIXED PATHS)
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
ADMIN CHECK (FINAL FIXED)
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

  const existing = await sbGet("users", `?email=eq.${email}&select=id`);
  if (existing.length) return res.status(400).json({ error: "Email exists" });

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

  const userData = await sbGet("users", `?email=eq.${email}&select=*`);
  if (!userData.length)
    return res.status(400).json({ error: "User not found" });

  const user = userData[0];

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: "Wrong password" });

  const token = createToken(user.id);
  delete user.password;

  res.json({ token, user });
});

app.get("/auth/me", auth, async (req, res) => {
  const user = await sbGet("users", `?id=eq.${req.userId}&select=*`);
  delete user[0].password;
  res.json(user[0]);
});

/* -----------------------------------
APPS CRUD
------------------------------------ */
app.post("/apps", auth, async (req, res) => {
  const data = {
    ...req.body,
    user_id: req.userId,
    promoted: false,
    downloads: 0,
    created_at: new Date().toISOString(),
  };

  const out = await sbPost("apps", data);
  res.json(out);
});

app.get("/apps", async (req, res) => {
  const apps = await sbGet("apps", "?select=*");
  res.json(apps);
});

app.get("/apps/:id", async (req, res) => {
  const app = await sbGet("apps", `?id=eq.${req.params.id}&select=*`);
  res.json(app[0]);
});

app.put("/apps/:id", auth, async (req, res) => {
  const data = await sbGet("apps", `?id=eq.${req.params.id}&select=user_id`);

  const owner = data[0].user_id;

  if (req.userId !== owner && !(await isAdmin(req.userId)))
    return res.status(403).json({ error: "Not allowed" });

  const result = await sbPatch("apps", `?id=eq.${req.params.id}`, req.body);
  res.json(result);
});

app.delete("/apps/:id", auth, async (req, res) => {
  const data = await sbGet("apps", `?id=eq.${req.params.id}&select=user_id`);

  const owner = data[0].user_id;

  if (req.userId !== owner && !(await isAdmin(req.userId)))
    return res.status(403).json({ error: "Not allowed" });

  const result = await sbDelete("apps", `?id=eq.${req.params.id}`);
  res.json(result);
});

/* -----------------------------------
ADMIN ROUTES  (100% WORKING)
------------------------------------ */
app.get("/admin/stats", auth, async (req, res) => {
  if (!(await isAdmin(req.userId)))
    return res.status(403).json({ error: "Admin only" });

  const users = await sbGet("users", "?select=id");
  const apps = await sbGet("apps", "?select=id");

  res.json({
    users: users.length,
    apps: apps.length,
  });
});

app.get("/admin/dashboard", auth, async (req, res) => {
  if (!(await isAdmin(req.userId)))
    return res.status(403).json({ error: "Admin only" });

  const latest = await sbGet(
    "apps",
    "?select=*&order=created_at.desc&limit=10"
  );

  res.json({ latest });
});

/* -----------------------------------
START SERVER
------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
