import { timingSafeEqual } from "node:crypto";

export function send(res, status, body) {
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
  const expected = process.env.FOODIE_ADMIN_KEY || "";
  const supplied = req.headers["x-admin-key"] || "";
  if (!expected || typeof supplied !== "string") {
    send(res, 401, { error: "Admin authorization required." });
    return false;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    send(res, 401, { error: "Invalid admin key." });
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
