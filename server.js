// server.js
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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

// ---------- APPS: search + promoted-first ----------
app.get("/apps", async (req, res) => {
  try {
    const q = (req.query.search || "").trim();
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const offset = (page - 1) * limit;

    // Promote ordering logic:
    // - active promotions first (where promote_until > now), order by promote_rank desc
    // - then published apps ordered by created_at desc
    // If search provided, do ilike on name/short_description/slug
    let builder = supabase
      .from("apps")
      .select(
        `id, owner_id, name, slug, short_description, icon_url, is_published, is_promoted, promote_until, promote_rank, created_at, downloads_count`
      )
      .eq("visibility", "public");

    if (q) {
      builder = builder.ilike("name", `%${q}%`).or(
        `short_description.ilike.%${q}% , slug.ilike.%${q}%`
      );
    }

    // fetch results and then sort in JS to prioritize active promotions
    const { data, error } = await builder.range(offset, offset + limit - 1);
    if (error) throw error;

    const now = new Date();
    const sorted = (data || []).sort((a, b) => {
      const aProm = a.is_promoted && a.promote_until && new Date(a.promote_until) > now;
      const bProm = b.is_promoted && b.promote_until && new Date(b.promote_until) > now;
      if (aProm && bProm) return (b.promote_rank || 0) - (a.promote_rank || 0);
      if (aProm) return -1;
      if (bProm) return 1;
      // fallback: published then newest
      if (a.is_published !== b.is_published) return a.is_published ? -1 : 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    res.json({ success: true, apps: sorted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// ---------- GET single app (and optionally increment view) ----------
app.get("/apps/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase.from("apps").select("*").eq("id", id).single();
    if (error) throw error;
    res.json({ success: true, app: data });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message || err });
  }
});

// ---------- PROMOTE an app (admin only) ----------
app.post("/admin/apps/:id/promote", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!(await isAdmin(userId))) return res.status(403).json({ error: "Admin only" });

    const id = req.params.id;
    const { days = 7, rank = 10 } = req.body; // days to promote, rank priority
    const promote_until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("apps")
      .update({ is_promoted: true, promote_until, promote_rank: rank })
      .eq("id", id);

    if (error) throw error;
    res.json({ success: true, message: "App promoted", promote_until, rank });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// ---------- REMOVE promotion (admin) ----------
app.post("/admin/apps/:id/unpromote", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!(await isAdmin(userId))) return res.status(403).json({ error: "Admin only" });

    const id = req.params.id;
    const { error } = await supabase
      .from("apps")
      .update({ is_promoted: false, promote_until: null, promote_rank: null })
      .eq("id", id);

    if (error) throw error;
    res.json({ success: true, message: "Promotion removed" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// ---------- APPROVE / REJECT app (admin) ----------
app.post("/admin/apps/:id/approve", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!(await isAdmin(userId))) return res.status(403).json({ error: "Admin only" });

    const id = req.params.id;
    const { error } = await supabase.from("apps").update({ status: "approved", is_published: true }).eq("id", id);
    if (error) throw error;
    res.json({ success: true, message: "App approved & published" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

app.post("/admin/apps/:id/reject", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!(await isAdmin(userId))) return res.status(403).json({ error: "Admin only" });

    const id = req.params.id;
    const { reason } = req.body;
    const { error } = await supabase.from("apps").update({ status: "rejected", is_published: false }).eq("id", id);
    if (error) throw error;
    // Optionally save rejection reason to a table or column (not required)
    res.json({ success: true, message: "App rejected", reason: reason || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// ---------- LOG a download (public endpoint used when user downloads an app) ----------
app.post("/apps/:id/download", async (req, res) => {
  try {
    const appId = req.params.id;
    const { user_id = null, country = "unknown" } = req.body;

    // Insert into app_downloads (create this table in Supabase SQL if not exists)
    // Recommended SQL to create table:
    // create table if not exists app_downloads (
    //   id uuid primary key default gen_random_uuid(),
    //   app_id uuid references apps(id),
    //   user_id uuid,
    //   country text,
    //   created_at timestamptz default now()
    // );
    await supabase.from("app_downloads").insert({ app_id: appId, user_id, country });

    // increment downloads_count (create column in apps table if needed)
    await supabase.rpc("increment_app_downloads", { target_id: appId }).catch(async (e) => {
      // if rpc not exists, fallback to update
      const { data, error } = await supabase
        .from("apps")
        .select("downloads_count")
        .eq("id", appId)
        .single();
      if (error) {
        // best-effort: ignore
      } else {
        const newCount = (data?.downloads_count || 0) + 1;
        await supabase.from("apps").update({ downloads_count: newCount }).eq("id", appId);
      }
    });

    res.json({ success: true, message: "Download logged" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// ---------- ADMIN METRICS (total apps, downloads, active devs, downloads by country) ----------
app.get("/admin/stats", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!(await isAdmin(userId))) return res.status(403).json({ error: "Admin only" });

    const [{ data: appsCount }, { data: downloadsCount }, { data: devCount }, { data: downloadsByCountry }] = await Promise.all([
      supabase.from("apps").select("id", { count: "exact" }),
      supabase.from("app_downloads").select("id", { count: "exact" }),
      supabase.from("users").select("id", { count: "exact" }).neq("is_admin", true),
      supabase.rpc("downloads_by_country") // optional rpc; fallback below if not exists
    ]);

    // fallback for downloadsByCountry if rpc missing
    let countryStats = downloadsByCountry;
    if (!countryStats) {
      const { data } = await supabase.from("app_downloads").select("country, count(id) as count").group("country");
      countryStats = data || [];
    }

    res.json({
      success: true,
      total_apps: appsCount?.length ?? 0,
      total_downloads: downloadsCount?.length ?? 0,
      active_developers: devCount?.length ?? 0,
      downloads_by_country: countryStats,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// ---------- list promoted apps ----------
app.get("/promotions", async (req, res) => {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("apps")
      .select("id, name, slug, icon_url, promote_until, promote_rank")
      .gt("promote_until", now)
      .order("promote_rank", { ascending: false });

    if (error) throw error;
    res.json({ success: true, promotions: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// ---------- utility RPC creation (only if you want to create server-side helper) ----------
app.post("/admin/create-rpcs", auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.user.id))) return res.status(403).json({ error: "Admin only" });

    // Note: Running DDL from runtime is possible but not always allowed.
    // Here we provide best-effort SQL to create a simple RPC increment function and downloads_by_country
    const sql1 = `
      create function if not exists increment_app_downloads(target_id uuid) returns void as $$
      begin
        update apps set downloads_count = coalesce(downloads_count,0) + 1 where id = target_id;
      end;
      $$ language plpgsql;
    `;

    const sql2 = `
      create function if not exists downloads_by_country() returns table(country text, count bigint) as $$
      begin
        return query select country, count(*) from app_downloads group by country;
      end;
      $$ language plpgsql;
    `;

    await supabase.rpc("sql", { sql: sql1 }).catch(() => {}); // Many setups don't allow this; ignore errors
    await supabase.rpc("sql", { sql: sql2 }).catch(() => {});

    res.json({ success: true, message: "RPCs attempted (may require DB console if blocked)" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// ---------- start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`App Store backend running on ${PORT}`));
