export async function verifyAccessToken(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !base || !key) return null;
  const response = await fetch(base.replace(/\/$/, "") + "/auth/v1/user", {
    headers: { apikey: key, Authorization: "Bearer " + token },
    cache: "no-store"
  });
  if (!response.ok) return null;
  const user = await response.json();
  // Supabase verifies the bearer token above. Enforce a 30-day maximum age
  // from the original authentication event; refreshes do not reset auth_time.
  const claimsPart = token.split(".")[1];
  if (!claimsPart) return null;
  let claims;
  try {
    const normalized = claimsPart.replace(/-/g, "+").replace(/_/g, "/");
    claims = JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
  } catch {
    return null;
  }
  const authTime = Number(claims.auth_time);
  const maxSessionAge = 30 * 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authTime) || authTime > now + 60 || now - authTime >= maxSessionAge) return null;
  return user;
}

export async function isAdminSession(req) {
  const user = await verifyAccessToken(req);
  if (!user?.id || !user?.email || !user.email_confirmed_at) return false;
  const metadata = user.app_metadata || {};
  const tenantId = process.env.FOODIE_TENANT_ID;
  if (!tenantId || metadata.tenant_id !== tenantId || metadata.disabled === true) return false;
  const email = user.email.toLowerCase();
  const ownerEmail = String(process.env.FOODIE_ADMIN_EMAIL || "").trim().toLowerCase();
  const developerEmails = String(process.env.FOODIE_DEVELOPER_EMAILS || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  if (metadata.role === "restaurant_owner") return true;
  if (metadata.role === "developer") return developerEmails.includes(email);
  return false;
}

export async function requireAdmin(req, res) {
  try {
    if (await isAdminSession(req)) return true;
  } catch (error) {
    console.error("Foodie Place auth verification failed:", error?.message || "unknown error");
  }
  send(res, 401, { error: "A valid, authorised restaurant administrator session is required." });
  return false;
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
