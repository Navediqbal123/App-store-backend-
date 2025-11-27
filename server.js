// ==========================
// server.js (FULL BACKEND)
// ==========================

// ------- IMPORTS -------
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

// ------- CONSTANTS -------
const app = express();
app.use(cors());
app.use(express.json());

// Static folder for uploaded files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Supabase API URLs
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// -------------------------------
// MULTER FILE STORAGE FOR UPLOADS
// -------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "uploads/");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// -------------------------------
// HELPERS
// -------------------------------

// 🔐 CREATE JWT TOKEN
const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

// 🛡️ AUTH MIDDLEWARE
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// -------------------------------
// ✦ USER SIGNUP
// -------------------------------
app.post("/auth/signup", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const { data, error } = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: hashed }),
  }).then((r) => r.json());

  if (error) return res.status(400).json({ error });
  res.json({ message: "Signup Success", data });
});

// -------------------------------
// ✦ USER LOGIN
// -------------------------------
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

  const user = users[0];
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ error: "Wrong password" });

  res.json({ token: generateToken(user.id), user });
});

// -------------------------------
// ✦ UPLOAD APP FILE
// -------------------------------
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ fileUrl });
});

// -------------------------------
// ✦ SUBMIT APP TO STORE
// -------------------------------
app.post("/apps", authMiddleware, async (req, res) => {
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

// -------------------------------
// ✦ GET ALL APPS
// -------------------------------
app.get("/apps", async (req, res) => {
  const apps = await fetch(`${SUPABASE_URL}/rest/v1/apps?select=*`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  }).then((r) => r.json());

  res.json(apps);
});

// -------------------------------
// ✦ PROMOTE AN APP
// -------------------------------
app.post("/apps/promote/:id", authMiddleware, async (req, res) => {
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

// -------------------------------
// ✦ UNPROMOTE AN APP
// -------------------------------
app.post("/apps/unpromote/:id", authMiddleware, async (req, res) => {
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

// -------------------------------
// ROOT TEST ROUTE
// -------------------------------
app.get("/", (req, res) => {
  res.send("App Store Backend Running ✔");
});

// -------------------------------
// START SERVER
// -------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
