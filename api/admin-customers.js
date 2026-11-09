import { requireMethod, send, verifyAccessToken } from "../lib/db.js";

const base = () => String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
async function adminApi(path, method="GET", body) {
  const response = await fetch(base() + "/auth/v1/admin/" + path, {
    method,
    headers: { apikey: serviceKey(), Authorization: "Bearer " + serviceKey(), "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.msg || data.message || data.error_description || "Supabase user management request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}
async function listUsers() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const result = await adminApi("users?page=" + page + "&per_page=100");
    const users = result.users || [];
    all.push(...users);
    if (users.length < 100) break;
  }
  return all;
}
export default async function handler(req,res) {
  if (!requireMethod(req,res,["POST"])) return;
  try {
    const caller = await verifyAccessToken(req);
    const tenantId = process.env.FOODIE_TENANT_ID;
    const developerEmails = String(process.env.FOODIE_DEVELOPER_EMAILS || "").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);
    if (!caller?.email || !caller.email_confirmed_at || !tenantId ||
        caller.app_metadata?.role !== "developer" ||
        caller.app_metadata?.tenant_id !== tenantId ||
        !developerEmails.includes(caller.email.toLowerCase())) {
      return send(res,403,{error:"Only the authorised MR WebStudio developer can transfer administrator access."});
    }
    if (!base() || !serviceKey()) return send(res,503,{error:"Supabase user-management credentials are not configured on the server."});
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res,400,{error:"Enter a valid customer email address."});
    if (password.length < 12 || password.length > 128) return send(res,400,{error:"The temporary password must contain 12 to 128 characters."});
    if (developerEmails.includes(email)) return send(res,400,{error:"A developer account cannot be used as the restaurant customer account."});
    const users = await listUsers();
    let target = users.find(u => String(u.email || "").toLowerCase() === email);
    if (target && target.app_metadata?.role === "developer") return send(res,409,{error:"That email is already assigned as a developer account."});
    if (target && target.app_metadata?.tenant_id && target.app_metadata.tenant_id !== tenantId) {
      return send(res,409,{error:"That email is already assigned to a different restaurant tenant."});
    }
    const previousOwners = users.filter(u => u.app_metadata?.tenant_id === tenantId && u.app_metadata?.role === "restaurant_owner" && u.id !== target?.id);
    let updated;
    if (target) {
      updated = await adminApi("users/" + encodeURIComponent(target.id), "PUT", {
        email, password, email_confirm: true,
        app_metadata: { ...(target.app_metadata || {}), role:"restaurant_owner", tenant_id:tenantId, disabled:false, must_change_password:true }
      });
    } else {
      updated = await adminApi("users", "POST", {
        email, password, email_confirm: true,
        app_metadata: { role:"restaurant_owner", tenant_id:tenantId, disabled:false, must_change_password:true }
      });
    }
    const newUser = updated.user || updated;
    const revoked = [];
    for (const old of previousOwners) {
      await adminApi("users/" + encodeURIComponent(old.id), "PUT", {
        app_metadata: { ...(old.app_metadata || {}), role:"revoked", tenant_id:tenantId, disabled:true, must_change_password:false }
      });
      revoked.push(old.email || old.id);
    }
    return send(res,200,{
      ok:true,
      customer:{email:newUser.email || email,id:newUser.id},
      previousOwnersRevoked:revoked,
      message:"Customer administrator access has been transferred. Give the temporary password to the new owner privately; they must change it after signing in."
    });
  } catch(error) {
    console.error("Customer administrator transfer failed:",error?.message || "unknown error");
    return send(res,error.status===400?400:502,{error:error.message || "Could not transfer administrator access."});
  }
}
