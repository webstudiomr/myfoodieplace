import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { db, fail, requireAdmin, requireMethod, send } from "../lib/db.js";

const cleanPhone = value => String(value || "").replace(/\\D/g, "");
const validPhone = phone => /^03\\d{9}$/.test(phone);
const secret = () => process.env.FOODIE_ADMIN_KEY || "";
const hashCode = (id, code) => createHash("sha256").update(id + ":" + code + ":" + secret()).digest("hex");
const sessionFor = phone => {
  const payload = Buffer.from(JSON.stringify({ phone, exp: Date.now() + 30 * 60 * 1000 })).toString("base64url");
  return payload + "." + createHmac("sha256", secret()).update(payload).digest("base64url");
};

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (req.method === "GET") {
      if (!requireAdmin(req, res)) return;
      const rows = await db("order_tracking_otps", "select=id,phone,status,created_at,expires_at&status=eq.requested&order=created_at.asc&limit=50");
      return send(res, 200, { requests: rows || [] });
    }
    if (req.method !== "POST") return requireMethod(req, res, ["GET", "POST"]);
    const body = req.body || {};
    if (body.action === "request") {
      const phone = cleanPhone(body.phone);
      if (!validPhone(phone)) return send(res, 400, { error: "Enter the same 11-digit Pakistani mobile number used for your order." });
      const recent = await db("order_tracking_otps", "select=id,created_at&phone=eq." + encodeURIComponent(phone) + "&order=created_at.desc&limit=1");
      if (recent?.[0] && Date.now() - new Date(recent[0].created_at).getTime() < 60000) return send(res, 429, { error: "Please wait 60 seconds before requesting another code." });
      const rows = await db("orders", "select=id&phone=eq." + encodeURIComponent(phone) + "&limit=1");
      if (!rows?.length) return send(res, 200, { message: "If an eligible order exists, a verification request has been sent to the restaurant." });
      await db("order_tracking_otps", "", { method: "POST", body: { id: randomUUID(), phone, status: "requested", attempts: 0, created_at: new Date().toISOString() } });
      return send(res, 200, { message: "Verification request sent. The restaurant will send your code on WhatsApp." });
    }
    if (body.action === "verify") {
      const phone = cleanPhone(body.phone), code = String(body.code || "").trim();
      if (!validPhone(phone) || !/^\\d{6}$/.test(code)) return send(res, 400, { error: "Enter your phone number and the 6-digit code." });
      const rows = await db("order_tracking_otps", "select=id,phone,otp_hash,expires_at,attempts,status&phone=eq." + encodeURIComponent(phone) + "&status=eq.sent&order=created_at.desc&limit=1");
      const row = rows?.[0];
      if (!row || !row.otp_hash || new Date(row.expires_at).getTime() < Date.now()) return send(res, 400, { error: "That code has expired or is not available. Request a new code." });
      if (Number(row.attempts || 0) >= 5) return send(res, 429, { error: "Too many incorrect attempts. Request a new code." });
      const expected = Buffer.from(row.otp_hash, "hex"), supplied = Buffer.from(hashCode(row.id, code), "hex");
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
        await db("order_tracking_otps", "id=eq." + encodeURIComponent(row.id), { method: "PATCH", body: { attempts: Number(row.attempts || 0) + 1 }, prefer: "return=minimal" });
        return send(res, 400, { error: "Incorrect code. Please try again." });
      }
      await db("order_tracking_otps", "id=eq." + encodeURIComponent(row.id), { method: "PATCH", body: { status: "verified", verified_at: new Date().toISOString(), otp_hash: null }, prefer: "return=minimal" });
      return send(res, 200, { session: sessionFor(phone), message: "Phone number verified." });
    }
    if (body.action === "generate") {
      if (!requireAdmin(req, res)) return;
      const id = String(body.id || "");
      const rows = await db("order_tracking_otps", "select=id,phone,status,created_at&id=eq." + encodeURIComponent(id) + "&limit=1");
      const row = rows?.[0];
      if (!row || row.status !== "requested") return send(res, 404, { error: "Verification request not found or already handled." });
      const code = String(randomInt(0, 1000000)).padStart(6, "0");
      const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await db("order_tracking_otps", "id=eq." + encodeURIComponent(id), { method: "PATCH", body: { status: "sent", otp_hash: hashCode(id, code), expires_at: expires, attempts: 0, sent_at: new Date().toISOString() }, prefer: "return=minimal" });
      return send(res, 200, { phone: row.phone, code, expires_at: expires });
    }
    return send(res, 400, { error: "Unknown action." });
  } catch (error) { return fail(res, error); }
}
