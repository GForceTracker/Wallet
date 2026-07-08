# Crypto Wallet

A mobile-style crypto wallet app (Bitcoin, Ethereum, Tether) with a Python FastAPI backend that stores all data in PostgreSQL, deployable to Render or Northflank via Docker.

## Run & Operate

- **Frontend (dev):** managed by the `artifacts/crypto-wallet: web` workflow (Vite, auto-assigned port)
- **Python API (dev):** managed by the `Python API` workflow — runs FastAPI on port 8000
- `pnpm run typecheck` — full TypeScript typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Required env: `DATABASE_URL` — Postgres connection string (defaults to SQLite `./wallet.db` if not set)

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- **Frontend:** React 18 + Vite, Tailwind CSS, Radix UI, Framer Motion
- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2, Uvicorn
- **Database:** PostgreSQL (production) / SQLite (local dev fallback)
- Build: esbuild (Node.js API bundle), Vite (frontend)

## Where things live

- `artifacts/crypto-wallet/` — React/Vite frontend
  - `src/api.ts` — API client (all backend calls go here)
  - `src/store.ts` — shared TypeScript types only
  - `src/views/` — screen-level components (Login, UserWallet, Admin, AssetDetails, SendWithdraw)
- `artifacts/python-api/` — FastAPI backend
  - `main.py` — all routes
  - `models.py` — SQLAlchemy ORM models
  - `schemas.py` — Pydantic request/response schemas
  - `database.py` — DB engine + session factory
- `docker-compose.yml` — full stack (postgres + api + frontend via nginx)
- `Dockerfile.frontend` — multi-stage React build → nginx
- `artifacts/python-api/Dockerfile` — Python API image
- `nginx.conf` — proxies `/api/` → Python backend, `/` → static frontend

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/wallet` | Get current balances |
| PUT | `/api/wallet` | Admin: update balances |
| GET | `/api/transactions` | Get transaction history |
| POST | `/api/transactions` | Send/withdraw (deducts gas fee) |
| GET | `/api/settings` | Get gas fee + crypto prices |
| PUT | `/api/settings` | Admin: update gas fee & prices |
| GET | `/healthz` | Health check |

## Credentials

- **User:** `Miachen` / `GJE8AT2021$`
- **Admin:** `Admin` / `Admin123`

## Docker Deployment (Render / Northflank)

```bash
# Local full-stack test
docker compose up --build

# Render: deploy artifacts/python-api as a Web Service (Dockerfile at artifacts/python-api/Dockerfile)
# Render: deploy frontend as a Static Site (build: pnpm --filter @workspace/crypto-wallet run build, publish: artifacts/crypto-wallet/dist/public)
# Set DATABASE_URL to your Render PostgreSQL connection string
```

## Architecture decisions

- Python FastAPI replaces the Node.js Express backend — all wallet state is persisted in PostgreSQL, not localStorage
- The Vite dev server proxies `/api/*` to `http://localhost:8000`, so the frontend always calls `/api` regardless of environment
- Docker: nginx serves the built frontend and reverse-proxies `/api/` to the Python service — no CORS issues in production
- `DATABASE_URL` starting with `postgres://` is auto-rewritten to `postgresql://` for SQLAlchemy compatibility (Render uses the older format)
- Admin panel controls both user balances and the gas fee (USD + BTC amounts) — all persisted in the `settings` table

## User preferences

_Populate as you build._

## Gotchas

- The `Python API` workflow installs pip packages on first start (`pip install -r requirements.txt`) — first boot takes ~10 s
- In Docker builds, `PORT` and `BASE_PATH` are not required env vars (the Dockerfile sets safe defaults: `PORT=3000`, `BASE_PATH=/`)
- `psycopg2-binary` is used for simplicity; for production scale consider `psycopg2` built from source
