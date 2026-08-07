# 10 — RevenueCat webhook (subscription state sync)

**Builder:** sonnet-tier, payment-critical. Requires 01 complete.

## Goal
`POST /webhooks/revenuecat` that keeps `User.subscriptionTier` in sync with store subscription events, independent of what the device claims — the backend's own record of who is premium (see `../backend/README.md` §4).

## Context
Read `00-conventions.md`. RevenueCat sends webhooks as JSON `{api_version, event: {...}}` with an `Authorization` header whose value YOU configure in the RevenueCat dashboard. The app sets `appUserID` to the backend user id at configure time (`../App.tsx` calls `configureSubscriptions(profile.id)`), so `event.app_user_id` maps directly to `User.id`.

## Constraints
- Auth: the route is `@Public` but MUST compare the raw `Authorization` header against env `REVENUECAT_WEBHOOK_AUTH` with a constant-time compare (`crypto.timingSafeEqual` on padded buffers); mismatch or missing → 401 `WEBHOOK_INVALID`. No JWT logic on this route.
- Never 5xx on unknown users or unhandled event types — log, store, respond 200 (RevenueCat retries on failure; a permanently failing event blocks their queue).
- Idempotent: the same `event.id` delivered twice must not double-process (unique constraint + upsert-skip).

## Build plan
1. Migration `revenuecat`: model below.
2. Route handler:
   a. Header check (above).
   b. Store raw event in `SubscriptionEvent` (skip processing if `eventId` already exists — respond 200 `{received: true, duplicate: true}`).
   c. Map `event.type`:
      - `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `PRODUCT_CHANGE` → set user `subscriptionTier = 'premium'`
      - `EXPIRATION` → set `subscriptionTier = 'free'`
      - `CANCELLATION` → **no tier change** (user keeps access until expiry; the EXPIRATION event does the downgrade) — record only
      - `BILLING_ISSUE`, `SUBSCRIBER_ALIAS`, `TRANSFER`, anything else → record only
   d. `event.app_user_id` not found as a User id (e.g. RevenueCat anonymous `$RCAnonymousID:` ids) → record with verdict `unknown_user`, respond 200.
3. `.env.example` addition: `REVENUECAT_WEBHOOK_AUTH=replace_with_long_random_string` (same value gets pasted into the RevenueCat dashboard webhook config).
4. `test/revenuecat.e2e-spec.ts` using the fixture below.

## Exact inputs

```prisma
model SubscriptionEvent {
  id          String   @id @default(cuid())
  eventId     String   @unique
  type        String
  appUserId   String
  verdict     String   // 'processed' | 'recorded' | 'unknown_user' | 'duplicate'
  rawEvent    Json
  createdAt   DateTime @default(now())
  @@map("subscription_events")
}
```

Minimal event fixture (e2e; matches RevenueCat's shape closely enough for the fields used):
```json
{
  "api_version": "1.0",
  "event": {
    "id": "test-evt-0001",
    "type": "INITIAL_PURCHASE",
    "app_user_id": "seed-user-demo",
    "product_id": "praeto_balance_premium_monthly",
    "purchased_at_ms": 1767225600000,
    "expiration_at_ms": 1769904000000,
    "store": "PLAY_STORE",
    "environment": "SANDBOX"
  }
}
```

## Definition of Done
1. POST fixture with correct `Authorization` header → 200; demo user's `subscriptionTier` becomes `premium` (verified via `GET /me`); `SubscriptionEvent` verdict `processed`.
2. Re-POST the identical fixture → 200 with `duplicate: true`; exactly ONE `SubscriptionEvent` row for `test-evt-0001`.
3. `EXPIRATION` event (new `event.id`) → tier back to `free`. `CANCELLATION` event → tier UNCHANGED, verdict `recorded`.
4. Unknown `app_user_id` → 200, verdict `unknown_user`, no user modified. Missing/wrong Authorization → **401 `WEBHOOK_INVALID`**, nothing stored.
5. Full `npm run test:e2e` green.

## ASSUMPTIONS
1. Entitlement granularity is binary (free/premium) matching `User.subscriptionTier` — per-product tiers (R49 vs R149) collapse to `premium` in the pilot; the raw event keeps the product id for later.
2. `TRANSFER` events (subscription moved between users) are recorded but not auto-processed in the pilot — rare, and safer handled manually until observed in practice.
