# Trant Wallet

A crypto wallet web app with a React/Vite frontend and a Python FastAPI backend.

## Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, Wouter — lives in `artifacts/crypto-wallet/`
- **Backend**: FastAPI (Python 3.12), SQLAlchemy, SQLite — lives in `artifacts/python-api/`
- **Shared libs**: `lib/api-client-react` (generated API client), `lib/api-zod` (Zod schemas), `lib/api-spec` (OpenAPI spec), `lib/db` (Drizzle config)

## Running the project

Two workflows run in parallel (configured in `.replit`):

| Workflow | Command | Port |
|---|---|---|
| Python API | `cd artifacts/python-api && pip install -r requirements.txt -q && python main.py` | 8000 |
| Frontend | `PORT=5000 pnpm --filter @workspace/crypto-wallet dev` | 5000 |

The frontend proxies `/api/*` requests to the Python backend at port 8000.

## Package management

This is a pnpm workspace. Always use `pnpm` — never `npm` or `yarn`.

```bash
# Install all dependencies
pnpm install

# Add a package to the frontend
pnpm --filter @workspace/crypto-wallet add <package>

# Add a Python dependency
# Edit artifacts/python-api/requirements.txt then restart the Python API workflow
```

## Key directories

```
artifacts/
  crypto-wallet/   # React frontend (src/, public/)
  python-api/      # FastAPI backend (main.py, models.py, schemas.py, database.py)
lib/
  api-client-react/  # Auto-generated React Query hooks
  api-spec/          # OpenAPI spec + orval codegen config
  api-zod/           # Zod validation schemas
  db/                # Drizzle ORM config
```

## User preferences

- Uses Replit as primary editor
