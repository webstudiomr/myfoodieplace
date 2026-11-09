import { requireMethod, send, verifyAccessToken } from "../lib/db.js";
export default async function handler(req,res){
  if(!requireMethod(req,res,["POST"]))return;
  try{
    const user=await verifyAccessToken(req);
    if(!user?.id||!user?.email||!user.email_confirmed_at)return send(res,401,{error:"Sign in with a verified email address first."});
    const email=user.email.toLowerCase();
    const ownerEmail=String(process.env.FOODIE_ADMIN_EMAIL||"").trim().toLowerCase();
    const developers=String(process.env.FOODIE_DEVELOPER_EMAILS||"").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);
    const role=email===ownerEmail&&ownerEmail?"restaurant_owner":developers.includes(email)?"developer":null;
    const tenantId=process.env.FOODIE_TENANT_ID;
    const base=process.env.SUPABASE_URL;
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!role)return send(res,403,{error:"This email address has not been assigned an administrator role for this restaurant."});
    if(!tenantId||!base||!serviceKey)return send(res,503,{error:"Administrator provisioning is not configured."});
    const response=await fetch(base.replace(/\/$/,"")+"/auth/v1/admin/users/"+encodeURIComponent(user.id),{
      method:"PUT",
      headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json"},
      body:JSON.stringify({app_metadata:{...(user.app_metadata||{}),role,tenant_id:tenantId,disabled:false}})
    });
    if(!response.ok){console.error("Supabase admin provisioning failed:",response.status);return send(res,502,{error:"Could not assign administrator permissions."});}
    return send(res,200,{ok:true,role,email});
  }catch(error){console.error("Admin bootstrap failed:",error?.message||"unknown error");return send(res,500,{error:"Administrator setup failed."});}
}
