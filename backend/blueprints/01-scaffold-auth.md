# 01 — Scaffold + Auth + Users

**Builder:** sonnet-tier (Kimi, full attention — this is the foundation every other blueprint builds on; auth bugs poison everything downstream)

## Goal

A running NestJS 10 + Prisma 5 + Postgres 16 backend that boots with `npm run start:dev`, exposes `/api/v1` on port 4000, and implements login, token refresh, and the user profile endpoints — such that the EXISTING mobile app's login screen and session rehydration work against it unchanged.

## Context

- Read `00-conventions.md` first; everything there applies.
- The mobile app is the fixed contract. Relevant app files (read them): `../src/api/client.ts` (token refresh flow the backend must satisfy), `../src/api/types.ts` (`UserProfile`, `LsmBand`), `../src/screens/LoginScreen.tsx` (posts `{email, password}` to `/auth/login`, expects `{accessToken, refreshToken, user}`), `../App.tsx` (cold start calls `GET /me` with stored token).
- App's refresh call (`client.ts` line ~113): `POST /auth/refresh` with body `{refreshToken}`, expects `{accessToken, refreshToken}` back. Refresh MUST return a NEW refresh token (rotation).
- `UserProfile` contract: `{id, firstName, lastName, email, lsmBand, memberSince, subscriptionTier, kycStatus}` — `memberSince` = user's `createdAt` as ISO string; `lsmBand` one of `lsm_1_3|lsm_4_6|lsm_7_8|lsm_9_10`; `subscriptionTier` `free|premium`; `kycStatus` `unverified|pending|verified`.

## Constraints

- Do not add any module beyond auth/users/health in this item (no empty placeholder modules).
- Do not use Passport local strategy for login — a plain service method is fine; DO use passport-jwt for the access-token guard.
- Access token TTL 15 minutes; refresh token TTL 30 days. Refresh tokens stored in DB **hashed** (sha256 hex), rotated on every use (old row deleted, new row inserted), all of a user's refresh tokens deleted on password change (future-proofing; no password-change endpoint yet).
- Passwords hashed with argon2id, defaults.

## Build plan

1. `nest new backend` equivalent scaffold IN PLACE in `backend/` (do not nest another folder): `package.json` scripts `start:dev`, `build`, `test:e2e`, `prisma:seed`. TypeScript strict.
2. Add `docker-compose.yml` and `.env.example` exactly as given below; copy `.env.example` → `.env` for local dev.
3. `npx prisma init`; replace `schema.prisma` with the schema below; `npx prisma migrate dev --name scaffold-auth`.
4. Implement `PrismaService` as a global module.
5. Implement global pieces per conventions: `main.ts` (prefix `api/v1`, port 4000, ValidationPipe whitelist+forbidNonWhitelisted, CORS enabled for all origins in dev), global exception filter emitting the `{code,message}` envelope, global `JwtAuthGuard` + `@Public()` decorator, `@CurrentUser()` param decorator.
6. `GET /health` (`@Public()`) → `{status:'ok', uptimeSeconds:number}`.
7. Auth module: `POST /auth/login` (`@Public()`): verify email+password (argon2), on success issue access JWT (`sub`=userId, `email`, 15m, secret `JWT_ACCESS_SECRET`) + opaque refresh token (crypto-random 64 hex chars; store sha256 in `refresh_tokens` with `expiresAt`), respond `{accessToken, refreshToken, user:<UserProfile>}`. Wrong email OR password → 401 `INVALID_CREDENTIALS` (same message both cases — no user enumeration).
8. `POST /auth/refresh` (`@Public()`): body `{refreshToken}`; hash it, look up non-expired row; miss → 401 `UNAUTHORIZED`; hit → delete row, issue new pair, respond `{accessToken, refreshToken}`.
9. Users module: `GET /me` → `UserProfile` of the authenticated user. `PATCH /me/lsm-band` body `{lsmBand}` (validated against the four LsmBand values) → updated `UserProfile`.
10. `prisma/seed.ts`: upsert the demo user from conventions (id `seed-user-demo`, argon2 hash of `Demo1234!`). Wire `"prisma": {"seed": "ts-node prisma/seed.ts"}`.
11. Write `test/auth.e2e-spec.ts` covering the Definition of Done cases below.

