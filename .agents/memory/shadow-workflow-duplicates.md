---
name: Duplicate shadow workflows in this project
description: Extra auto-created artifacts/workflows exist alongside the real crypto-wallet app; they are not wired into .replit and should be ignored.
---

The platform auto-created three extra artifacts/workflows that duplicate or shadow pieces of the real app, on different ports, not referenced by `.replit`:
- `artifacts/crypto-wallet: web` — duplicate Vite dev server for the same crypto-wallet frontend.
- `artifacts/mockup-sandbox: Component Preview Server` — unrelated canvas scaffolding, missing `node_modules`.
- `artifacts/api-server: API Server` — a separate Express/TS scaffold, missing `node_modules`/esbuild, not wired into the real backend.

**Why:** These frequently show as FAILED in workflow status checks, which looks alarming but is unrelated to the real app's health.

**How to apply:** The real, user-facing app is only the `Python API` (FastAPI, port 8000, `artifacts/python-api`) + `Frontend` (Vite, port 5000, `artifacts/crypto-wallet`) workflow pair defined in `.replit`. Verify those two are running; ignore FAILED status on the three shadow workflows unless the user specifically asks about them.
