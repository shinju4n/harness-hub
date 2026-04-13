# ---------------------------------------------------------------------------
# Stage 1: Builder
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

# Build Next.js (standalone output).
# This generates .next/standalone/server.js with the baked-in nextConfig.
RUN pnpm build

# Extract the nextConfig JSON from the Next.js-generated standalone server.js
# and save it as .next-config.json inside the standalone directory.
# Our custom server reads this at startup to set __NEXT_PRIVATE_STANDALONE_CONFIG,
# which tells Next.js to skip webpack-lib loading (not available in standalone).
RUN grep '^const nextConfig = ' .next/standalone/server.js | sed 's/^const nextConfig = //' > .next/standalone/.next-config.json && echo "nextConfig saved"

# Bundle server.ts and all pure-JS dependencies (ws, bcryptjs, lib/*) into a
# single self-contained server.js using esbuild.
# - node-pty: native addon — must stay external and be copied separately.
# - next: already present in the standalone output — keep external.
# Node built-ins are automatically external with --platform=node.
RUN pnpm exec esbuild server.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --external:node-pty \
  --external:next \
  --outfile=.next/standalone/server.js

# Copy node-pty (native addon that cannot be bundled).
# Use -L to dereference pnpm symlinks so actual files are copied.
RUN cp -rL node_modules/node-pty .next/standalone/node_modules/node-pty 2>/dev/null || true

# ---------------------------------------------------------------------------
# Stage 2: Runner
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

RUN apk add --no-cache python3

WORKDIR /app

ENV NODE_ENV=production
ENV HARNESS_HUB_MODE=web
# Override HOSTNAME (Docker sets it to the container ID by default).
# Without this, server.listen() binds to the container ID hostname
# instead of 0.0.0.0, which can prevent external connections.
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1

USER node

CMD ["node", "server.js"]
