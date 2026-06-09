FROM node:20-bullseye-slim AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.json ./
COPY apps/operator-ui/package.json apps/operator-ui/
COPY packages/ packages/
RUN pnpm install --no-frozen-lockfile --ignore-scripts
RUN pnpm rebuild
RUN pnpm --filter @harness/db generate
COPY apps/operator-ui/ apps/operator-ui/
RUN pnpm --filter @harness/operator-ui build

FROM node:20-bullseye-slim
WORKDIR /app/apps/operator-ui
COPY --from=builder /app /app
EXPOSE 3000
CMD ["./node_modules/.bin/next", "start", "-p", "3000"]
