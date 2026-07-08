---
name: Python API setup
description: How the FastAPI backend is wired up in this Replit project
---

The Python backend lives in `artifacts/python-api/`. A `Python API` workflow runs it on port 8000.

**Why:** Replit doesn't have python/pip on PATH by default — the `python-3.12` module must be installed first via `installProgrammingLanguage`. Once installed, `pip` and `python3` become available.

**How to apply:** If the Python API workflow fails with "pip: command not found", the python-3.12 module is missing — reinstall it. The workflow command is:
`cd artifacts/python-api && pip install -r requirements.txt -q && python main.py`

The Vite dev server proxies `/api/*` → `http://localhost:8000` so the frontend always calls `/api` regardless of environment (see `vite.config.ts` server.proxy).
