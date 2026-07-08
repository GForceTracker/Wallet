# ── Stage 1: Build the React frontend ─────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app

RUN npm install -g pnpm@10

# ── Workspace manifests (all packages must be present for --frozen-lockfile) ──
# Copy root-level config first (layer-cached until these change)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY tsconfig.base.json tsconfig.json ./

# Stub every workspace package's package.json so pnpm can resolve the lockfile
# without needing the full source of packages we won't build.
COPY artifacts/crypto-wallet/package.json  ./artifacts/crypto-wallet/package.json
COPY artifacts/api-server/package.json     ./artifacts/api-server/package.json
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/package.json
COPY lib/api-client-react/package.json     ./lib/api-client-react/package.json
COPY lib/api-spec/package.json             ./lib/api-spec/package.json
COPY lib/api-zod/package.json              ./lib/api-zod/package.json
COPY lib/db/package.json                   ./lib/db/package.json
COPY scripts/package.json                  ./scripts/package.json

# Install all deps (lockfile now validates correctly)
RUN pnpm install --frozen-lockfile

# ── Copy source only for what we need to build ────────────────────────────────
COPY artifacts/crypto-wallet/ ./artifacts/crypto-wallet/
COPY lib/ ./lib/

# Vite build (BASE_PATH=/ for standalone Docker; PORT is only needed at dev time)
ENV BASE_PATH=/ PORT=3000 NODE_ENV=production
RUN pnpm --filter @workspace/crypto-wallet run build

# ── Stage 2: Python API that also serves the built frontend ────────────────────
FROM python:3.12-slim
WORKDIR /app

# curl is used by the docker-compose healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY artifacts/python-api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY artifacts/python-api/ .

# Copy the compiled React app into ./static so Python can serve it
COPY --from=frontend-builder /app/artifacts/crypto-wallet/dist/public ./static

EXPOSE 8000
CMD ["python", "main.py"]
