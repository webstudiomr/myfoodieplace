import { db, fail, requireAdmin, requireMethod, send } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      let rows = await db("menu_items", "select=*&order=created_at.asc");
      return send(res, 200, { items: rows });
    }
    if (!requireMethod(req, res, ["POST","DELETE"])) return;
    if (!requireAdmin(req, res)) return;
    if (req.method === "POST") {
      const item = req.body || {};
      if (!item.id || !String(item.name || "").trim() || !String(item.category || "").trim() || !Number.isFinite(Number(item.price)) || Number(item.price) < 0) {
        return send(res, 400, {error:"A valid menu item is required."});
      }
      const clean = {id:String(item.id).slice(0,100),name:String(item.name).trim().slice(0,90),category:String(item.category).trim().slice(0,50),price:Number(item.price),description:String(item.description||"").slice(0,240),image:String(item.image||"").slice(0,2000),available:item.available !== false,...(String(item.category).trim()==="Combo Deal"?{deal_items:Array.isArray(item.deal_items)?item.deal_items.slice(0,20).map(part=>({quantity:Math.min(20,Math.max(1,Number(part?.quantity)||1)),name:String(part?.name||"").trim().slice(0,90)})).filter(part=>part.name):[]}:{})};
      const rows = await db("menu_items", "on_conflict=id", {method:"POST",body:clean,prefer:"resolution=merge-duplicates,return=representation"});
      return send(res, 200, {item:rows?.[0] || clean});
    }
    const id = String(req.query.id || "");
    if (!id) return send(res, 400, {error:"Menu item ID is required."});
    await db("menu_items", `id=eq.${encodeURIComponent(id)}`, {method:"DELETE",prefer:"return=minimal"});
    return send(res, 200, {ok:true});
  } catch (error) { return fail(res, error); }
}
