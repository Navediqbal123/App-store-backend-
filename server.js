// server.js
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ENV
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
  console.error("Missing one of SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / JWT_SECRET");
  process.exit(1);
}

// Helpers for Supabase REST calls
const defaultHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { ...defaultHeaders },
  });
  return await res.json();
}

async function supabasePost(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: "POST",
    headers: { ...defaultHeaders },
    body: JSON.stringify(body),
  });
  return await res.json();
}

async function supabasePatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: "PATCH",
    headers: { ...defaultHeaders },
    body: JSON.stringify(body),
  });
  return await res.json();
}

async function supabaseDelete(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: "DELETE",
    headers: { ...defaultHeaders },
  });
  return await res.json();
}

// JWT
function createToken(id) {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decode = jwt.verify(token, JWT_SECRET);
    req.userId = decode.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

async function isAdmin(userId) {
  const users = await supabaseGet(`/users?id=eq.${userId}&select=role`);
  return users && users[0] && users[0].role === "admin";
}

// ROOT
app.get("/", (req, res) => {
  res.send("🔥 Render Backend Running");
});

/* ---------------------------
   AUTH
   --------------------------- */
// SIGNUP
app.post("/auth/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email & password required" });

    // check existing
    const existing = await supabaseGet(`/users?email=eq.${encodeURIComponent(email)}&select=id`);
    if (existing && existing.length) return res.status(400).json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const body = { email, password: hashed, name: name || null, role: "user", created_at: new Date().toISOString() };
    const result = await supabasePost("/users", body);
    if (result?.error) return res.status(400).json(result);

    res.json({ message: "Signup success", data: result });
  } catch (err) {
    res.status(500).json({ error: "Signup failed", details: err.message });
  }
});

// LOGIN
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email & password required" });

    const users = await supabaseGet(`/users?email=eq.${encodeURIComponent(email)}&select=*`);
    if (!users || !users.length) return res.status(400).json({ error: "User not found" });

    const user = users[0];
    const ok = await bcrypt.compare(password, user.password || "");
    if (!ok) return res.status(400).json({ error: "Wrong password" });

    const token = createToken(user.id);
    // remove password before returning
    delete user.password;
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: "Login failed", details: err.message });
  }
});

