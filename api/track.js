/**
 * LearnPulse — Privacy-First Server-Side Analytics (Vercel Serverless Function)
 * Path: /api/track
 *
 * What this does:
 * - Accepts lightweight event pings from your site (pageview, click, etc.)
 * - Logs structured JSON to Vercel logs (no database required)
 * - Privacy-first: does NOT store raw IP, avoids PII, supports minimal payloads
 *
 * What this does NOT do (by design, for now):
 * - No paid DB, no third-party analytics, no cross-site tracking cookies
 *
 * How to use from client:
 * fetch("/api/track", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ event:"pageview", path:location.pathname }) })
 */

import crypto from "crypto";

/** ---------- Config ---------- **/
const MAX_BODY_BYTES = 8_000; // small payload only
const ALLOWED_METHODS = new Set(["POST", "OPTIONS"]);

// Comma-separated list of allowed origins. If empty, same-origin is allowed.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Optional salt for hashing ephemeral identifiers (recommended).
const TRACK_SALT = process.env.TRACK_SALT || "learnpulse-default-salt";

// In-memory rate limiter (best-effort; serverless instances may reset).
// Good enough to reduce spam while you’re static-first.
const RATE = {
  windowMs: 60_000,
  maxHits: 60, // per fingerprint per window
};
const mem = globalThis.__LP_TRACK_MEM__ || (globalThis.__LP_TRACK_MEM__ = new Map());

/** ---------- Helpers ---------- **/
function json(res, status, obj, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // Never cache analytics responses
  res.setHeader("Cache-Control", "no-store, max-age=0");
  Object.entries(extraHeaders).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(obj));
}

function getOrigin(req) {
  return req.headers.origin || "";
}

function isOriginAllowed(origin) {
  // If list not provided, allow same-origin by default (origin header may be empty for same-origin requests).
  if (!allowedOrigins.length) return true;
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

function setCors(req, res) {
  const origin = getOrigin(req);
  if (!allowedOrigins.length) {
    // default: allow same-origin + no explicit CORS needed
    return;
  }
  if (isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

// Read raw body safely
function readBody(req) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let data = "";

    req.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      data += chunk.toString("utf8");
    });

    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function safeString(x, max = 200) {
  if (typeof x !== "string") return "";
  const s = x.trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function safeObject(x) {
  if (!x || typeof x !== "object") return {};
  // shallow sanitize only (no deep user data)
  const out = {};
  for (const [k, v] of Object.entries(x)) {
    const key = safeString(k, 40);
    if (!key) continue;
    if (typeof v === "string") out[key] = safeString(v, 200);
    else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else if (typeof v === "boolean") out[key] = v;
  }
  return out;
}

function fingerprint(req) {
  // We do NOT store raw IP. We hash ip+ua+salt to throttle spam.
  const xfwd = safeString(req.headers["x-forwarded-for"] || "", 200);
  const ip = xfwd.split(",")[0]?.trim() || "";
  const ua = safeString(req.headers["user-agent"] || "", 400);
  const base = `${ip}|${ua}|${TRACK_SALT}`;
  return crypto.createHash("sha256").update(base).digest("hex").slice(0, 16);
}

function rateLimitOk(key) {
  const now = Date.now();
  const slot = mem.get(key) || { n: 0, reset: now + RATE.windowMs };
  if (now > slot.reset) {
    slot.n = 0;
    slot.reset = now + RATE.windowMs;
  }
  slot.n += 1;
  mem.set(key, slot);
  return slot.n <= RATE.maxHits;
}

/** ---------- Handler ---------- **/
export default async function handler(req, res) {
  try {
    // Method gate
    if (!ALLOWED_METHODS.has(req.method)) {
      setCors(req, res);
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }

    // CORS / origin allow-list (optional)
    setCors(req, res);
    if (allowedOrigins.length) {
      const origin = getOrigin(req);
      if (!isOriginAllowed(origin)) {
        return json(res, 403, { ok: false, error: "Origin not allowed" });
      }
    }

    // Preflight
    if (req.method === "OPTIONS") {
      return json(res, 200, { ok: true });
    }

    // Rate limiting
    const fp = fingerprint(req);
    if (!rateLimitOk(fp)) {
      return json(res, 429, { ok: false, error: "Rate limit" });
    }

    // Parse body
    const raw = await readBody(req);
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return json(res, 400, { ok: false, error: "Invalid JSON" });
    }

    // Minimal schema (privacy-first)
    const event = safeString(body.event, 60) || "event";
    const path = safeString(body.path, 200) || "/";
    const title = safeString(body.title, 140);
    const ref = safeString(body.ref, 200);
    const utm = safeObject(body.utm); // {source, medium, campaign, content, term}
    const meta = safeObject(body.meta); // shallow, no PII
    const ts = typeof body.ts === "number" && Number.isFinite(body.ts) ? body.ts : Date.now();

    // Hard rules: block PII keys if someone tries
    const blockedKeys = ["email", "phone", "address", "name", "ip"];
    for (const k of blockedKeys) {
      if (k in meta) delete meta[k];
      if (k in utm) delete utm[k];
    }

    // Server-side context (minimal)
    const ua = safeString(req.headers["user-agent"] || "", 400);

    const record = {
      v: 1,
      app: "LearnPulse",
      event,
      path,
      title: title || undefined,
      ref: ref || undefined,
      utm: Object.keys(utm).length ? utm : undefined,
      meta: Object.keys(meta).length ? meta : undefined,
      ts,
      // privacy: hashed fingerprint only (no raw IP stored)
      fp,
      ua: ua || undefined,
    };

    // Primary storage: Vercel logs (free, reliable enough to start)
    console.log("[LEARNPULSE_TRACK]", JSON.stringify(record));

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error("[LEARNPULSE_TRACK_ERROR]", err?.message || err);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}
```0