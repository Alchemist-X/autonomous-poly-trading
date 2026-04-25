# Vercel Web Deploy Runbook

Chinese version: [vercel-web-deploy-runbook.md](vercel-web-deploy-runbook.md).

Last updated: 2026-03-24

## 1. What this document is for

This runbook only covers the public `apps/web` deployment on Vercel. It does not cover the Hostinger backend stack.

It is meant to answer three practical questions:

- how to publish the web app to Vercel
- which environment variables enable spectator mode
- why a deployment can look different from the local preview

## 2. When to use it

- you want to deploy the spectator site or another public web page to Vercel
- you need to verify whether a `preview` or `production` deployment is really the expected version
- the Vercel page does not match the local preview

For backend deployment, see [hostinger-vps-deploy-runbook.en.md](hostinger-vps-deploy-runbook.en.md).

## 3. Critical environment variables for spectator mode

If the homepage is expected to enter the "watch a real wallet" branch, at least one of these variables must exist. In this repository, set both so server-side and client-side reads stay aligned:

```bash
POLYMARKET_PUBLIC_WALLET_ADDRESS=0x...
NEXT_PUBLIC_POLYMARKET_PUBLIC_WALLET_ADDRESS=0x...
```

Current code path:

- [apps/web/lib/public-wallet.ts](../apps/web/lib/public-wallet.ts)

The logic is simple:

- valid address present: spectator mode is enabled
- missing or invalid value: homepage falls back to the regular branch

## 4. Standard deployment flow

### Local checks

```bash
pnpm --filter @autopoly/web typecheck
pnpm --filter @autopoly/web build
```

### Deploy preview

```bash
vercel deploy --yes -A vercel.json
```

### Deploy production

```bash
vercel deploy --prod --yes -A vercel.json
```

## 5. Required post-deploy verification

Do not treat the CLI URL alone as proof that the deployment is correct.  
This web app has meaningful environment-driven branches and layout wrappers, so it requires an actual page check.

After every public deployment, do at least these 4 steps:

1. open the real deployed URL, not just the local preview
2. take a screenshot of the deployed page
3. compare that screenshot against the intended version or local preview
4. verify that the public API is returning the intended wallet data

Recommended minimum commands:

```bash
curl -I https://autopoly-pizza-spectator.vercel.app
curl https://autopoly-pizza-spectator.vercel.app/api/public/overview
```

If a browser-level check is needed, open the deployed URL with Playwright and capture a screenshot.

## 6. The two real pitfalls hit on 2026-03-24

### Pitfall 1: preview had no wallet env vars, so it fell back to the old homepage

Symptom:

- local already showed the new `balancer-flow`
- Vercel `preview` still showed the old homepage

Actual cause:

- `preview` did not have `POLYMARKET_PUBLIC_WALLET_ADDRESS`
- `preview` also did not have `NEXT_PUBLIC_POLYMARKET_PUBLIC_WALLET_ADDRESS`
- so [public-wallet.ts](../apps/web/lib/public-wallet.ts) evaluated `spectatorMode=false`
- the homepage correctly fell back to the old non-spectator branch

Checks:

```bash
vercel env list preview
vercel env list production
```

Handling rule:

- do not assume `production` env vars automatically cover `preview`
- with the current CLI behavior, `preview` vars may also be branch-scoped
- if a preview must show the real spectator page, verify that the target preview scope actually contains those two variables

### Pitfall 2: the homepage switched, but layout still wrapped it in the old Shell

Symptom:

- the deployed page was not fully old
- but it was not a clean new version either
- it looked like the old hero and the new balancer page were stacked together

Actual cause:

- [apps/web/app/page.tsx](../apps/web/app/page.tsx) already returned the new homepage in spectator mode
- but [apps/web/app/layout.tsx](../apps/web/app/layout.tsx) still wrapped the page with the old `Shell`
- so the old frame and the new homepage rendered together

Handling rule:

- if the homepage is a full custom page or full-screen variant, do not wrap it again with the legacy shell
- especially in spectator mode, inspect both the page branch and the layout wrapper together

## 7. Recommended debugging order

If the local version is right but the deployed version is wrong, check in this order:

1. confirm which URL you are looking at: `preview` or `production`
2. confirm that the target environment has the wallet vars needed for spectator mode
3. confirm that the homepage is taking the intended branch
4. confirm that layout is not wrapping the new page in a legacy shell
5. open the real deployed page in a browser and compare screenshots, instead of trusting HTML or APIs alone

## 8. Hard rules for this repository

For `apps/web` deployments on Vercel, the default rules should be:

- always open the real deployed page and verify it with a screenshot
- do not claim "the deployment matches local" before that screenshot comparison
- spectator mode must first verify the wallet env vars
- if the homepage is a full custom design, layout must not stack the legacy shell on top of it

## 9. Relevant files

- [apps/web/app/page.tsx](../apps/web/app/page.tsx)
- [apps/web/app/layout.tsx](../apps/web/app/layout.tsx)
- [apps/web/lib/public-wallet.ts](../apps/web/lib/public-wallet.ts)
- [apps/web/components/preview-balancer-variants.tsx](../apps/web/components/preview-balancer-variants.tsx)
- [vercel.json](../vercel.json)