// ME
app.get("/auth/me", auth, async (req, res) => {
  try {
    const users = await supabaseGet(`/users?id=eq.${req.userId}&select=*`);
    if (!users || !users.length) return res.status(404).json({ error: "User not found" });
    const user = users[0];
    delete user.password;
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------
   APPS
   --------------------------- */
// Create / Submit app
app.post("/apps", auth, async (req, res) => {
  try {
    const appData = { ...req.body, user_id: req.userId, created_at: new Date().toISOString(), promoted: false, downloads: 0 };
    const result = await supabasePost("/apps", appData);
    if (result?.error) return res.status(400).json(result);
    res.json({ message: "App submitted", data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all apps (supports query params for category, promoted etc)
app.get("/apps", async (req, res) => {
  try {
    // support simple query strings: ?category=games&promoted=true
    const qs = [];
    if (req.query.category) qs.push(`category=eq.${encodeURIComponent(req.query.category)}`);
    if (req.query.promoted) qs.push(`promoted=eq.${encodeURIComponent(req.query.promoted)}`);
    const query = qs.length ? `?${qs.join("&")}` : "?select=*";
    const path = qs.length ? `/apps?select=*&${qs.join("&")}` : `/apps?select=*`;
    const result = await supabaseGet(path);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single app
app.get("/apps/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await supabaseGet(`/apps?id=eq.${encodeURIComponent(id)}&select=*`);
    if (!result || !result.length) return res.status(404).json({ error: "App not found" });
    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update app (owner or admin)
app.put("/apps/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const appRows = await supabaseGet(`/apps?id=eq.${encodeURIComponent(id)}&select=user_id`);
    if (!appRows || !appRows.length) return res.status(404).json({ error: "App not found" });
    const ownerId = appRows[0].user_id;
    const admin = await isAdmin(req.userId);
    if (req.userId !== ownerId && !admin) return res.status(403).json({ error: "Not authorized" });

    const body = { ...req.body, updated_at: new Date().toISOString() };
    const result = await supabasePatch(`/apps?id=eq.${encodeURIComponent(id)}`, body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete app (owner or admin)
app.delete("/apps/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const appRows = await supabaseGet(`/apps?id=eq.${encodeURIComponent(id)}&select=user_id`);
    if (!appRows || !appRows.length) return res.status(404).json({ error: "App not found" });
    const ownerId = appRows[0].user_id;
    const admin = await isAdmin(req.userId);
    if (req.userId !== ownerId && !admin) return res.status(403).json({ error: "Not authorized" });

    const result = await supabaseDelete(`/apps?id=eq.${encodeURIComponent(id)}`);
    res.json({ message: "App deleted", result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Promote / Unpromote (admin only)
app.post("/apps/promote/:id", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) return res.status(403).json({ error: "Admin only" });
    const { id } = req.params;
    const result = await supabasePatch(`/apps?id=eq.${encodeURIComponent(id)}`, { promoted: true });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/apps/unpromote/:id", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) return res.status(403).json({ error: "Admin only" });
    const { id } = req.params;
    const result = await supabasePatch(`/apps?id=eq.${encodeURIComponent(id)}`, { promoted: false });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------
   CATEGORIES
   --------------------------- */
app.post("/categories", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) return res.status(403).json({ error: "Admin only" });
    const { name, meta } = req.body;
    const result = await supabasePost("/categories", { name, meta: meta || null, created_at: new Date().toISOString() });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/categories", async (req, res) => {
  try {
    const result = await supabaseGet("/categories?select=*");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/categories/:id", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) return res.status(403).json({ error: "Admin only" });
    const { id } = req.params;
    const result = await supabaseDelete(`/categories?id=eq.${encodeURIComponent(id)}`);
    res.json({ message: "Category deleted", result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------
   USERS
   --------------------------- */
app.get("/users", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) return res.status(403).json({ error: "Admin only" });
    const result = await supabaseGet("/users?select=id,email,name,role,created_at");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/users/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.userId !== id && !(await isAdmin(req.userId))) return res.status(403).json({ error: "Not authorized" });
    const result = await supabaseGet(`/users?id=eq.${encodeURIComponent(id)}&select=id,email,name,role,created_at`);
    if (!result || !result.length) return res.status(404).json({ error: "User not found" });
    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------
   REVIEWS / RATINGS / DOWNLOADS
   --------------------------- */
// Post review
app.post("/apps/:id/review", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const body = { app_id: id, user_id: req.userId, comment, created_at: new Date().toISOString() };
    const result = await supabasePost("/reviews", body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get reviews
app.get("/apps/:id/reviews", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await supabaseGet(`/reviews?app_id=eq.${encodeURIComponent(id)}&select=*`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rate app (simple insert - you can change to upsert if needed)
app.post("/apps/:id/rate", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "rating 1-5 required" });
    const body = { app_id: id, user_id: req.userId, rating, created_at: new Date().toISOString() };
    const result = await supabasePost("/ratings", body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register download (increments downloads)
app.post("/apps/:id/download", async (req, res) => {
  try {
    const { id } = req.params;
    // fetch current downloads
    const apps = await supabaseGet(`/apps?id=eq.${encodeURIComponent(id)}&select=downloads`);
    if (!apps || !apps.length) return res.status(404).json({ error: "App not found" });
    const current = Number(apps[0].downloads || 0);
    const result = await supabasePatch(`/apps?id=eq.${encodeURIComponent(id)}`, { downloads: current + 1 });
    // also log download (optional)
    await supabasePost("/downloads", { app_id: id, created_at: new Date().toISOString() });
    res.json({ message: "Download registered", result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------
   ADMIN - STATS / DASHBOARD
   --------------------------- */
app.get("/admin/stats", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) return res.status(403).json({ error: "Admin only" });
    // simple counts (note: for huge datasets, use RPC/count prefered)
    const users = await supabaseGet("/users?select=id");
    const apps = await supabaseGet("/apps?select=id");
    const downloads = await supabaseGet("/downloads?select=id");
    const reviews = await supabaseGet("/reviews?select=id");
    res.json({
      users: (users && users.length) || 0,
      apps: (apps && apps.length) || 0,
      downloads: (downloads && downloads.length) || 0,
      reviews: (reviews && reviews.length) || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/admin/dashboard", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) return res.status(403).json({ error: "Admin only" });
    // example dashboard data: latest apps, top downloads, recent reviews
    const latestApps = await supabaseGet("/apps?select=*&order=created_at.desc&limit=10");
    const recentReviews = await supabaseGet("/reviews?select=*&order=created_at.desc&limit=10");
    const topDownloads = await supabaseGet("/apps?select=*&order=downloads.desc&limit=10");
    res.json({ latestApps, recentReviews, topDownloads });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Running on ${PORT}`));
