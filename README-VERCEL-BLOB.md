# Foodie Place — Vercel Blob image library update

This package preserves the existing red-and-white HTML/CSS design and adds a Vercel Function for the Image Library.

## Before deploying

1. Keep a backup of the current repository.
2. Replace the repository files with the files in this folder, keeping `index.html`, `admin.html`, `style.css`, `script.js`, `package.json`, and `api/images.js` at the repository root / `api` folder as shown.
3. In Vercel → your project → Settings → Environment Variables, add `FOODIE_ADMIN_KEY` for Production (and Preview if you test preview deployments). Use a long, random secret (at least 32 characters). Do not put this key in HTML/JS, commit it to GitHub, or share it in chat.
4. Confirm `BLOB_READ_WRITE_TOKEN` exists in the Vercel project environment. It should be created when the Blob store was connected. Do not reveal its value.
5. Commit the files to GitHub and wait for Vercel to redeploy.
6. Open `/admin.html`, go to Image Library, enter the `FOODIE_ADMIN_KEY` value, and click Connect storage.
7. Upload a test image, then verify it appears in the Image Library and in Vercel → Storage → your Blob store.

## Important scope and security

- Public Blob URLs can be viewed by anyone who has the URL; only upload/delete/list operations are protected by the shared key.
- This is a safer testing bridge, not a full user-authentication system. For production, replace the shared key with real admin authentication and authorization.
- Menu data, restaurant settings, and orders still use browser localStorage in this version. This update makes the image library cloud-backed; it does not make menu edits or customer orders shared between devices.
- Existing browser-only images are offered for migration when you connect. Keep your backup until you verify migration.
- Images are resized in the browser and uploaded as JPEGs. The server endpoint rejects non-JPEG payloads and files over 3 MB.
