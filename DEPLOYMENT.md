# Clarity Production Deployment

## Deployment Platform
- Target: Render Web Service (or any Python hosting service supporting Procfile)
- Service type: Web Service

## Build Command
pip install -r requirements.txt

## Start Command
gunicorn wsgi:app

## Runtime
Python 3.12

## Environment Variables (Required)
- OPENROUTER_API_KEY: Secret (required for chat/model test)
- FLASK_SECRET: Secret (optional but recommended)
- PORT: Provided by platform (used by gunicorn --bind :$PORT)

## CORS Configuration
The frontend runs at:
https://clarity.kk7776646.workers.dev/

The Flask backend must allow this origin when using credentials/session cookies. The existing `flask-cors` package is included in requirements but is not currently imported in `server/app.py`. For production deployment with same-origin proxy via Cloudflare Worker, CORS is handled by the proxy (same-origin to browser). If direct cross-origin access is needed, import `flask_cors` and configure:

from flask_cors import CORS
CORS(app, origins=["https://clarity.kk7776646.workers.dev"], supports_credentials=True)

## Secrets
- OPENROUTER_API_KEY: Configure in hosting platform secrets/environment variables. Never commit to source.
- FLASK_SECRET: Configure in hosting platform secrets/environment variables.

## Render Configuration
- Root Directory: . (repository root)
- Build Command: pip install -r requirements.txt
- Start Command: gunicorn wsgi:app
- Runtime: Python 3.12 (specified in runtime.txt)

## Deployment Files (Existing)
- Procfile
- runtime.txt
- wsgi.py
- requirements.txt (at repository root, copied from server/requirements.txt for Render compatibility)
- server/app.py (Flask backend source)
- server/ (full backend package)

## Important Notes
- Do NOT hardcode `localhost:5000` for production backend access.
- The Cloudflare Worker (`clarity`) proxies `/api/*` to `BACKEND_URL`. The `BACKEND_URL` environment variable in the production Worker must be set to the REAL deployed Flask HTTPS URL after deployment.
- The frontend chat endpoint is `/api/conversations/<cid>/chat` (Flask backend), not `/api/chat` (Worker standalone proxy).
- All 36 Flask API routes must remain intact.
- No mock APIs, no duplicate backends, no hidden errors.
