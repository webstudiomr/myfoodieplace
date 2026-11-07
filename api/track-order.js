import { createHmac, timingSafeEqual } from "node:crypto";
import { db, fail, requireMethod, send } from "../lib/db.js";

function verifiedPhone(token) {
  try {
    const [payload, signature] = String(token || "").split(".");
    if (!payload || !signature || !process.env.FOODIE_ADMIN_KEY) return null;
    const expected = createHmac("sha256", process.env.FOODIE_ADMIN_KEY).update(payload).digest("base64url");
    const a = Buffer.from(signature), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.phone || !/^03\\d{9}$/.test(data.phone) || Number(data.exp) < Date.now()) return null;
    return data.phone;
  } catch { return null; }
}

export default async function handler(req, res) {
  try {
    if (!requireMethod(req, res, ["GET"])) return;
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const token = String(req.query?.token || "").trim().toLowerCase();
    if (token && /^[a-f0-9]{32}$/.test(token)) {
      const rows = await db("orders", `tracking_token=eq.${encodeURIComponent(token)}&select=id,status,date,total,created_at&limit=1`);
      return send(res, 200, {orders:(rows||[]).filter(order=>!["Delivered","Cancelled"].includes(order.status)).map(order=>({id:order.id,status:order.status,date:order.date||order.created_at,total:Number(order.total||0)}))});
    }
    const phone = verifiedPhone(req.query?.session);
    if (!phone) return send(res, 401, { error: "Verify your phone number with the WhatsApp code before viewing orders." });
    const rows = await db("orders", `phone=eq.${encodeURIComponent(phone)}&select=id,status,date,total,created_at&order=created_at.desc&limit=20`);
    const active = (rows||[]).filter(order=>!["Delivered","Cancelled"].includes(order.status));
    return send(res, 200, {orders:active.map(order=>({id:order.id,status:order.status,date:order.date||order.created_at,total:Number(order.total||0)}))});
  } catch (error) { return fail(res, error); }
}
