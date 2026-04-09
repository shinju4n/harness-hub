# ---------------------------------------------------------------------------
# Stage 1: Builder
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

# Build Next.js (standalone output)
RUN pnpm build

# Compile server.ts into dist-server/
RUN pnpm exec tsc -p tsconfig.server.json

# Copy compiled server entry point into standalone output so `node server.js`
# starts the custom server instead of the default Next.js server.
RUN cp dist-server/server.js .next/standalone/server.js

# Copy compiled lib/ modules that server.ts imports at runtime.
RUN cp -r dist-server/lib .next/standalone/lib

# Ensure native modules (node-pty, ws, bcryptjs) are available in standalone.
# Next.js standalone traces dependencies but may miss native addons and ws.
RUN cp -r node_modules/node-pty .next/standalone/node_modules/node-pty 2>/dev/null || true
RUN cp -r node_modules/ws .next/standalone/node_modules/ws 2>/dev/null || true
RUN cp -r node_modules/bcryptjs .next/standalone/node_modules/bcryptjs 2>/dev/null || true
RUN cp -r node_modules/nan .next/standalone/node_modules/nan 2>/dev/null || true

# ---------------------------------------------------------------------------
# Stage 2: Runner
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

RUN apk add --no-cache python3

WORKDIR /app

ENV NODE_ENV=production
ENV HARNESS_HUB_MODE=web

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1

USER node

CMD ["node", "server.js"]
