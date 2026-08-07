# Praeto Balance — Backend Architecture & Scaling Notes

This mobile app is a client only. It expects a backend API at the URL
configured in `src/config/env.ts`. This document specifies what that
backend needs to do and how to scale it — it is not itself the backend
implementation.

## Why a backend is non-negotiable here

Several things in this app must happen server-side, not on-device:

1. **Praeto Balance Score calculation** — the scoring methodology may
   need to change without an app store release, and a client-computed
   score could be tampered with on a jailbroken/rooted device.
2. **Risk Profile scoring** — same reasoning, plus this is the piece
   most likely to need adjustment once Arusha Naidoo's FAIS opinion
   comes back (see Praeto_Balance_PreLaunch_Legal_Brief).
3. **PayFast signature generation and ITN verification** — the merchant
   passphrase must never ship inside the mobile bundle.
4. **RevenueCat webhook handling** — to sync subscription state into
   your own user database independent of what the device reports.
5. **Bank transaction ingestion and categorisation** — via an
   aggregator, not done in the app.

## Recommended stack

| Layer | Recommendation | Why |
|---|---|---|
| API framework | NestJS (Node/TypeScript) | Shares TypeScript conventions with the RN app; modular structure suits a growing team |
| Database | PostgreSQL, managed (RDS or equivalent) | Financial data wants ACID guarantees |
| Cache / queues | Redis + BullMQ | Session/rate-limit state, and async jobs for score recomputation |
| Bank data aggregation | Stitch or Mono (South African aggregators) | Neither Plaid nor Yodlee has full SA bank coverage |
| Hosting | AWS af-south-1 (Cape Town) or Azure South Africa North | Data residency simplifies POPIA compliance |
| Payments | PayFast (coaching) + RevenueCat webhooks (subscriptions) | See src/services/payments.ts and subscriptions.ts |

## Scaling path

**0 to 5,000 users (pilot phase):** a single small Postgres instance and
one API container (Fargate or Render) is genuinely enough. Do not
over-build here — the pilot's job is to validate CAC/ARPU/retention.

**5,000 to 50,000 users:** move to autoscaled Fargate/ECS behind a load
balancer, add Postgres read replicas, and move score computation into a
background job triggered on new transaction data.

**50,000+ users:** split the monolith at natural seams (a Payments
service isolated for PCI reasons, a Scoring service, and a core API),
add a CDN for static content, and only consider database sharding once
a well-tuned single instance with read replicas is a demonstrated
bottleneck.

## Required API surface (matches src/api/endpoints.ts)

POST /auth/login, POST /auth/refresh, GET /me, PATCH /me/lsm-band,
GET /score, GET /score/history, GET /budget/summary,
PUT /budget/categories/:category/limit, GET /gambling/summary,
PUT /gambling/limit, POST /gambling/cooling-off,
PUT /gambling/daily-alert, GET /learn/modules,
POST /learn/modules/:id/complete, POST /risk-profile/submit,
GET /risk-profile/latest, GET /savings/account, POST /savings/goals,
POST /savings/withdrawals, GET /rewards/summary,
POST /rewards/redeem/:offerId, POST /rewards/partners/:partner/link,
GET /coaching/availability, POST /coaching/bookings,
POST /webhooks/payfast/itn, POST /webhooks/revenuecat,
POST /bank-link/token, POST /bank-link/exchange,
GET /bank-link/accounts, DELETE /bank-link/accounts/:id

## Security checklist before production

- All secrets in AWS Secrets Manager / Azure Key Vault, never committed.
- Rate limiting on /auth/login and /risk-profile/submit.
- PayFast ITN handler verifies signature AND source IP before trusting
  a "payment complete" notification.
- All PII and financial data encrypted at rest and in transit (TLS 1.2+).
- POPIA data-subject request tooling (export/delete) exists before
  public launch, not retrofitted after.
