import { isAdminSession, requireMethod, send, verifyAccessToken } from "../lib/db.js";
export default async function handler(req,res){
  if(!requireMethod(req,res,["GET"]))return;
  const user=await verifyAccessToken(req);
  if(!user)return send(res,401,{error:"Sign-in required."});
  if(user.app_metadata?.must_change_password===true)return send(res,403,{error:"You must change your temporary password before accessing the dashboard.",code:"PASSWORD_CHANGE_REQUIRED"});
  if(!(await isAdminSession(req)))return send(res,403,{error:"This account is not authorised for this restaurant."});
  return send(res,200,{authenticated:true,user:{email:user.email,role:user.app_metadata?.role}});
}
