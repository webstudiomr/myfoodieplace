import { db, fail, requireMethod, send } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    if (!requireMethod(req, res, ["GET"])) return;
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const phone = String(req.query?.phone || "").trim();
    if (!phone || phone.length > 30) {
      return send(res, 400, { error: "Please enter the phone number used when placing your order." });
    }
    // Match the exact phone string used at checkout. Only return tracking-safe fields.
    const rows = await db(
      "orders",
      `phone=eq.${encodeURIComponent(phone)}&select=id,status,date,total,created_at&order=created_at.desc&limit=20`
    );
    return send(res, 200, {
      orders: (rows || []).map(order => ({
        id: order.id,
        status: order.status,
        date: order.date || order.created_at,
        total: Number(order.total || 0)
      }))
    });
  } catch (error) {
    return fail(res, error);
  }
}
