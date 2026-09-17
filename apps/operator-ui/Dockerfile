FROM node:26.8-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app
RUN npm install -g pnpm@10.33.0
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.json ./
COPY apps/operator-ui/package.json apps/operator-ui/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild
RUN pnpm --filter @spoke/db generate
COPY apps/operator-ui/ apps/operator-ui/
RUN pnpm --filter @spoke/operator-ui build

FROM base
WORKDIR /app/apps/operator-ui
COPY --from=builder /app /app
EXPOSE 3000
CMD ["./node_modules/.bin/next", "start", "-p", "3000"]
