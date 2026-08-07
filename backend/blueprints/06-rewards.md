# 06 — Rewards module

**Builder:** haiku-tier mechanical — requires 01 + 04 complete (consumes `PointsLedger`).

## Goal
`GET /rewards/summary`, `POST /rewards/redeem/:offerId`, `POST /rewards/partners/:partner/link` working with seeded offers, returning the app's `RewardsSummary` shape exactly.

## Context
Read `00-conventions.md`. App contract: `RewardsSummary` in `../src/api/types.ts`. Partners are exactly `momentum_multiply` and `discovery_vitality` (see `RewardsApi.linkPartner` in `../src/api/endpoints.ts`). Partner links are MOCKED — no real Momentum/Discovery API exists in the pilot.

## Constraints
- Points math comes ONLY from `PointsLedger` (04): `pointsBalance` = sum of all deltas; `lifetimePoints` = sum of positive deltas. No separate balance column to drift out of sync.
- Redemption must be atomic (Prisma `$transaction`): balance check + negative ledger row + redemption row together.

## Build plan
1. Migration `rewards`: models below.
2. `GET /rewards/summary` → `{pointsBalance, lifetimePoints, linkedPartners:[{partner, linkedAt}], availableOffers:[{id,title,partner,pointsCost,category}]}` — offers where `active = true`, ordered by `pointsCost` asc.
3. `POST /rewards/redeem/:offerId`: unknown/inactive offer → 404 `NOT_FOUND`; `pointsBalance < pointsCost` → 400 `{code:'INSUFFICIENT_POINTS', message:'You need <n> more points for this reward.'}` (add code to the global list); success → ledger row `{delta: -pointsCost, reason:'redeem', refId: offerId}` + `Redemption` row, respond `{redemptionId, offerId, pointsSpent, newBalance}`.
4. `POST /rewards/partners/:partner/link`: param validated against the two partner slugs (else 400 `VALIDATION_ERROR`); idempotent upsert; FIRST-time link also awards a ledger bonus `{delta: 100, reason:'partner_link_bonus', refId: partner}`; respond `{partner, linkedAt}`.
5. Seed offers (stable ids `seed-offer-1`…): 
```
seed-offer-1  R50 Airtime Voucher        momentum_multiply   500  cash
seed-offer-2  R100 Checkers Voucher      momentum_multiply  1000  cash
seed-offer-3  Clicks Wellness Voucher    discovery_vitality  750  wellness
seed-offer-4  Gym Day Pass               discovery_vitality  600  wellness
seed-offer-5  Funeral Cover Premium Discount  momentum_multiply 1200 insurance
seed-offer-6  Pharmacy Basket Discount   discovery_vitality  900  medical
```
6. `test/rewards.e2e-spec.ts`.

## Exact inputs

```prisma
model RewardOffer {
  id         String  @id
  title      String
  partner    String
  pointsCost Int
  category   String  // 'cash' | 'wellness' | 'insurance' | 'medical'
  active     Boolean @default(true)
  redemptions Redemption[]
  @@map("reward_offers")
}

model Redemption {
  id          String   @id @default(cuid())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      String
  offer       RewardOffer @relation(fields: [offerId], references: [id])
  offerId     String
  pointsSpent Int
  createdAt   DateTime @default(now())
  @@map("redemptions")
}

model PartnerLink {
  id       String   @id @default(cuid())
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId   String
  partner  String   // 'momentum_multiply' | 'discovery_vitality'
  linkedAt DateTime @default(now())
  @@unique([userId, partner])
  @@map("partner_links")
}
```

## Definition of Done
1. Fresh seed: summary → `pointsBalance: 0`, 6 offers ascending by cost, empty `linkedPartners`.
2. Link `momentum_multiply` → 200; summary shows the partner AND `pointsBalance: 100` (bonus). Re-link → 200, balance STILL 100 (idempotency). Link `fake_partner` → 400.
3. Complete two learn modules (via 04's endpoint in the e2e), then redeem `seed-offer-1` (500 ≤ 100+50+50? NO — e2e must complete enough modules to afford it, or assert the 400 first): e2e asserts `INSUFFICIENT_POINTS` with too few points, then completes modules until balance ≥ 500 and redeems successfully → `newBalance` = balance − 500; ledger sum equals `newBalance` (independent DB assert).
4. Unknown offer → 404. No auth → 401. Full `npm run test:e2e` green.

## ASSUMPTIONS
1. Partner linking is a mock handshake (upsert + bonus) — real Momentum/Discovery integrations are post-pilot; the 100-point bonus makes the flow demonstrable.
2. Redemption fulfilment (actually delivering airtime/vouchers) is manual/out-of-band in the pilot; the API records the redemption only.
