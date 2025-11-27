// --------------------------
// RENDER-SAFE SERVER.JS
// --------------------------

import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ----------- ENV -----------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

// ----------- JWT -----------
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
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ----------- ROOT -----------
app.get("/", (req, res) => {
  res.send("🔥 Render-ready App Store Backend Running");
});

// ----------- SIGNUP -----------
app.post("/auth/signup", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }), // no bcrypt
  }).then((r) => r.json());

  if (error) return res.status(400).json({ error });
  res.json({ message: "Signup success", data });
});

// ----------- LOGIN -----------
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const users = await fetch(
    `${SUPABASE_URL}/rest/v1/users?email=eq.${email}&select=*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  ).then((r) => r.json());

  if (!users.length) return res.status(400).json({ error: "User not found" });

  if (users[0].password !== password)
    return res.status(400).json({ error: "Wrong password" });

  res.json({ token: createToken(users[0].id), user: users[0] });
});

// ----------- SUBMIT APP -----------
app.post("/apps", auth, async (req, res) => {
  const appData = { ...req.body, user_id: req.userId };

  const { data, error } = await fetch(`${SUPABASE_URL}/rest/v1/apps`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(appData),
  }).then((r) => r.json());

  if (error) return res.status(400).json({ error });
  res.json({ message: "App submitted", data });
});

// ----------- GET APPS -----------
app.get("/apps", async (req, res) => {
  const apps = await fetch(`${SUPABASE_URL}/rest/v1/apps?select=*`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  }).then((r) => r.json());

  res.json(apps);
});

// ----------- PROMOTE -----------
app.post("/apps/promote/:id", auth, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await fetch(
    `${SUPABASE_URL}/rest/v1/apps?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ promoted: true }),
    }
  ).then((r) => r.json());

  if (error) return res.status(400).json({ error });
  res.json({ message: "App promoted", data });
});

// ----------- UNPROMOTE -----------
app.post("/apps/unpromote/:id", auth, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await fetch(
    `${SUPABASE_URL}/rest/v1/apps?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ promoted: false }),
    }
  ).then((r) => r.json());

  if (error) return res.status(400).json({ error });
  res.json({ message: "App unpromoted", data });
});

// ----------- START -----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`⚡ Render Backend Running on ${PORT}`)
);
