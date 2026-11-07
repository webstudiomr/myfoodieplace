import { db, fail, requireAdmin, requireMethod, send } from "../lib/db.js";

const defaults = {id:1,name:"Foodie Place",tagline:"Restaurant & Cafe",phone:"",whatsapp_phone:"",email:"",address:"Lahore, Pakistan",hours:"12 PM – 11 PM",currency:"Rs.",logo:"",delivery_fee:0,minimum_order:0,estimated_delivery:"30–45 minutes",is_open:true};

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      let rows = await db("restaurant_settings", "select=*&id=eq.1&limit=1");
      if (!rows.length) {
        await db("restaurant_settings", "on_conflict=id", {method:"POST",body:defaults,prefer:"resolution=ignore-duplicates,return=representation"});
        rows = await db("restaurant_settings", "select=*&id=eq.1&limit=1");
      }
      return send(res, 200, {settings:rows[0] || defaults});
    }
    if (!requireMethod(req, res, ["POST"])) return;
    if (!requireAdmin(req, res)) return;
    const value = req.body || {};
    const existingRows = await db("restaurant_settings", "select=*&id=eq.1&limit=1");
    const existing = existingRows?.[0] || defaults;
    const clean = {
      ...existing,
      id:1,
      phone:String(value.phone ?? existing.phone ?? "").trim().slice(0,40),
      whatsapp_phone:String(value.whatsapp_phone ?? existing.whatsapp_phone ?? "").replace(/[^0-9+]/g,"").slice(0,20),
      email:String(value.email ?? existing.email ?? "").trim().slice(0,160),
      address:String(value.address ?? existing.address ?? "").trim().slice(0,400),
      hours:String(value.hours ?? existing.hours ?? "").trim().slice(0,120),
      updated_at:new Date().toISOString()
    };
    const rows = await db("restaurant_settings", "on_conflict=id", {method:"POST",body:clean,prefer:"resolution=merge-duplicates,return=representation"});
    return send(res, 200, {settings:rows?.[0] || clean});
  } catch (error) { return fail(res, error); }
}
