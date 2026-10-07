FROM node:24-bookworm-slim AS build
RUN npm install --global corepack@0.35.0 && corepack enable
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN corepack pnpm install --filter @solution/web... --filter solution-delivery --frozen-lockfile --ignore-scripts
COPY . .
RUN corepack pnpm --filter @solution/web build
FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
