FROM node:22-alpine AS base
WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
COPY scripts ./scripts
COPY vendor ./vendor

RUN corepack enable && pnpm install --frozen-lockfile=false
RUN pnpm --filter @autopoly/orchestrator build

CMD ["pnpm", "--filter", "@autopoly/orchestrator", "start"]

