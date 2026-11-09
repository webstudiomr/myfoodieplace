import { requireMethod, send, verifyAccessToken } from "../lib/db.js";

export default async function handler(req,res) {
  if (!requireMethod(req,res,["POST"])) return;
  try {
    const user = await verifyAccessToken(req);
    const tenantId = process.env.FOODIE_TENANT_ID;
    const metadata = user?.app_metadata || {};
    if (!user?.id || !user.email_confirmed_at || !tenantId ||
        metadata.tenant_id !== tenantId ||
        metadata.role !== "restaurant_owner" ||
        metadata.disabled === true ||
        metadata.must_change_password !== true) {
      return send(res,403,{error:"This account is not eligible for the required first-login password change."});
    }
    const password = String(req.body?.password || "");
    if (password.length < 12 || password.length > 128) {
      return send(res,400,{error:"Choose a password containing 12 to 128 characters."});
    }
    const base = String(process.env.SUPABASE_URL || "").replace(/\/$/,"");
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!base || !serviceKey) return send(res,503,{error:"Password management is not configured on the server."});
    const response = await fetch(base + "/auth/v1/admin/users/" + encodeURIComponent(user.id), {
      method:"PUT",
      headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json"},
      body:JSON.stringify({
        password,
        app_metadata:{...metadata,must_change_password:false}
      })
    });
    if (!response.ok) {
      const detail = await response.json().catch(()=>({}));
      console.error("First-login password update failed:",response.status,detail.code || detail.error_code || "auth_error");
      return send(res,502,{error:"Supabase could not update the password. Please try again or use password recovery."});
    }
    return send(res,200,{ok:true,message:"Password updated. You can now access the administrator dashboard."});
  } catch(error) {
    console.error("First-login password change failed:",error?.message || "unknown error");
    return send(res,500,{error:"Could not update the administrator password."});
  }
}
