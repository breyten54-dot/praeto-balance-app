# 12 — Deploy: Dockerfile + Fly.io Johannesburg + staging wiring

**Builder:** sonnet-tier. Requires 01–11 complete and verified. Needs the user present for `fly auth` and billing confirmation — flag before starting.

## Goal
The backend running at a public URL in Fly.io's `jnb` (Johannesburg) region — SA data residency per the POPIA note in `../backend/README.md` — with managed Postgres, secrets set, migrations run on release, and the mobile app's staging environment pointed at it.

## Context
Read `00-conventions.md`. Fly.io serves the pilot-phase scale ("0 to 5,000 users: a single small Postgres instance and one API container is genuinely enough" — backend README). App-side wiring: `../src/config/env.ts` staging block currently points at `https://api-staging.praetobalance.co.za/api/v1` — that domain doesn't exist yet; the pilot uses the fly.dev URL.

## Constraints
- Production feature flags OFF: `FEATURE_SAVINGS_ENABLED=false`, `FEATURE_RISK_PROFILE_ENABLED=false` (the legal gate follows the code to the cloud).
- All secrets via `fly secrets set` — nothing secret in `fly.toml` or the Docker image.
- App name `praeto-balance-api`; region `jnb` only.

## Build plan
1. `Dockerfile` (multi-stage, exact content below) + `.dockerignore` (`node_modules`, `dist`, `.env*`, `test`, `blueprints`).
2. `fly.toml` (below).
3. One-time commands (user present):
   ```bash
   fly auth login
   fly launch --name praeto-balance-api --region jnb --no-deploy   # accept existing Dockerfile/fly.toml, no Postgres prompt
   fly postgres create --name praeto-balance-db --region jnb --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 3
   fly postgres attach praeto-balance-db --app praeto-balance-api   # sets DATABASE_URL secret
   fly secrets set \
     JWT_ACCESS_SECRET=<64 random hex — generate with: openssl rand -hex 32> \
     PAYFAST_MODE=sandbox PAYFAST_MERCHANT_ID=10000100 PAYFAST_MERCHANT_KEY=46f0cd694581a PAYFAST_PASSPHRASE= \
     REVENUECAT_WEBHOOK_AUTH=<long random string> \
     API_PUBLIC_URL=https://praeto-balance-api.fly.dev \
     APP_ENV=staging TZ=Africa/Johannesburg \
     FEATURE_SAVINGS_ENABLED=false FEATURE_RISK_PROFILE_ENABLED=false
   fly deploy
   ```
4. Seed the staging DB once FROM THE LOCAL MACHINE through a proxy (the production image has no dev dependencies, so ts-node isn't available in `fly ssh console`):
   ```bash
   fly proxy 15432:5432 --app praeto-balance-db   # keep running in a second terminal
   DATABASE_URL="postgresql://<user>:<pw>@localhost:15432/praeto_balance_api" npx prisma db seed
   ```
   (Credentials come from the `fly postgres attach` output / `fly secrets get DATABASE_URL` on the API app — swap host/port for the proxy.)
5. App wiring: edit `../src/config/env.ts` staging block → `apiBaseUrl: 'https://praeto-balance-api.fly.dev/api/v1'` (leave the praetobalance.co.za production URLs as-is; they activate when the domain is bought and `fly certs add` is run — leave a `TODO(domain)` comment).
6. Update `backend/README.md` with a short "Deployed pilot" section: URL, region, how to deploy (`fly deploy`), how to read logs (`fly logs`).

## Exact inputs

`Dockerfile` (CORRECTED after first real deploy, 2026-07-09 — two defects found: (1) `nest build` outputs `dist/src/main.js` because `prisma/seed.ts` is in the TS project, (2) Prisma's linux-musl engine fails on `node:20-alpine` with `libssl.so.1.1 not found` — use Debian slim + openssl instead):
```dockerfile
FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/src/main.js"]
```

`fly.toml`:
```toml
app = "praeto-balance-api"
primary_region = "jnb"

[build]

[deploy]
  release_command = "npx prisma migrate deploy"

[http_service]
  internal_port = 4000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[http_service.checks]]
  interval = "30s"
  timeout = "5s"
  grace_period = "10s"
  method = "GET"
  path = "/api/v1/health"

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

## Definition of Done
1. `fly deploy` completes green; `fly status` shows the machine healthy in `jnb`.
2. `curl https://praeto-balance-api.fly.dev/api/v1/health` → 200 `{"status":"ok",...}`.
3. Full login flow against the deployed URL: `POST /auth/login` with demo credentials → tokens; `GET /me` with the token → profile. (Run the exact curl commands from blueprint 01's DoD against the fly.dev URL.)
4. `GET /savings/account` and `POST /risk-profile/submit` against the deployed URL → **403 `FEATURE_DISABLED`** (legal-gate flags verified in the cloud, not just locally).
5. `fly secrets list` shows all required keys (names only). `fly.toml` and the image contain no secret values (grep the repo).
6. Release logs show `prisma migrate deploy` ran. Expo app started with `APP_ENV=staging` logs requests hitting the fly.dev URL (spot-check one screen).

## ASSUMPTIONS
1. Fly.io account + card are set up by the user at build time (~$5–10/mo pilot footprint: one shared-cpu machine + 3GB Postgres volume). `auto_stop_machines` keeps idle cost near zero; first request after idle has a cold-start delay (~1s) — acceptable for a pilot.
2. The fly.dev URL is the pilot staging URL; `api-staging.praetobalance.co.za`/`api.praetobalance.co.za` DNS + certs happen when the domain is provisioned (out of scope here).
3. Sandbox PayFast credentials go to staging; live credentials are a deliberate later switch (`PAYFAST_MODE=live`) that also requires implementing the ITN source-IP check flagged `TODO(live)` in blueprint 09.
