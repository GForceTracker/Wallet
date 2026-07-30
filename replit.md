# TRANT Wallet

A crypto wallet web app with a React/Vite frontend and a Python FastAPI backend.

## Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, shadcn/ui components (`artifacts/crypto-wallet/`)
- **Backend**: Python FastAPI + SQLAlchemy (`artifacts/python-api/`)
- **Shared libs**: OpenAPI spec, Zod schemas, API client (`lib/`)
- **Package manager**: pnpm workspaces

## How to run

Two workflows run in parallel (configured in `.replit`):

| Workflow | Command | Port |
|---|---|---|
| **Python API** | `cd artifacts/python-api && pip install -r requirements.txt -q && python main.py` | 8000 |
| **Frontend** | `PORT=5000 pnpm --filter @workspace/crypto-wallet dev` | 5000 |

Start both via the **Project** run button, or restart them individually from the Workflows panel.

## Key features

- User signup / login with session auth
- Crypto wallet with deposit, withdrawal (pending admin approval), and transaction history
- Admin panel for approving/rejecting withdrawals and managing users
- Profile photo upload
- PWA install banner (Android + iOS)

## Environment secrets

- `SESSION_SECRET` — required for session signing

## User preferences

<!-- Add any user preferences here -->