## Exact inputs

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: praeto
      POSTGRES_PASSWORD: praeto_local_dev
      POSTGRES_DB: praeto_balance
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
volumes:
  pgdata:
```

`.env.example`:
```bash
DATABASE_URL=postgresql://praeto:praeto_local_dev@localhost:5432/praeto_balance
JWT_ACCESS_SECRET=replace_with_64_random_hex_chars
PORT=4000
APP_ENV=development
FEATURE_SAVINGS_ENABLED=true
FEATURE_RISK_PROFILE_ENABLED=true
# PayFast + RevenueCat vars arrive in blueprints 09/10 — do not add yet
```

`prisma/schema.prisma` models (plus generator/datasource boilerplate):
```prisma
enum LsmBand { lsm_1_3  lsm_4_6  lsm_7_8  lsm_9_10 }
enum SubscriptionTier { free  premium }
enum KycStatus { unverified  pending  verified }

model User {
  id               String   @id @default(cuid())
  email            String   @unique
  passwordHash     String
  firstName        String
  lastName         String
  lsmBand          LsmBand  @default(lsm_4_6)
  subscriptionTier SubscriptionTier @default(free)
  kycStatus        KycStatus @default(unverified)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  refreshTokens    RefreshToken[]
  @@map("users")
}

model RefreshToken {
  id        String   @id @default(cuid())
  tokenHash String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
  @@index([userId])
  @@map("refresh_tokens")
}
```

Login success response shape (verbatim contract, e2e asserts these exact keys):
```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<64 hex chars>",
  "user": {
    "id": "seed-user-demo",
    "firstName": "Thandi",
    "lastName": "Mokoena",
    "email": "demo@praetobalance.co.za",
    "lsmBand": "lsm_4_6",
    "memberSince": "<ISO date>",
    "subscriptionTier": "free",
    "kycStatus": "verified"
  }
}
```

## Definition of Done

Run each; all must pass:

1. `docker compose up -d db && npx prisma migrate dev && npm run prisma:seed` — exits 0; re-running the seed also exits 0 with no duplicate user (idempotency check).
2. `npm run start:dev` boots with no errors; `curl http://localhost:4000/api/v1/health` → 200 `{"status":"ok",...}`.
3. `curl -X POST http://localhost:4000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"demo@praetobalance.co.za","password":"Demo1234!"}'` → 200 matching the verbatim shape above.
4. Same call with password `wrong` → **401** body exactly `{"code":"INVALID_CREDENTIALS","message":...}`.
5. `POST /auth/refresh` with the refresh token from step 3 → 200 new pair; repeating with the SAME (now-consumed) token → 401 (rotation proof).
6. `GET /api/v1/me` with `Authorization: Bearer <accessToken>` → 200 UserProfile; with no header → 401 envelope.
7. `PATCH /api/v1/me/lsm-band` body `{"lsmBand":"lsm_7_8"}` → 200 with updated band; body `{"lsmBand":"lsm_99"}` → 400 `VALIDATION_ERROR`.
8. `npm run test:e2e` — auth spec green, covering at minimum cases 3–7.

## ASSUMPTIONS

1. No registration endpoint — the app has no signup screen; users are provisioned by seed/admin for the pilot. (Veto = add `POST /auth/register` in a revision.)
2. No logout endpoint — the app clears tokens locally; server-side refresh rows simply expire. (Matches `endpoints.ts`, which has no logout call.)
3. Single JWT secret via env (no RS256 keypair) is acceptable at pilot scale.
4. CORS wide-open in dev; restricted to the staging/production app origins in blueprint 12.
