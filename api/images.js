import { randomUUID } from "node:crypto";
import { del, list, put } from "@vercel/blob";
import { fail, requireAdmin, requireMethod, send } from "../lib/db.js";
const PREFIX="foodie-place/",MAX_BYTES=4*1024*1024;
function safeName(v){return String(v||"Food image").replace(/[^a-zA-Z0-9 _-]/g,"").trim().slice(0,70)||"Food image"}
async function allImages(){const out=[];let cursor;do{const p=await list({prefix:PREFIX,limit:1000,...(cursor?{cursor}:{})});out.push(...p.blobs);cursor=p.hasMore?p.cursor:undefined}while(cursor);return out}
export default async function handler(req,res){try{
 if(!requireAdmin(req,res))return;
 if(req.method==="GET"){const blobs=await allImages();return send(res,200,{images:blobs.map(b=>({id:b.pathname,url:b.url,name:safeName(b.pathname.split("/").pop().replace(/^[0-9]+-[a-f0-9-]+-/,"").replace(/\.[^.]+$/,"").replace(/-/g," ")))}))})}
 if(req.method==="POST"){const {name,data}=req.body||{};const m=typeof data==="string"&&data.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);if(!m)return send(res,400,{error:"Upload a valid JPEG, PNG, WebP or GIF image."});const buffer=Buffer.from(m[2],"base64");if(!buffer.length||buffer.length>MAX_BYTES)return send(res,413,{error:"Compressed image must be 4 MB or smaller."});const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"}[m[1]];const filename=safeName(name).replace(/\s+/g,"-").toLowerCase();const blob=await put(PREFIX+Date.now()+"-"+randomUUID()+"-"+filename+"."+ext,buffer,{access:"public",contentType:m[1],addRandomSuffix:false,cacheControlMaxAge:31536000});return send(res,201,{image:{id:blob.pathname,url:blob.url,name:safeName(name)}})}
 if(req.method==="DELETE"){const id=String(req.body?.id||"");if(!id.startsWith(PREFIX)||id.includes(".."))return send(res,400,{error:"Invalid image reference."});const blob=(await allImages()).find(b=>b.pathname===id);if(!blob)return send(res,404,{error:"Image not found."});await del(blob.url);return send(res,200,{ok:true})}
 return requireMethod(req,res,["GET","POST","DELETE"]);
 }catch(e){return fail(res,e)}}
