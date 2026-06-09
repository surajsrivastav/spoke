FROM node:20-bullseye-slim AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.json ./
COPY apps/whatsapp-edge/package.json apps/whatsapp-edge/
COPY packages/ packages/
RUN pnpm install --no-frozen-lockfile --ignore-scripts
RUN pnpm rebuild
RUN pnpm --filter @harness/db generate
COPY apps/whatsapp-edge/ apps/whatsapp-edge/
RUN pnpm --filter @harness/whatsapp-edge build

FROM node:20-bullseye-slim
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 3001
CMD ["node_modules/.bin/tsx", "apps/whatsapp-edge/dist/index.js"]
