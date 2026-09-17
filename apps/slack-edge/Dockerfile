FROM node:22.23.2-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app
RUN npm install -g pnpm@10.33.0
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.json ./
COPY apps/slack-edge/package.json apps/slack-edge/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild
RUN pnpm --filter @spoke/db generate
COPY apps/slack-edge/ apps/slack-edge/
RUN pnpm --filter @spoke/slack-edge build

FROM base
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 3001
CMD ["node_modules/.bin/tsx", "apps/slack-edge/dist/index.js"]
