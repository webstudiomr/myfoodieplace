import { db, fail, requireAdmin, requireMethod, send } from "../lib/db.js";

const starterMenu = [
  {id:"pizza",name:"Margherita Pizza",category:"Pizza",price:899,description:"Classic cheese, tomato and basil.",image:"https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=800&q=80",available:true},
  {id:"burger",name:"Classic Beef Burger",category:"Burger",price:649,description:"Juicy beef, fresh lettuce and cheese.",image:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",available:true},
  {id:"pasta",name:"Creamy Alfredo Pasta",category:"Pasta",price:749,description:"Creamy sauce, herbs and parmesan.",image:"https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=800&q=80",available:true},
  {id:"salad",name:"Garden Fresh Salad",category:"Salad",price:399,description:"Crunchy greens and house dressing.",image:"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",available:true},
  {id:"cake",name:"Chocolate Cake",category:"Dessert",price:349,description:"Rich chocolate and silky frosting.",image:"https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",available:true},
  {id:"drink",name:"Fresh Strawberry Drink",category:"Drink",price:249,description:"Cool, fruity and refreshing.",image:"https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80",available:true},
  {id:"pepperoni",name:"Pepperoni Pizza",category:"Pizza",price:1199,description:"Cheese, pepperoni and tomato sauce.",image:"https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=80",available:true},
  {id:"chicken",name:"Crispy Chicken Burger",category:"Burger",price:549,description:"Crispy chicken with creamy sauce.",image:"https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=800&q=80",available:true}
];

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      let rows = await db("menu_items", "select=*&order=created_at.asc");
      if (!rows.length) {
        await db("menu_items", "on_conflict=id", {method:"POST",body:starterMenu,prefer:"resolution=ignore-duplicates,return=representation"});
        rows = await db("menu_items", "select=*&order=created_at.asc");
      }
      return send(res, 200, { items: rows });
    }
    if (!requireMethod(req, res, ["POST","DELETE"])) return;
    if (!requireAdmin(req, res)) return;
    if (req.method === "POST") {
      const item = req.body || {};
      if (!item.id || !String(item.name || "").trim() || !String(item.category || "").trim() || !Number.isFinite(Number(item.price)) || Number(item.price) < 0) {
        return send(res, 400, {error:"A valid menu item is required."});
      }
      const clean = {id:String(item.id).slice(0,100),name:String(item.name).trim().slice(0,90),category:String(item.category).trim().slice(0,50),price:Number(item.price),description:String(item.description||"").slice(0,240),image:String(item.image||"").slice(0,2000),available:item.available !== false};
      const rows = await db("menu_items", "on_conflict=id", {method:"POST",body:clean,prefer:"resolution=merge-duplicates,return=representation"});
      return send(res, 200, {item:rows?.[0] || clean});
    }
    const id = String(req.query.id || "");
    if (!id) return send(res, 400, {error:"Menu item ID is required."});
    await db("menu_items", `id=eq.${encodeURIComponent(id)}`, {method:"DELETE",prefer:"return=minimal"});
    return send(res, 200, {ok:true});
  } catch (error) { return fail(res, error); }
}
