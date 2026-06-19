# Backend Hosting — MongoDB Atlas + Render (Step-by-Step)

This deploys the EDI SETP 2026 FastAPI backend so the PWA can reach it at a
public HTTPS URL. ~20–30 minutes total. All free-tier friendly.

The backend only needs: fastapi, uvicorn, motor, pymongo, pydantic,
python-dotenv, passlib, bcrypt, python-jose, python-multipart, email-validator,
tzdata. Use `backend/requirements.prod.txt` (NOT requirements.txt, which has a
private package + dev tools that break a public build).

================================================================
PART 1 — MongoDB Atlas (the database)
================================================================
1. Sign up / log in at https://www.mongodb.com/cloud/atlas
2. Create a project → "Build a Database" → choose the FREE **M0** tier.
   Pick a cloud/region close to your delegates (e.g. AWS eu-west / London).
3. Create a database user:
   - Security → Database Access → "Add New Database User"
   - Username e.g. `setp_admin`, generate a strong password, SAVE IT.
   - Role: "Read and write to any database".
4. Network access:
   - Security → Network Access → "Add IP Address" → "Allow access from
     anywhere" (0.0.0.0/0). (Render's IPs are dynamic; this is the simple path.)
5. Get the connection string:
   - Database → "Connect" → "Drivers" → copy the SRV URI. It looks like:
     `mongodb+srv://setp_admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   - Replace `<password>` with your real password.
   - Keep this string for PART 2 (it becomes MONGO_URL).

================================================================
PART 2 — Render (the FastAPI server)
================================================================
Prereq: your code is on GitHub (repo: tjp0077-coder/Telboy-SETP). Make sure the
new files `backend/requirements.prod.txt` are pushed (use the Save to GitHub
button in Emergent).

1. Sign up / log in at https://render.com (you can use GitHub login).
2. Click "New +" → "Web Service" → connect the GitHub repo `Telboy-SETP`.
3. Configure the service:
   - Name:            setp-2026-api  (any name)
   - Region:          same area as your Atlas cluster
   - Branch:          main
   - Root Directory:  backend
   - Runtime:         Python 3
   - Build Command:   pip install -r requirements.prod.txt
   - Start Command:   uvicorn server:app --host 0.0.0.0 --port $PORT
   - Instance Type:   Free
4. Add Environment Variables (Render → Environment). Copy from backend/.env but
   set MONGO_URL to your Atlas URI and use STRONG production secrets:
   - MONGO_URL                  = <your Atlas SRV URI from PART 1>
   - DB_NAME                    = setp2026
   - JWT_SECRET_KEY             = <a long random string — CHANGE from default>
   - JWT_ALGORITHM              = HS256
   - ACCESS_TOKEN_EXPIRE_MINUTES= 1440
   - ADMIN1_USERNAME            = dave.mackay
   - ADMIN1_PASSWORD            = <new strong password>
   - ADMIN1_NAME                = Dave Mackay
   - ADMIN2_USERNAME            = terry.parker
   - ADMIN2_PASSWORD            = <new strong password>
   - ADMIN2_NAME                = Terry Parker
   - ADMIN3_USERNAME            = (leave blank)
   - ADMIN3_PASSWORD            = (leave blank)
   - ADMIN3_NAME                = (leave blank)
5. Click "Create Web Service". Render builds & deploys (a few minutes).
6. When live, your URL is e.g. `https://setp-2026-api.onrender.com`.

================================================================
PART 3 — Verify the backend
================================================================
Open in a browser / curl:
  https://<your-render-url>/api/schedule   → should return JSON sessions
  https://<your-render-url>/api/feed        → should return JSON messages
  https://<your-render-url>/api/city-guide  → should return JSON
If those return data, the DB seeded correctly and the backend is good.

(Note: Render free tier sleeps after ~15 min idle; first request after sleep
takes ~30–60s to wake. Fine for a delegate app; upgrade to a paid instance to
avoid cold starts during the event.)

================================================================
PART 4 — Point the frontend at the backend, then build
================================================================
1. In `frontend/.env` set:
   EXPO_PUBLIC_BACKEND_URL=https://<your-render-url>
2. Rebuild the PWA:
   cd frontend && yarn build:web
3. Deploy `frontend/dist/` to Netlify/Vercel (see DEPLOYMENT.md).
4. Get the frontend URL → generate the delegate QR code.

================================================================
Troubleshooting
================================================================
- Build fails on pip: confirm Build Command uses requirements.prod.txt.
- 500 errors / can't connect to DB: re-check MONGO_URL password + that Network
  Access allows 0.0.0.0/0 in Atlas.
- App loads but no data: open browser devtools → Network → confirm calls go to
  your Render URL (means EXPO_PUBLIC_BACKEND_URL was set before yarn build:web).
- CORS error: backend already allows all origins; if you later restrict it, add
  your frontend URL to allow_origins in server.py.
