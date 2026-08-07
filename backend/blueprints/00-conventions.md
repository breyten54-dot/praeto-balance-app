# 00 — Conventions (shared context for every blueprint)

Read this file before executing any numbered blueprint. Every rule here is mandatory; blueprints do not repeat them.

## Project location & layout

Backend root: `HIVE\praeto-balance-app_2 (1)\praeto-balance-app\backend\` (sibling of this `blueprints/` folder). NestJS standard layout:

```
backend/
  src/
    main.ts                    # bootstrap: global prefix, pipes, CORS
    app.module.ts
    prisma/                    # PrismaService (global module)
    common/                    # guards, decorators, filters, error codes
    modules/
      auth/  users/  budget/  gambling/  score/  learn/
      rewards/  risk-profile/  savings/  coaching/
      webhooks/  bank-link/
  prisma/
    schema.prisma
    seed.ts                    # idempotent; each module extends it
  test/                        # one <module>.e2e-spec.ts per module
  docker-compose.yml           # local Postgres 16
  .env.example                 # every var documented, no real secrets
```

## Pinned stack

Node 20 LTS · NestJS ^10 · Prisma ^5 · PostgreSQL 16 (docker image `postgres:16-alpine`) · `@nestjs/jwt` + `passport-jwt` · `argon2` for password hashing · `class-validator`/`class-transformer` for DTOs · Jest + Supertest for e2e. No other runtime dependencies without a blueprint saying so.

## API contract rules (the mobile app is already built — the backend conforms to IT, never the reverse)

1. Global prefix `/api/v1`, port `4000` (matches `src/config/env.ts` in the app: `http://localhost:4000/api/v1`).
2. **Money is integer cents everywhere** (`amountCents`, `limitCents`). Never floats, never Rand decimals.
3. **JSON keys are camelCase**, matching `src/api/types.ts` in the app exactly — that file is the authoritative response contract. When a blueprint names a response type (e.g. `BudgetSummary`), it means the exact shape from `types.ts`, field for field.
4. Dates/timestamps: ISO-8601 strings in responses.
5. **Error envelope** (the app's `normalizeError` in `src/api/client.ts` depends on this): every non-2xx response body is `{ "code": "<SCREAMING_SNAKE>", "message": "<human sentence>" }`. Implement as a global exception filter. Error codes used across blueprints: `INVALID_CREDENTIALS`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `FEATURE_DISABLED`, `LIMIT_EXCEEDED`, `WEBHOOK_INVALID`.
6. Auth: `Authorization: Bearer <accessToken>` on every route except `POST /auth/login`, `POST /auth/refresh`, `GET /health`, and the two webhook routes (which have their own verification). Enforce via a global JWT guard with a `@Public()` decorator for the exceptions.
7. Validation: DTOs with class-validator on every body/query; whitelist + forbidNonWhitelisted in a global ValidationPipe. Validation failures → 400 `VALIDATION_ERROR` with the first constraint message.

## Feature flags (server-side)

Env vars `FEATURE_SAVINGS_ENABLED` and `FEATURE_RISK_PROFILE_ENABLED` (default `false` in production, `true` in development/.env.example). When off, the module's routes return 403 `FEATURE_DISABLED`. This mirrors the app's `env.ts` gating — the reason is a pending FAIS/NCA legal opinion; see the app README.

## Database conventions

- Prisma models singular PascalCase (`User`, `Transaction`); tables plural snake_case via `@@map`.
- **E2E determinism (added at 09 checkpoint):** `npm run test:e2e` resets the database first (`prisma migrate reset --force`) and runs serially — e2e results on a dirty database are meaningless because suites mutate shared demo-user state. Never remove the reset from the script; never run e2e suites in parallel workers against one database.
- Blueprint schema snippets show only the NEW models. Every model that relates to `User` also needs its back-relation list field added to the `User` model in the same migration — run `npx prisma format` after pasting a snippet; it inserts the back-relations automatically. A schema that fails `npx prisma validate` is not done.
- Every model: `id String @id @default(cuid())`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`.
- Migrations via `npx prisma migrate dev --name <blueprint-slug>`; never edit an applied migration.
- `prisma/seed.ts` is idempotent (upserts, stable IDs like `seed-user-demo`) — running it twice must not duplicate data.

## Seed identity (used by every module's seed data and e2e tests)

Demo user: email `demo@praetobalance.co.za`, password `Demo1234!`, firstName `Thandi`, lastName `Mokoena`, lsmBand `lsm_4_6`, subscriptionTier `free`, kycStatus `verified`.

## Testing convention (part of every Definition of Done)

Each module ships `test/<module>.e2e-spec.ts` (Supertest against the running Nest app with the seeded DB): at minimum one happy path asserting the exact response contract, plus one error path (bad auth, validation failure, or flag-off 403). Run with `npm run test:e2e`. A blueprint is not done until its named tests pass AND the previous modules' tests still pass.

## Secrets

No secret ever committed. `.env` is gitignored; `.env.example` documents every variable with a placeholder. PayFast merchant key/passphrase and RevenueCat secret exist ONLY in backend env — never in the mobile app (see app README's payment-path warning).
