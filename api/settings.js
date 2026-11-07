import { db, fail, requireAdmin, requireMethod, send } from "../lib/db.js";

const defaults = {id:1,name:"Foodie Place",tagline:"Restaurant & Cafe",phone:"+92 300 1234567",whatsapp_phone:"",email:"hello@yourrestaurant.com",address:"Lahore, Pakistan",hours:"12 PM – 11 PM",currency:"Rs.",logo:""};

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
    const clean = {
      id:1,
      name:String(value.name || "Foodie Place").trim().slice(0,120),
      tagline:String(value.tagline || "").slice(0,160),
      phone:String(value.phone || "").slice(0,40),
      whatsapp_phone:String(value.whatsapp_phone || "").replace(/[^0-9+]/g,"").slice(0,20),
      email:String(value.email || "").slice(0,160),
      address:String(value.address || "").slice(0,400),
      hours:String(value.hours || "").slice(0,120),
      currency:String(value.currency || "Rs.").slice(0,8),
      logo:String(value.logo || "").slice(0,2000),
      delivery_fee:Math.max(0,Number(value.delivery_fee)||0),
      minimum_order:Math.max(0,Number(value.minimum_order)||0),
      estimated_delivery:String(value.estimated_delivery || "30–45 minutes").slice(0,80),
      is_open:value.is_open !== false,
      updated_at:new Date().toISOString()
    };
    const rows = await db("restaurant_settings", "on_conflict=id", {method:"POST",body:clean,prefer:"resolution=merge-duplicates,return=representation"});
    return send(res, 200, {settings:rows?.[0] || clean});
  } catch (error) { return fail(res, error); }
}
