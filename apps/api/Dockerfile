FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install --global corepack@0.35.0 && corepack enable
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN corepack pnpm install --filter @solution/api... --filter solution-delivery --frozen-lockfile
COPY . .
RUN corepack pnpm db:generate && corepack pnpm --filter @solution/api build
RUN corepack pnpm --filter @solution/api deploy --prod --legacy /opt/api

FROM build AS migration
USER node
CMD ["node", "apps/api/node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "apps/api/prisma.config.ts"]

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /opt/api ./
USER node
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
