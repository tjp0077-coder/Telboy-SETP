# EDI SETP 2026 — PWA Hosting Plan

Goal: one public URL → one QR code for delegates, with the ability to push
updates by rebuilding/redeploying. The app is an installable, offline-capable
PWA. It has **two parts that both need hosting**:

1. **Frontend** — static web export (the `frontend/dist/` folder) → any static host
2. **Backend** — FastAPI + MongoDB (the `backend/` folder) → an app host + a database

---

## A. Build the production frontend (PWA)

From `frontend/`:

```bash
# 1. Point the app at your PRODUCTION backend URL (baked in at build time):
#    Edit frontend/.env  ->  EXPO_PUBLIC_BACKEND_URL=https://<your-backend-host>
# 2. Build + inject PWA tags in one step:
yarn build:web
```

This produces `frontend/dist/` containing `index.html` (with PWA `<head>` tags +
service-worker registration injected), hashed JS, `manifest.webmanifest`,
`sw.js`, and `/icons/`.

> The `build:web` script runs `expo export --platform web` then
> `scripts/inject-pwa.js`, which patches `dist/index.html` so the export is a
> full PWA (Expo's `output: "single"` mode does not apply `app/+html.tsx`).

---

## B. Host the frontend (pick ONE)

### Option 1 — Netlify (drag-and-drop, fastest)
1. Go to https://app.netlify.com/drop and drag the `frontend/dist` folder in.
2. You instantly get an HTTPS URL (e.g. `https://your-app.netlify.app`).
3. SPA + headers: add `frontend/dist/_redirects` containing:
   ```
   /sw.js   /sw.js   200
   /*       /index.html   200
   ```
   (so deep links work and the service worker is served correctly)

### Option 2 — Vercel (auto-deploy on Git push = seamless updates)
- Import the `Telboy-SETP` GitHub repo at https://vercel.com/new
- Root directory: `frontend`
- Build command: `yarn build:web`   |   Output directory: `dist`
- Add env var `EXPO_PUBLIC_BACKEND_URL` = your backend URL
- Add a `frontend/vercel.json` for SPA routing:
  ```json
  { "rewrites": [{ "source": "/((?!sw.js|manifest.webmanifest|icons/|_expo/|assets/|favicon).*)", "destination": "/index.html" }] }
  ```
- Every `git push` redeploys automatically → instant updates.

### Option 3 — GitHub Pages
- Push `dist/` to a `gh-pages` branch. Works, but custom headers/SPA routing
  are more fiddly than Netlify/Vercel. Use only if you already use Pages.

> ⚠️ Service-worker caching note: host `sw.js` with a short/no cache header so
> new service-worker versions are picked up. The SW itself is already
> **network-first for HTML**, so once a new SW activates, delegates get design
> updates on their next visit.

---

## C. Host the backend (FastAPI + MongoDB)

The frontend calls `EXPO_PUBLIC_BACKEND_URL + /api/...`. You need:

1. **MongoDB** — create a free cluster at **MongoDB Atlas**, get the connection
   string (SRV URI).
2. **FastAPI app** — deploy `backend/` to **Render** (or Railway / Fly.io):
   - Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - Env vars: copy from `backend/.env`, set `MONGO_URL` to your Atlas URI.
   - Ensure CORS allows your frontend origin (the Netlify/Vercel URL).
3. Take the backend's public URL (e.g. `https://setp-api.onrender.com`) and put
   it into `frontend/.env` as `EXPO_PUBLIC_BACKEND_URL`, then re-run
   `yarn build:web` and redeploy the frontend.

> The backend auto-seeds 3 admins + schedule + welcome message on startup.
> Update `/app/memory/test_credentials.md` with the admin login you intend to use.

---

## D. Generate the delegate QR code

Once the frontend URL is live, create a QR pointing to it:
- Any QR generator (e.g. https://www.qr-code-generator.com) → paste the URL.
- Or tell the assistant the URL and it will generate one for you.
- Delegates scan → app opens in browser → "Add to Home Screen" for an app icon.

---

## E. Pushing updates later (seamless)

1. Make changes in the repo.
2. Frontend: `yarn build:web` → redeploy `dist/` (or just `git push` if using
   Vercel auto-deploy).
3. Backend: redeploy `backend/` on Render/Railway if you changed it.
4. Delegates get the new design on their next app open (network-first SW).

---

## Quick checklist
- [ ] MongoDB Atlas cluster created, connection string ready
- [ ] Backend deployed (Render/Railway), CORS allows frontend origin
- [ ] `EXPO_PUBLIC_BACKEND_URL` set to backend URL in `frontend/.env`
- [ ] `yarn build:web` run → `frontend/dist/` produced
- [ ] Frontend deployed (Netlify/Vercel) with SPA routing rule
- [ ] Visited the URL on a phone → installs + works offline
- [ ] QR code generated and shared with delegates
