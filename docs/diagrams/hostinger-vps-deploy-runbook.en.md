# Hostinger VPS Deployment Runbook

Chinese version: [hostinger-vps-deploy-runbook.md](hostinger-vps-deploy-runbook.md).

Last updated: 2026-03-23

## Goal

This runbook is for deploying the backend runtime stack of this repository onto a Hostinger VPS.

Current recommended deployment scope:

- `postgres`
- `redis`
- `orchestrator`
- `executor`

This runbook does not bundle `apps/web` into the same Hostinger container stack by default because:

- the repository already treats Vercel as the more natural target for the web app
- admin interfaces should not be exposed publicly by default
- stabilizing the trading backend stack first is more important than forcing a one-box public site immediately

## Hostinger deployment assets added in this repository

- [docker-compose.hostinger.yml](../../deploy/hostinger/docker-compose.yml)
- [services/orchestrator/Dockerfile.hostinger](../services/orchestrator/Dockerfile.hostinger)
- [services/executor/Dockerfile.hostinger](../services/executor/Dockerfile.hostinger)
- [deploy/hostinger/stack.env.example](../deploy/hostinger/stack.env.example)

Design goals:

- bind internal service ports to `127.0.0.1` by default
- persist `vendor/repos` and `runtime-artifacts`
- add health checks, restart policy, and startup ordering
- run `pnpm vendor:sync` automatically when `orchestrator` starts

## Hostinger-side prerequisites

Recommended baseline:

- choose a VPS with the Docker template
- use a recent Ubuntu release
- initially expose only these public ports:
  - `22`
  - `80`
  - `443`

Do not expose these internal ports by default:

- `4001`
- `4002`
- `5432`
- `6379`

## Current blockers

This session does not have remote VPS credentials or a Hostinger control-plane session, so I cannot complete the remote deployment directly from here.

Current concrete blockers:

- missing Hostinger SSH access or panel access
- missing production `stack.env`
- missing production domain / TLS / reverse-proxy decision
- if provider runtime is required, the corresponding CLI placement still needs to be decided

## Recommended deployment steps

### 1. Put the repository on the VPS

```bash
git clone <your-repo-url> /opt/autopoly
cd /opt/autopoly
```

### 2. Create the dedicated environment file

```bash
cp deploy/hostinger/stack.env.example deploy/hostinger/stack.env
chmod 600 deploy/hostinger/stack.env
```

At minimum, fill:

- `POSTGRES_PASSWORD`
- `ORCHESTRATOR_INTERNAL_TOKEN`
- `PRIVATE_KEY`
- `FUNDER_ADDRESS`
- `APP_URL`

Notes:

- `PULSE_SOURCE_REPO_DIR`, `CODEX_SKILL_ROOT_DIR`, and `OPENCLAW_SKILL_ROOT_DIR` should stay at `/app/vendor/repos/all-polymarket-skill` inside containers
- `ARTIFACT_STORAGE_ROOT` should stay at `/app/runtime-artifacts`
- live execution should remain explicit with `AUTOPOLY_EXECUTION_MODE=live`

### 3. Start the backend stack

```bash
STACK_ENV_FILE=./deploy/hostinger/stack.env \
docker compose -f deploy/hostinger/docker-compose.yml up -d --build
```

### 4. Check service health

```bash
STACK_ENV_FILE=./deploy/hostinger/stack.env \
docker compose -f deploy/hostinger/docker-compose.yml ps

curl -fsS http://127.0.0.1:4001/health
curl -fsS http://127.0.0.1:4002/health
```

### 5. Inspect logs

```bash
STACK_ENV_FILE=./deploy/hostinger/stack.env \
docker compose -f deploy/hostinger/docker-compose.yml logs -f orchestrator executor
```

## Runtime constraints

This Hostinger deployment keeps the existing safety boundaries:

- `orchestrator` and `executor` are not publicly exposed by default
- live preflight is not bypassed
- the `collateral=0 and remote positions=0` guard remains intact
- `pulse-direct` remains the default decision strategy

For real-money validation, the recommended order is still:

1. `paper`
2. `pulse:live --recommend-only`
3. `pulse:live`
4. `live:test`

## Current known limitations

- Docker is not installed on this local machine, so this Hostinger compose stack was not validated with `docker compose config` here
- this runbook currently covers the backend stack, not the public web deployment
- if the Vercel-hosted web app later needs admin access into Hostinger, a protected private access pattern must be designed; do not expose `4001` publicly

## Next commands

If you already have VPS SSH:

```bash
ssh root@<your-hostinger-vps-ip>
```

If the repo is already on the VPS:

```bash
cd /opt/autopoly
cp deploy/hostinger/stack.env.example deploy/hostinger/stack.env
vi deploy/hostinger/stack.env
STACK_ENV_FILE=./deploy/hostinger/stack.env docker compose -f deploy/hostinger/docker-compose.yml up -d --build
```

The most effective next input from the user is one of:

- VPS SSH access details
- the production domain to use
- the decision on whether `apps/web` stays on Vercel or also moves to Hostinger
