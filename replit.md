# Crypto Wallet

A crypto wallet application consisting of a React frontend, a Node.js API server, and a Python FastAPI backend.

## Project structure

| Path | Description |
|------|-------------|
| `artifacts/crypto-wallet/` | React + Vite frontend (Radix UI / Tailwind) |
| `artifacts/api-server/` | Node.js / Express API server |
| `artifacts/python-api/` | Python FastAPI backend (port 8000) |
| `lib/db/` | Drizzle ORM schema and DB client |
| `lib/api-spec/` | OpenAPI spec + Orval codegen config |
| `lib/api-client-react/` | Generated React Query hooks |
| `lib/api-zod/` | Generated Zod validation schemas |
| `nginx.conf` | nginx reverse-proxy config (Docker) |
| `Dockerfile` / `Dockerfile.frontend` | Docker build files |
| `docker-compose.yml` | Compose file for local Docker dev |

## Usage

This project is used on Replit primarily for **code editing and Git commits**. The app is not expected to run inside Replit itself.

To push changes to GitHub, use the Git panel or the shell:

```bash
git add .
git commit -m "your message"
git push
```

## User preferences

- Replit is used as an editor and for Git — not for running the app.
