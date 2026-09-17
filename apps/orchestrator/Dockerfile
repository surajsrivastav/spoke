FROM node:22.23.2-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app
RUN npm install -g pnpm@10.33.0
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.json ./
COPY apps/orchestrator/package.json apps/orchestrator/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild
RUN pnpm --filter @spoke/db generate
COPY apps/orchestrator/ apps/orchestrator/
RUN pnpm --filter @spoke/orchestrator build

FROM base
WORKDIR /app
COPY --from=docker:29.1.2-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=builder /app /app
CMD ["sh", "-c", "packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma && node_modules/.bin/tsx apps/orchestrator/dist/index.js"]
