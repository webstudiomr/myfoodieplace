import { db, fail, requireAdmin, requireMethod, send } from "../lib/db.js";

const statuses = new Set(["Pending","Preparing","Ready","Delivered","Cancelled"]);

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      const body = req.body || {};
      const customer = String(body.customer || "").trim();
      const phone = String(body.phone || "").trim();
      const address = String(body.address || "").trim();
      const location = body.location || null;
      if (!customer || customer.length > 100 || !/^[\p{L}]+(?: [\p{L}]+)*$/u.test(customer)) {
        return send(res, 400, {error:"Please enter a valid name using letters only."});
      }
      if (!/^03\d{9}$/.test(phone)) {
        return send(res, 400, {error:"Enter a Pakistani mobile number with exactly 11 digits, starting with 03."});
      }
      if (!address || address.length > 400 || !Array.isArray(body.items) || !body.items.length || body.items.length > 30) {
        return send(res, 400, {error:"Please provide your delivery address and order items."});
      }
      let savedAddress = address;
      if (location !== null) {
        const lat = Number(location.lat), lon = Number(location.lon);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
          return send(res, 400, {error:"The shared location is invalid. Please share it again or continue without it."});
        }
        savedAddress += "\nCustomer shared location: https://www.google.com/maps?q=" + lat + "," + lon;
      }
      const requested = new Map();
      for (const row of body.items) {
        const id = String(row?.id || "");
        const quantity = Number(row?.quantity);
        if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return send(res, 400, {error:"Invalid order item or quantity."});
        requested.set(id, (requested.get(id) || 0) + quantity);
      }
      const menu = await db("menu_items", "select=id,name,price,available");
      const items = [];
      for (const [id, quantity] of requested) {
        const dish = menu.find(item => item.id === id && item.available);
        if (!dish) return send(res, 400, {error:"One or more selected dishes are unavailable. Please refresh your menu."});
        items.push({id:dish.id,name:dish.name,price:Number(dish.price),quantity});
      }
      const total = items.reduce((sum,item) => sum + item.price * item.quantity, 0);
      const id = "FP-" + Date.now().toString(36).toUpperCase();
      const order = {id,customer,phone,address:savedAddress,items,total,status:"Pending",date:new Date().toISOString()};
      await db("orders", "", {method:"POST",body:order,prefer:"return=representation"});
      return send(res, 201, {order:{id,total,status:"Pending"}});
    }
    if (req.method === "GET") {
      if (!requireAdmin(req, res)) return;
      const rows = await db("orders", "select=*&order=created_at.desc");
      return send(res, 200, {orders:rows});
    }
    if (req.method === "PATCH") {
      if (!requireAdmin(req, res)) return;
      const {id,status} = req.body || {};
      if (!id || !statuses.has(status)) return send(res, 400, {error:"Valid order ID and status are required."});
      const rows = await db("orders", `id=eq.${encodeURIComponent(String(id))}`, {method:"PATCH",body:{status},prefer:"return=representation"});
      if (!rows?.length) return send(res, 404, {error:"Order not found."});
      return send(res, 200, {order:rows[0]});
    }
    return requireMethod(req, res, ["GET","POST","PATCH"]);
  } catch (error) { return fail(res, error); }
}
