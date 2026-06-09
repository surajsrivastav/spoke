FROM node:20-bullseye-slim AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.json ./
COPY apps/orchestrator/package.json apps/orchestrator/
COPY packages/ packages/
RUN pnpm install --no-frozen-lockfile --ignore-scripts
RUN pnpm rebuild
RUN pnpm --filter @harness/db generate
COPY apps/orchestrator/ apps/orchestrator/
RUN pnpm --filter @harness/orchestrator build

FROM node:20-bullseye-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends docker.io && apt-get clean && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app /app
CMD ["sh", "-c", "packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma && node_modules/.bin/tsx apps/orchestrator/dist/index.js"]
