import { requireMethod, send } from "../lib/db.js";
export default function handler(req,res){
  if(!requireMethod(req,res,["GET"]))return;
  const url=process.env.SUPABASE_URL;
  const publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url||!publishableKey)return send(res,503,{error:"Supabase Auth is not configured."});
  return send(res,200,{url,publishableKey});
}
