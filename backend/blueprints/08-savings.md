# 08 — Savings module (mock partner_bank, FLAG-GATED)

**Builder:** haiku-tier mechanical — requires 01 complete.

## Goal
`GET /savings/account`, `POST /savings/goals`, `POST /savings/withdrawals` against a MOCKED partner-bank account, gated behind `FEATURE_SAVINGS_ENABLED`, returning the app's `SavingsAccount`/`SavingsGoal` shapes exactly.

## Context
Read `00-conventions.md`. App contract: `SavingsAccount` in `../src/api/types.ts` — note `provider` is the literal `'partner_bank'` (the type comment says "Praeto never holds the funds directly — see legal brief"). This module simulates the partner-bank ledger; no real money moves in the pilot.

## Constraints
- All three routes → 403 `FEATURE_DISABLED` when `FEATURE_SAVINGS_ENABLED=false`. Same legal gate discipline as 07.
- Withdrawal rules enforced server-side: max `withdrawalsAllowedPerYear` (4) per calendar year; amount ≤ balance; both violations → 400 `LIMIT_EXCEEDED` with messages "Withdrawal limit reached for this year." / "Insufficient savings balance."
- Balance/goal mutations atomic (`$transaction`).

## Build plan
1. Migration `savings`: models below.
2. `GET /savings/account` → account with `withdrawalsUsedThisYear` computed (count of `SavingsWithdrawal` rows in the current calendar year) and `goals` array. If the user has no account row, create it on first read with `balanceCents: 0` (lazy init) — demo user gets a seeded one.
3. `POST /savings/goals` body `{name: string 1–60 chars, targetCents: positive int, targetDate?: ISO date string}` → creates goal `currentCents: 0`, returns the `SavingsGoal` shape.
4. `POST /savings/withdrawals` body `{amountCents: positive int, goalId?: string}` → enforce rules; deduct from `balanceCents`; if `goalId` given (must belong to this account, else 404) also deduct from that goal's `currentCents` (floor at 0); return `{id, amountCents, newBalanceCents, createdAt}`.
5. Seed for demo user: account `balanceCents: 245000, interestRateAnnual: 5.5, withdrawalsAllowedPerYear: 4`; one goal `seed-goal-emergency` ("Emergency fund", target 1000000, current 245000, no targetDate); zero withdrawals.
6. `test/savings.e2e-spec.ts`.

## Exact inputs

```prisma
model SavingsAccountModel {
  id                       String  @id @default(cuid())
  user                     User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId                   String  @unique
  provider                 String  @default("partner_bank")
  balanceCents             Int     @default(0)
  interestRateAnnual       Float   @default(5.5)
  withdrawalsAllowedPerYear Int    @default(4)
  goals                    SavingsGoalModel[]
  withdrawals              SavingsWithdrawal[]
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
  @@map("savings_accounts")
}

model SavingsGoalModel {
  id           String   @id @default(cuid())
  account      SavingsAccountModel @relation(fields: [accountId], references: [id], onDelete: Cascade)
  accountId    String
  name         String
  targetCents  Int
  currentCents Int      @default(0)
  targetDate   DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@map("savings_goals")
}

model SavingsWithdrawal {
  id          String   @id @default(cuid())
  account     SavingsAccountModel @relation(fields: [accountId], references: [id], onDelete: Cascade)
  accountId   String
  amountCents Int
  goalId      String?
  createdAt   DateTime @default(now())
  @@index([accountId, createdAt])
  @@map("savings_withdrawals")
}
```

Response mapping note: API field names must match `types.ts` (`SavingsAccount.goals[].targetDate` is `string | null` — serialize the DateTime to `YYYY-MM-DD` or null).

## Definition of Done
1. Flag ON: `GET /savings/account` → seeded account, `withdrawalsUsedThisYear: 0`, 1 goal with `currentCents: 245000`.
2. Create goal `{"name":"December holiday","targetCents":500000}` → 200/201; account now lists 2 goals.
3. Withdraw `{"amountCents":45000,"goalId":"seed-goal-emergency"}` → `newBalanceCents: 200000`; goal current drops to 200000. Withdraw `{"amountCents":99999999}` → 400 `LIMIT_EXCEEDED` (insufficient). Three more small withdrawals → the 5th withdrawal attempt in the year → 400 `LIMIT_EXCEEDED` (annual cap).
4. `goalId` belonging to another user → 404 `NOT_FOUND`. Validation: empty name / negative amount → 400 `VALIDATION_ERROR`.
5. Flag OFF (e2e overrides env): all three routes → **403 `FEATURE_DISABLED`**.
6. Full `npm run test:e2e` green.

## ASSUMPTIONS
1. Interest accrual is NOT simulated (rate is display-only in the pilot).
2. Deposits have no endpoint — the app has no deposit screen (`endpoints.ts` has none); pilot balances move only via seed and withdrawals.
3. Model names carry the `Model` suffix to avoid colliding with the app-facing type names in generated client code; table names stay clean via `@@map`.
