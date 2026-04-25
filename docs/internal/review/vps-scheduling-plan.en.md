# VPS Scheduled Trading System -- Option Comparison

Chinese version: [vps-scheduling-plan.md](vps-scheduling-plan.md).

Last updated: 2026-03-29

## Human Review Entry Points

1. **`services/orchestrator/src/index.ts` line 43** -- Built-in cron scheduler (`node-cron`) already exists, using `agentPollCron` to trigger `runAgentCycle` every 3 hours. This is the stateful path (requires DB + Redis).
2. **`docker-compose.hostinger.yml`** -- Complete Hostinger deployment with orchestrator/executor/postgres/redis containers, health checks, and auto-restart.
3. **`scripts/pulse-live.ts`** -- Pulse Live path entry script, runs once then `process.exit`. This is the target command to schedule.
4. **`deploy/hostinger/stack.env.example`** -- Environment variable template with all required config.

Key fact: **The stateful path already has a built-in scheduler**; the pulse-live path is currently designed as "run once and exit."

---

## Problem Statement

`pnpm pulse:live` is a one-shot script: start -> preflight -> pulse -> decisions -> orders -> archive -> exit. The goal is to run it automatically every 3 hours on a remote Ubuntu VPS.

## Impact

- Trading frequency and timeliness: scheduled execution = full market scan every 3 hours
- Fund security: private key stored on VPS; scheduler failures could cause duplicate orders or missed opportunities
- Ops cost: need to monitor the scheduler itself

---

## Option Comparison Table

| Dimension | A: cron + shell | B: systemd timer | C: PM2 cron | D: Docker + scheduler | E: Orchestrator stateful | F: Claude Code Agentic |
|-----------|----------------|------------------|-------------|----------------------|-------------------------|----------------------|
| **Complexity** | Lowest | Low | Medium | Medium-high | Medium-high | High |
| **Setup time** | 10 min | 20 min | 15 min | 1-2 hours | 1-2 hours | Half day+ |
| **Dependencies** | cron (built-in) | systemd (built-in) | PM2 (npm) | Docker + compose | Docker + Redis + Postgres | Claude Code CLI |
| **Logging** | Manual redirect | journald auto | PM2 built-in + rotation | Docker logs | Docker logs + DB records | CLI stdout |
| **Error recovery** | None (next run) | None (next run) | Configurable restart | Container restart | Container restart + DB state | AI-driven retry |
| **Concurrency guard** | Needs flock | Built-in (oneshot) | PM2 single instance | Single container | Internal guarantee | None |
| **Monitoring** | None (DIY) | systemctl status | pm2 monit | docker stats | /health endpoint | No standard approach |
| **Fits pulse-live** | Perfect | Perfect | Suitable | Needs wrapper | Not suitable (designed for stateful) | Over-engineered |
| **Key management** | .env file | .env file | .env file | Docker secret/env | Docker secret/env | .env file |
| **Reliability** | High (cron is rock-solid) | Very high | High | High | High | Uncertain |

---

## Option A: cron + Shell Script

Set up a crontab entry that calls a wrapper shell script running `pnpm pulse:live`.

**Pros**: Simplest possible. Zero extra dependencies. Easy to debug (plain text logs).

**Cons**: Manual log management. No built-in monitoring. PATH/env issues with cron require explicit handling.

---

## Option B: systemd Timer

Create a systemd service unit (what to run) and timer unit (when to run). Service type is `oneshot`.

