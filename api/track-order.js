import { db, fail, requireMethod, send } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    if (!requireMethod(req, res, ["GET"])) return;
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const token = String(req.query?.token || "").trim();
    if (!/^[a-f0-9]{32}$/.test(token)) {
      return send(res, 400, {error:"Enter the private tracking code from your order confirmation."});
    }
    const rows = await db("orders", `tracking_token=eq.${encodeURIComponent(token)}&select=id,status,date,total,created_at&limit=1`);
    return send(res, 200, {orders:(rows||[]).map(order=>({id:order.id,status:order.status,date:order.date||order.created_at,total:Number(order.total||0)}))});
  } catch (error) { return fail(res, error); }
}
