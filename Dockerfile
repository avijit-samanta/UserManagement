# syntax=docker/dockerfile:1

# ---- Stage 1: install all workspace dependencies (incl. devDependencies, needed to build) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci --legacy-peer-deps

# ---- Stage 2: build the client (Vite) and server (tsc) bundles ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Stage 3: production runtime image ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy manifests + full node_modules, then strip devDependencies in place
# (avoids a second full "npm ci", reusing what Stage 1 already resolved).
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev --legacy-peer-deps

# Compiled output only — no TypeScript source needed at runtime.
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

# Run as a non-root user (default node:20-alpine ships a "node" user/group).
RUN chown -R node:node /app
USER node

# PORT (plain HTTP, redirects to HTTPS once a cert is mounted at
# /app/certs) and HTTPS_PORT (the actual app, TLS-terminated in-process) —
# see "Configuring the port" and "Running over HTTPS" in README.md. Default
# PORT is 8080, not 4000 — 4000 is reserved for local `npm run dev`.
EXPOSE 8080
EXPOSE 4443

# /healthz answers 200 on PORT whether it's serving the app directly (no
# cert mounted) or running redirect-only (cert mounted, real app on
# HTTPS_PORT) — see server/src/index.ts and server/src/routes/health.ts.
# Exec form so this runs as a direct process (no shell), while still
# inheriting the container's PORT env var.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "require('http').get({host:'127.0.0.1',port:process.env.PORT||8080,path:'/healthz',timeout:4000},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]

CMD ["node", "server/dist/index.js"]