**Pros**: Logging via journald (auto-collected, auto-rotated, queryable by time). Natural concurrency protection (oneshot won't overlap). Security sandbox (`NoNewPrivileges`, `ProtectSystem`). `Persistent=true` catches up after VPS reboot. `TimeoutStartSec` kills stuck processes.

**Cons**: Slightly more files than cron (two unit files). Needs root to install units. systemd PATH/env debugging can be tricky occasionally.

---

## Option C: PM2 with cron Expression

Use PM2 process manager with `cron_restart` in an ecosystem config file.

**Pros**: Built-in log rotation. `pm2 monit` dashboard. Native to Node.js ecosystem.

**Cons**: PM2's `cron_restart` is "restart on cron schedule," not "start one-shot on cron schedule." If the process already exited, `cron_restart` won't re-launch it -- known PM2 limitation. Imperfect concurrency protection. Extra dependency (PM2).

---

## Option D: Docker Container with Built-in Scheduler

Build a dedicated Docker image with an internal node-cron scheduler that calls `runPulseLive()`.

**Pros**: Unified with existing `docker-compose.hostinger.yml`. Container restart policy.

**Cons**: Requires new code (scheduler wrapper). Large image (entire monorepo). Pulse-live path doesn't need DB/Redis, so Docker stack is overkill. Long build times.

---

## Option E: Orchestrator's Built-in Scheduler

The orchestrator already has `cron.schedule(config.agentPollCron, ...)` running `runAgentCycle` every 3 hours. But this is the stateful path requiring PostgreSQL + Redis + executor service.

**Conclusion**: Not recommended for pulse-live. If/when you want to switch to the stateful path (`live:test`), just deploy `docker-compose.hostinger.yml` -- scheduling is already built in.

---

## Option F: Claude Code / Codex Agentic Mode

Run Claude Code CLI on the VPS as a persistent agent that wakes up on schedule.

CLAUDE.md section 18 envisions this, but currently: Claude Code CLI requires authentication (API key or OAuth). "API Key-free" mode doesn't exist yet. Scheduling is a deterministic task -- AI adds no value at this layer. The `rough-loop` service already implements a similar idea for development tasks.

**Conclusion**: Not recommended now. Correct long-term direction, but AI value belongs in the decision layer (pulse-direct already does this), not the scheduling layer.

---

## Recommendation

### Primary: Option B (systemd timer)

Reasons:
1. **Native to Ubuntu**: systemd comes with the OS, zero extra installation
2. **Built-in concurrency protection**: oneshot service type prevents overlapping runs
3. **Zero-config logging**: journald auto-collects and rotates
4. **Timeout protection**: `TimeoutStartSec` kills stuck pulse generation
5. **Catch-up after reboot**: `Persistent=true` ensures no missed runs
6. **Security sandbox**: `NoNewPrivileges`, `ProtectSystem` restrict process permissions
7. **Non-conflicting with Docker path**: when migrating to Option E later, just `systemctl disable` and start Docker stack

### Fallback: Option A (cron)

If systemd feels like too much, cron works fine. Main gaps are no built-in concurrency protection and no reboot catch-up.

---

## Step-by-Step Setup Guide (systemd timer)

### Prerequisites

| Requirement | Notes |
|-------------|-------|
| OS | Ubuntu 22.04+ |
| Node.js | >= 20.0.0 (install via nvm or fnm) |
| pnpm | 10.28.1 (via corepack) |
| Git | For cloning and vendor:sync |
| Python3 | Build dependency for some native modules |
| Disk | >= 5 GB (repo + node_modules + artifacts) |
| RAM | >= 2 GB (pulse generation peaks high) |

### Step 1: Prepare VPS Environment

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git python3 build-essential
corepack enable
```

### Step 2: Deploy Repository

```bash
git clone <your-repo-url> /opt/autopoly
cd /opt/autopoly
pnpm install
pnpm --filter @autopoly/contracts build
pnpm --filter @autopoly/terminal-ui build
pnpm vendor:sync
```

### Step 3: Configure Environment

```bash
cp deploy/hostinger/stack.env.example /opt/autopoly/.env.pizza
chmod 600 /opt/autopoly/.env.pizza
# Edit with required values: PRIVATE_KEY, FUNDER_ADDRESS, etc.
```

### Step 4: Manual Validation

```bash
cd /opt/autopoly
pnpm pulse:live --recommend-only
```

Confirm it completes successfully before enabling the timer.

### Step 5: Create systemd Service

```bash
cat > /etc/systemd/system/autopoly-pulse-live.service << 'UNIT'
[Unit]
Description=AutoPoly Pulse Live Live Trading Run
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/autopoly
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStart=/usr/local/bin/pnpm pulse:live
EnvironmentFile=/opt/autopoly/.env.pizza
TimeoutStartSec=1800
NoNewPrivileges=true
ProtectHome=read-only
ReadWritePaths=/opt/autopoly/runtime-artifacts
ExecStopPost=/bin/bash -c 'if [ "$EXIT_STATUS" != "0" ]; then echo "$(date -Iseconds) exit=$EXIT_STATUS" >> /opt/autopoly/runtime-artifacts/cron-failures.log; fi'
UNIT
```

### Step 6: Create systemd Timer

```bash
cat > /etc/systemd/system/autopoly-pulse-live.timer << 'UNIT'
[Unit]
Description=Run AutoPoly pulse-live trading every 3 hours

[Timer]
OnCalendar=*-*-* 00/3:00:00
RandomizedDelaySec=300
Persistent=true

[Install]
WantedBy=timers.target
UNIT
```

### Step 7: Enable and Verify

```bash
systemctl daemon-reload
systemctl enable --now autopoly-pulse-live.timer
systemctl list-timers autopoly-pulse-live.timer
systemctl start autopoly-pulse-live.service   # manual test
journalctl -u autopoly-pulse-live.service -f  # watch logs
```

### Step 8: Monitoring (Optional but Recommended)

Use [Healthchecks.io](https://healthchecks.io) (free tier) -- add to service:
```ini
ExecStartPost=/usr/bin/curl -fsS -m 10 --retry 5 https://hc-ping.com/your-uuid-here
```
Alerts via email/Slack if no ping received within 4 hours.

---

## Security Considerations

- **`.env.pizza` permissions**: Must be `chmod 600`, readable only by the run user
- **Dedicated user**: Use the `AutoPulse` user from `bootstrap-autopulse.sh`, not root
- **VPS hardening**: Disable password login, use SSH keys only, enable `fail2ban`, only expose port 22
- **Duplicate order prevention**: systemd oneshot guarantees single instance; pulse-live script is idempotent
- **Risk controls**: Use conservative parameters on VPS (e.g., `MAX_TOTAL_EXPOSURE_PCT=0.5`, `MAX_POSITIONS=10`)

---

## Evolution Path

```
Phase 1 (now):     systemd timer + pulse:live
                    Fastest to deploy. No DB/Redis dependency.

Phase 2 (stable):  docker-compose.hostinger.yml
                    Switch to stateful path (live:test).
                    Built-in agentPollCron. Trade history in PostgreSQL.

Phase 3 (long-term): Agentic mode
                    AI adjusts execution strategy and risk parameters.
                    Anomaly detection and self-healing.
```

---

## Decisions Needed from User

1. **Does the VPS already have Node.js 22 and pnpm?** Fresh VPS needs environment setup first.
2. **Root or dedicated user?** Recommend `AutoPulse` user, but it needs read/write access to the repo directory.
3. **Alerting needed?** If yes, provide a webhook URL (Slack/Discord/Telegram).
4. **Risk parameters for VPS**: Recommend starting with conservative values + `--recommend-only` for 1-2 days before enabling live orders.
5. **Execution frequency**: Default is every 3 hours (`OnCalendar=*-*-* 00/3:00:00`). Adjust?
