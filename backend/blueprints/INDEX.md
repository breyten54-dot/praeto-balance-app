# Praeto Balance Backend — Blueprint Vault Index

**Created:** 2026-07-08 by Claude Code (Fable 5) · **Builder:** Kimi (via Hand-Over central), Claude verifies each Definition of Done
**Decisions locked with user 2026-07-08:** Pilot-core scope · NestJS 10 + Prisma 5 + PostgreSQL 16 · Docker Compose local + Fly.io JNB deploy · money = integer cents · API prefix `/api/v1`, port 4000

**Scope ruling (applies to every blueprint):** REAL: auth, profile, budget, gambling, score, learn, rewards, coaching + PayFast **sandbox**, RevenueCat webhook. MOCKED: bank transactions (seeded, no Stitch/Mono). FLAG-GATED (built, correct shapes, off in prod): savings, risk-profile. Nothing else is in scope.

**Builder rules:** read `00-conventions.md` before any item. Items build in numeric order — each assumes the previous ones exist. If a blueprint leaves you guessing anywhere, STOP and return the question; do not improvise (that's a blueprint defect, not your call).

| # | Blueprint | Builder | Status |
|---|-----------|---------|--------|
| 00 | [Conventions (shared context — not executable)](00-conventions.md) | — | done |
| 01 | [Scaffold + Auth + Users](01-scaffold-auth.md) | sonnet-tier (Kimi full attention) | done — **Claude checkpoint PASSED 2026-07-08** |
| 02 | [Budget module + seeded transactions](02-budget.md) | haiku-tier mechanical | done 2026-07-08 |
| 03 | [Gambling monitor module](03-gambling.md) | haiku-tier mechanical | done 2026-07-08 |
| 04 | [Learn module + points ledger](04-learn.md) — swapped before Score: the Score formula reads Learn completions | haiku-tier mechanical | done 2026-07-08 |
| 05 | [Balance Score module (formula v1 + history)](05-score.md) | sonnet-tier | done 2026-07-08 |
| 06 | [Rewards module (points, offers, redeem, partner mock)](06-rewards.md) | haiku-tier mechanical | done 2026-07-08 |
| 07 | [Risk Profile module (server-side scoring, flag-gated)](07-risk-profile.md) | sonnet-tier | done 2026-07-08 |
| 08 | [Savings module (mock partner_bank, flag-gated)](08-savings.md) | haiku-tier mechanical | done 2026-07-08 |
| 09 | [Coaching + PayFast sandbox (incl. `GET /coaching/bookings/:id` — REVIEW-Claude Finding 2)](09-coaching-payfast.md) | sonnet-tier — payment-critical | done — **Claude checkpoint PASSED 2026-07-08** |
| 10 | [RevenueCat webhook (subscription state sync)](10-revenuecat-webhook.md) | sonnet-tier — payment-critical | done — Kimi DoD + **Claude verified 2026-07-09** |
| 11 | [Bank-link stub endpoints](11-bank-link-stub.md) | haiku-tier mechanical | done — Kimi DoD + **Claude verified 2026-07-09** |
| 12 | [Deploy: Dockerfile + Fly.io JNB + staging wiring](12-deploy-fly-jnb.md) | sonnet-tier | ready to build — **needs user present** (fly auth/billing) |

**Companion app-side fix:** ✅ APPLIED by Claude 2026-07-08 — RevenueCat `Purchases.logIn` user-switch fix in `src/services/subscriptions.ts`; `CoachingApi.getBooking` added + checkout-return polling in `src/services/payments.ts`. (Compiler-unverified until the app's `npm install` — code matches existing types.)

**Open questions:** none currently. **Assumptions pending user veto:** listed per blueprint in its ASSUMPTIONS section.

**Verification protocol:** after Kimi completes an item, Claude runs that blueprint's Definition of Done verbatim before the status flips to done. First executed blueprint (01) gets a full end-to-end spot-check before the rest are batch-dispatched.
