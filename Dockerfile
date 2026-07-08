# ── Stage 1: Build the React frontend ─────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app

RUN npm install -g pnpm@9

# Copy workspace manifests (layer-cached until these files change)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY tsconfig.base.json tsconfig.json ./

# Copy shared libraries and the frontend artifact
COPY lib/ ./lib/
COPY artifacts/crypto-wallet/ ./artifacts/crypto-wallet/

RUN pnpm install --frozen-lockfile

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
