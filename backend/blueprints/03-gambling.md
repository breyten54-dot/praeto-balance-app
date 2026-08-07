# 03 — Gambling monitor module

**Builder:** haiku-tier mechanical — requires 01–02 complete (reads the `Transaction` model).

## Goal
The four gambling endpoints working against the gambling-category transactions seeded in 02, returning the app's `GamblingSpendSummary` shape exactly, so the Gambling Monitor screen is fully functional (summary card, transaction list, daily alert toggle, cooling-off request).

## Context
Read `00-conventions.md`. App contract: `GamblingSpendSummary` in `../src/api/types.ts`. Consumer: `../src/screens/GamblingMonitorScreen.tsx` — it renders `transactions[].date` directly, so date must be a `YYYY-MM-DD` string; the cooling-off button sends `{days: 30}` and shows "cannot be reversed early" — the API must actually enforce that.

## Constraints
- Gambling spend = sum of the user's `Transaction` rows with `category = 'gambling'` in the current month. No separate gambling-transaction table.
- The monthly limit lives in `GamblingSettings.monthlyLimitCents`, NOT in `BudgetCategoryLimit` — but 02's budget summary uses `BudgetCategoryLimit`. To avoid two sources of truth: `PUT /gambling/limit` must update BOTH (settings row and the `gambling` budget-category limit) in one transaction.
- An active cooling-off period cannot be cancelled or shortened via any endpoint. No delete route exists.

## Build plan
1. Migration `gambling`: models below.
2. `GamblingModule` with the four routes.
3. `GET /gambling/summary` → `{month, limitCents, spentCents, isOverLimit, transactions, dailyAlertEnabled, dailyAlertThresholdCents}`. `transactions`: current-month gambling rows sorted `occurredAt` desc, mapped to `{id, merchant, date: 'YYYY-MM-DD', category: 'gambling', amountCents}`. `isOverLimit = spentCents > limitCents`.
4. `PUT /gambling/limit` body `{limitCents}` (positive int) → upserts settings + budget category limit; returns the refreshed summary.
5. `POST /gambling/cooling-off` body `{days}` (int 1–90) → if an active period exists (now < endsAt) respond 409 `{code:'COOLING_OFF_ACTIVE', message:'A cooling-off period is already active until <ISO date>.'}` (add `COOLING_OFF_ACTIVE` to the global error-code list); else create `{startsAt: now, endsAt: now + days}` and return `{id, startsAt, endsAt}`.
6. `PUT /gambling/daily-alert` body `{enabled: boolean, thresholdCents?: positive int}` → update settings; if `enabled=true` and no threshold provided and none stored, default `10000`; returns `{dailyAlertEnabled, dailyAlertThresholdCents}`.
7. Seed: `GamblingSettings` for demo user `monthlyLimitCents: 50000, dailyAlertEnabled: false, dailyAlertThresholdCents: null`. (Gambling transactions already seeded in 02.)
8. `test/gambling.e2e-spec.ts`.

## Exact inputs

```prisma
model GamblingSettings {
  id                      String  @id @default(cuid())
  user                    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId                  String  @unique
  monthlyLimitCents       Int     @default(50000)
  dailyAlertEnabled       Boolean @default(false)
  dailyAlertThresholdCents Int?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  @@map("gambling_settings")
}

model CoolingOffPeriod {
  id        String   @id @default(cuid())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  startsAt  DateTime
  endsAt    DateTime
  createdAt DateTime @default(now())
  @@index([userId, endsAt])
  @@map("cooling_off_periods")
}
```

## Definition of Done
1. `GET /api/v1/gambling/summary` → 200; `spentCents` equals the sum of 02's six seeded gambling transactions (e2e computes independently from the DB and compares); `isOverLimit: true` (seed guarantees overspend); every transaction has `date` matching `/^\d{4}-\d{2}-\d{2}$/`.
2. `PUT /gambling/limit` `{"limitCents":150000}` → `isOverLimit` flips to false IF seed total < 150000; budget summary's gambling category now also shows 150000 (cross-module consistency assert).
3. `POST /gambling/cooling-off` `{"days":30}` → 201/200 with `endsAt` ≈ now+30d; immediate second call → **409 `COOLING_OFF_ACTIVE`**. `{"days":365}` → 400 `VALIDATION_ERROR`.
4. `PUT /gambling/daily-alert` `{"enabled":true}` → `dailyAlertThresholdCents: 10000` default applied.
5. No auth → 401. Full `npm run test:e2e` green including prior modules.

## ASSUMPTIONS
1. Cooling-off enforcement is informational in the pilot (no bank-side transaction blocking exists to enforce) — the record is kept and surfaced; real enforcement arrives with a bank integration.
2. Daily-alert delivery (push notification) is NOT in pilot scope — only the setting is stored; `expo-notifications` wiring is a future item.
