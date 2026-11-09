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
  return await response.json();
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
  if (metadata.role === "restaurant_owner") return !!ownerEmail && email === ownerEmail;
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
