import { del, list, put } from "@vercel/blob";
import { timingSafeEqual } from "node:crypto";

const PREFIX = "foodie-images/";
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function authorized(request) {
  const expected = process.env.FOODIE_ADMIN_KEY || "";
  const supplied = request.headers.get("x-admin-key") || "";
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function listImages() {
  const images = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, ...(cursor ? { cursor } : {}) });
    for (const blob of page.blobs) {
      images.push({
        id: blob.pathname,
        name: blob.pathname.slice(PREFIX.length).replace(/-[A-Za-z0-9_-]{6,}(?=\.jpg$)/, "").replace(/\.jpg$/i, "") || "Food image",
        url: blob.url,
        createdAt: blob.uploadedAt,
        size: blob.size,
      });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  images.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return images;
}

export default async function handler(request) {
  if (!["GET", "POST", "DELETE"].includes(request.method)) {
    return json({ error: "Method not allowed." }, 405);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json({ error: "Vercel Blob token is missing. Check the Blob store connection and redeploy." }, 503);
  }
  if (!process.env.FOODIE_ADMIN_KEY) {
    return json({ error: "Cloud image storage is not configured yet. Add FOODIE_ADMIN_KEY in Vercel Environment Variables." }, 503);
  }
  if (!authorized(request)) return json({ error: "Invalid image-library key." }, 401);

  try {
    if (request.method === "GET") {
      return json({ images: await listImages() });
    }

    const body = await request.json();
    if (request.method === "POST") {
      const name = String(body.name || "Food image").trim().slice(0, 100) || "Food image";
      const data = String(body.data || "");
      const match = data.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return json({ error: "Image must be a valid JPEG. Please select the image again." }, 400);
      const buffer = Buffer.from(match[1], "base64");
      if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
        return json({ error: "Compressed image must be smaller than 3 MB. Choose a smaller image." }, 413);
      }
      const safeName = name.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "food-image";
      const blob = await put(`${PREFIX}${Date.now()}-${safeName}.jpg`, buffer, {
        access: "public",
        addRandomSuffix: true,
        contentType: "image/jpeg",
        cacheControlMaxAge: 31536000,
      });
      return json({ image: { id: blob.pathname, name, url: blob.url, createdAt: new Date().toISOString(), size: buffer.length } }, 201);
    }

    const id = String(body.id || "");
    if (!id.startsWith(PREFIX) || id.includes("..")) return json({ error: "Invalid image identifier." }, 400);
    const current = await listImages();
    const target = current.find(image => image.id === id);
    if (!target) return json({ error: "Image not found in this library." }, 404);
    await del(target.url);
    return json({ ok: true });
  } catch (error) {
    console.error("Foodie Place image API error:", error);
    return json({ error: "The image-storage request failed. Check Vercel function logs for details." }, 500);
  }
}
