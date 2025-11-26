// server.js
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ---------- env ----------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !JWT_SECRET) {
  console.error("Missing envs: SUPABASE_URL, SERVICE_ROLE_KEY, JWT_SECRET");
  process.exit(1);
}

// ---------- supabase server client ----------
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ---------- storage bucket ----------
const bucketName = "appfiles";

// ---------- helpers ----------
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

async function isAdmin(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", userId)
    .single();
  if (error) return false;
  return data?.is_admin === true;
}

// ---------- ROOT ----------
app.get("/", (req, res) => res.send("App Store Admin API ✔"));

// ---------- UPLOAD FILE (APK / AAB / IMAGE) ----------
app.post("/upload", auth, async (req, res) => {
  try {
    const { fileName, fileData, folder = "uploads" } = req.body;

    if (!fileName || !fileData) {
      return res.status(400).json({ error: "Missing file" });
    }

    const buffer = Buffer.from(fileData, "base64");
    const filePath = `${folder}/${Date.now()}-${fileName}`;

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        upsert: true,
        contentType: "application/octet-stream",
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    res.json({ success: true, url: urlData.publicUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- APPS ----------
app.get("/apps", async (req, res) => {
  try {
    const q = (req.query.search || "").trim();
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const offset = (page - 1) * limit;

    let builder = supabase
      .from("apps")
      .select(
        "id, owner_id, name, slug, short_description, icon_url, is_published, is_promoted, promote_until, promote_rank, created_at, downloads_count"
      )
      .eq("visibility", "public");

    if (q) {
      builder = builder.or(
        `name.ilike.%${q}%, short_description.ilike.%${q}%, slug.ilike.%${q}%`
      );
    }

    const { data, error } = await builder.range(
      offset,
      offset + limit - 1
    );
    if (error) throw error;

    const now = new Date();
    const sorted = (data || []).sort((a, b) => {
      const aProm =
        a.is_promoted &&
        a.promote_until &&
        new Date(a.promote_until) > now;
      const bProm =
        b.is_promoted &&
        b.promote_until &&
        new Date(b.promote_until) > now;

      if (aProm && bProm)
        return (b.promote_rank || 0) - (a.promote_rank || 0);
      if (aProm) return -1;
      if (bProm) return 1;

      if (a.is_published !== b.is_published)
        return a.is_published ? -1 : 1;

      return new Date(b.created_at) - new Date(a.created_at);
    });

    res.json({ success: true, apps: sorted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- GET SINGLE APP ----------
app.get("/apps/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase
      .from("apps")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    res.json({ success: true, app: data });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// ---------- PROMOTE ----------
app.post("/admin/apps/:id/promote", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.user.id)))
      return res.status(403).json({ error: "Admin only" });

    const id = req.params.id;
    const { days = 7, rank = 10 } = req.body;

    const promote_until = new Date(
      Date.now() + days * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error } = await supabase
      .from("apps")
      .update({
        is_promoted: true,
        promote_until,
        promote_rank: rank,
      })
      .eq("id", id);

    if (error) throw error;

    res.json({
      success: true,
      message: "App promoted",
      promote_until,
      rank,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- UNPROMOTE ----------
app.post("/admin/apps/:id/unpromote", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.user.id)))
      return res.status(403).json({ error: "Admin only" });

    const id = req.params.id;

    const { error } = await supabase
      .from("apps")
      .update({
        is_promoted: false,
        promote_until: null,
        promote_rank: null,
      })
      .eq("id", id);

    if (error) throw error;

    res.json({ success: true, message: "Promotion removed" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- START ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`App Store backend running on Port ${PORT}`)
);
