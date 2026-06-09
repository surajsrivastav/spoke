FROM node:20-bullseye-slim AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.json ./
COPY apps/slack-edge/package.json apps/slack-edge/
COPY packages/ packages/
RUN pnpm install --no-frozen-lockfile --ignore-scripts
RUN pnpm rebuild
RUN pnpm --filter @harness/db generate
COPY apps/slack-edge/ apps/slack-edge/
RUN pnpm --filter @harness/slack-edge build

FROM node:20-bullseye-slim
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 3001
CMD ["node_modules/.bin/tsx", "apps/slack-edge/dist/index.js"]
