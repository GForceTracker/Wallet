---
name: Docker deployment
description: Docker + nginx setup for Render/Northflank deployment
---

Three containers: `db` (postgres:16), `api` (Python FastAPI), `frontend` (nginx + React build).

**Why:** nginx reverse-proxies `/api/` to the Python service — no CORS issues in production. The frontend build is static files served by nginx.

**How to apply:**
- `Dockerfile.frontend` passes `PORT=3000 BASE_PATH=/` at build time (vite.config.ts no longer throws if these are missing)
- `artifacts/python-api/Dockerfile` installs `curl` (needed for docker-compose healthcheck `curl -f http://localhost:8000/healthz`)
- Render uses `postgres://` connection strings; `database.py` auto-rewrites to `postgresql://` for SQLAlchemy
- CORS: `allow_origins=["*"]` requires `allow_credentials=False` — using both together is a browser security error
