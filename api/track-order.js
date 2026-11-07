import { db, fail, requireMethod, send } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    if (!requireMethod(req, res, ["GET"])) return;
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const token = String(req.query?.token || "").trim().toLowerCase();
    const phone = String(req.query?.phone || "").replace(/\\D/g, "");
    if (token && /^[a-f0-9]{32}$/.test(token)) {
      const rows = await db("orders", `tracking_token=eq.${encodeURIComponent(token)}&select=id,status,date,total,created_at&limit=1`);
      return send(res, 200, {orders:(rows||[]).filter(order=>!["Delivered","Cancelled"].includes(order.status)).map(order=>({id:order.id,status:order.status,date:order.date||order.created_at,total:Number(order.total||0)}))});
    }
    if (!/^03\\d{9}$/.test(phone)) return send(res, 400, {error:"Enter your Pakistani mobile number with 11 digits, starting with 03."});
    const rows = await db("orders", `phone=eq.${encodeURIComponent(phone)}&select=id,status,date,total,created_at&order=created_at.desc&limit=20`);
    const active = (rows||[]).filter(order=>!["Delivered","Cancelled"].includes(order.status));
    return send(res, 200, {orders:active.map(order=>({id:order.id,status:order.status,date:order.date||order.created_at,total:Number(order.total||0)}))});
  } catch (error) { return fail(res, error); }
}
