FROM node:26.8-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app
RUN npm install -g pnpm@10.33.0
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.json ./
COPY apps/whatsapp-edge/package.json apps/whatsapp-edge/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild
RUN pnpm --filter @spoke/db generate
COPY apps/whatsapp-edge/ apps/whatsapp-edge/
RUN pnpm --filter @spoke/whatsapp-edge build

FROM base
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 3001
CMD ["node_modules/.bin/tsx", "apps/whatsapp-edge/dist/index.js"]
