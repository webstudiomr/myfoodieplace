import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_SECONDS = 8 * 60 * 60;
function sessionSecret() { return process.env.FOODIE_ADMIN_KEY || ""; }
function sessionSignature(expires) { return createHmac("sha256", sessionSecret()).update(`foodie-admin:${expires}`).digest("hex"); }
export function isAdminSession(req) {
  const cookie = String(req.headers.cookie || "").split(";").map(v => v.trim()).find(v => v.startsWith("foodie_admin_session="));
  if (!cookie) return false;
  const token = decodeURIComponent(cookie.slice("foodie_admin_session=".length));
  const [expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now()/1000) || expires > Math.floor(Date.now()/1000) + SESSION_SECONDS + 60 || !/^[a-f0-9]{64}$/.test(signature || "")) return false;
  const expected = Buffer.from(sessionSignature(expires));
  const supplied = Buffer.from(signature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
export function adminSessionCookie(req, token, maxAge=SESSION_SECONDS) {
  const secure = req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
  return `foodie_admin_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
export function makeAdminSession() {
  const expires = Math.floor(Date.now()/1000) + SESSION_SECONDS;
  return `${expires}.${sessionSignature(expires)}`;
}
export function adminKeyMatches(supplied) {
  const expected = process.env.FOODIE_ADMIN_KEY || "";
  if (!expected || typeof supplied !== "string") return false;
  const a=Buffer.from(expected), b=Buffer.from(supplied);
  return a.length===b.length && timingSafeEqual(a,b);
}

export function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).json(body);
}

export function requireMethod(req, res, allowed) {
  if (!allowed.includes(req.method)) {
    res.setHeader("Allow", allowed.join(", "));
    send(res, 405, { error: "Method not allowed." });
    return false;
  }
  return true;
}

export function requireAdmin(req, res) {
  if (!isAdminSession(req)) {
    send(res, 401, { error: "Admin session required. Please sign in again." });
    return false;
  }
  return true;
}

export async function db(table, query = "", options = {}) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase server environment variables are missing.");
  const response = await fetch(`${base}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method: options.method || "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation"
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.hint || "Database request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function fail(res, error) {
  console.error("Foodie Place API:", error);
  return send(res, error.status && error.status < 500 ? error.status : 500, {
    error: error.status && error.status < 500 ? error.message : "Server error. Please try again."
  });
}
