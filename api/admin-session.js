import { adminKeyMatches, adminSessionCookie, isAdminSession, makeAdminSession, requireMethod, send } from "../lib/db.js";
export default async function handler(req,res){
  if(req.method==="GET")return send(res,200,{authenticated:isAdminSession(req)});
  if(req.method==="DELETE"){res.setHeader("Set-Cookie",adminSessionCookie(req,"",0));return send(res,200,{ok:true})}
  if(!requireMethod(req,res,["GET","POST","DELETE"]))return;
  if(!adminKeyMatches(req.body?.key))return send(res,401,{error:"Invalid admin key."});
  res.setHeader("Set-Cookie",adminSessionCookie(req,makeAdminSession()));
  return send(res,200,{authenticated:true,expiresIn:28800});
}