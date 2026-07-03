# Raven Forecasting Engine — app + engine in one long-lived container.
# Build context must be the repo root:
#   docker compose -f deploy/raven/docker-compose.yml up -d --build

FROM node:20-slim

# claude CLI = the engine's web-research provider (auth via CLAUDE_CODE_OAUTH_TOKEN
# or ANTHROPIC_API_KEY at runtime — nothing is baked into the image).
RUN npm install -g @anthropic-ai/claude-code && corepack enable

# Chromium + system deps for the forecast-api PDF renderer. Installed before
# COPY so the ~150MB browser layer stays cached across code changes; the
# version must match the workspace's pinned playwright.
RUN npx -y playwright@1.56.1 install --with-deps chromium

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile \
  && pnpm --filter @autopoly/raven build \
  && pnpm store prune

ENV NODE_ENV=production
EXPOSE 3200 8787

# next start -p 3200 (binds 0.0.0.0 inside the container); the engine runs as
# child processes of this server and persists to /app/runtime-artifacts.
CMD ["pnpm", "--filter", "@autopoly/raven", "start"]
