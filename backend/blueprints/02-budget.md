# 02 — Budget module + seeded transactions

**Builder:** haiku-tier mechanical — every decision pre-made; requires 01 complete.

## Goal
`GET /budget/summary` and `PUT /budget/categories/:category/limit` working against seeded transaction data, returning the app's `BudgetSummary` shape exactly, so the Dashboard screen renders real numbers.

## Context
Read `00-conventions.md`. App contract: `BudgetSummary`/`BudgetCategory` in `../src/api/types.ts`. Consumer: `../src/screens/DashboardScreen.tsx` (note it looks up `category === 'gambling'` for the overspend alert — the category slug must be exactly `gambling`). The `Transaction` model created here is shared with blueprints 03 (gambling) and 11 (bank-link) — build it exactly as specified.

## Constraints
- Category slugs are a FIXED set (see below). Reject any other slug in the limit endpoint with 404 `NOT_FOUND`.
- `month` query param format `YYYY-MM`; omitted = current month (server timezone Africa/Johannesburg — set `TZ=Africa/Johannesburg` in `.env.example` and docker/fly env).
- Seed dates must be RELATIVE to run date (current + previous month), never hardcoded calendar dates — the demo must always show current-month data.

## Build plan
1. Migration `budget`: add `monthlyIncomeCents Int @default(1850000)` to `User`; new models below.
2. `BudgetModule` with `GET /budget/summary` and `PUT /budget/categories/:category/limit` (body `{limitCents: number}` — positive int, class-validator).
3. Summary logic: for the target month, `totalSpentCents` = sum of the user's transactions in that month; `availableCents = monthlyIncomeCents - totalSpentCents` (may go negative — do not clamp); `categories` = one entry per fixed category (all 8, even if zero spend), `spentCents` summed per category, `limitCents` from `BudgetCategoryLimit` (fall back to the seed defaults below).
4. Limit endpoint upserts `BudgetCategoryLimit` for (userId, category), returns the updated `BudgetCategory` shape.
5. Extend `prisma/seed.ts` (idempotent): category limits + ~40 transactions for demo user (current month) + ~35 (previous month) using the merchant pool below; include EXACTLY 6 gambling transactions in the current month totalling MORE than the gambling limit (so the Dashboard overspend alert and blueprint 03 have data). Use stable seed IDs (`seed-tx-001`…).
6. `test/budget.e2e-spec.ts`.

## Exact inputs

Prisma models:
```prisma
model Transaction {
  id         String   @id @default(cuid())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId     String
  merchant   String
  category   String
  amountCents Int
  occurredAt DateTime
  source     String   @default("seed") // "seed" | "bank_link"
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@index([userId, occurredAt])
  @@map("transactions")
}

model BudgetCategoryLimit {
  id         String @id @default(cuid())
  user       User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId     String
  category   String
  limitCents Int
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@unique([userId, category])
  @@map("budget_category_limits")
}
```

Fixed categories (slug / label / icon / default limitCents):
```
groceries      Groceries          🛒  450000
transport      Transport          🚕  180000
airtime_data   Airtime & Data     📱   60000
utilities      Utilities          💡  150000
eating_out     Eating Out         🍔  120000
entertainment  Entertainment      🎬   80000
gambling       Gambling           🎰   50000
other          Other              📦  100000
```

Merchant pool for seeds (merchant → category): Checkers→groceries, Shoprite→groceries, Woolworths Food→groceries, Uber→transport, Bolt→transport, Engen→transport, Vodacom Airtime→airtime_data, Telkom Data→airtime_data, Eskom Prepaid→utilities, City of Durban Water→utilities, KFC→eating_out, Nando's→eating_out, Steers→eating_out, Showmax→entertainment, Netflix→entertainment, Ster-Kinekor→entertainment, Hollywoodbets→gambling, Betway→gambling, Lottostar→gambling, Takealot→other, Clicks→other. Amounts: realistic (groceries 15000–85000; transport 4500–25000; gambling 5000–20000 per bet).

## Definition of Done
1. `npx prisma migrate dev` + `npm run prisma:seed` exit 0; seed re-run exits 0 without duplicates.
2. `GET /api/v1/budget/summary` (Bearer token) → 200: `month` = current `YYYY-MM`; ALL 8 categories present each with `category,label,limitCents,spentCents,icon`; `totalSpentCents` equals the sum of the 8 `spentCents` values (assert in e2e); gambling `spentCents > limitCents`.
3. `GET /budget/summary?month=<previous>` → previous month's numbers, non-zero.
4. `PUT /budget/categories/groceries/limit` `{"limitCents":500000}` → 200, follow-up summary reflects 500000. `PUT .../not_a_category/limit` → 404 `NOT_FOUND`. `{"limitCents":-5}` → 400 `VALIDATION_ERROR`.
5. No auth header → 401 envelope. `npm run test:e2e` green including 01's specs.

## ASSUMPTIONS
1. Income is a flat monthly figure on the user (R18,500 for demo) — no income-transaction detection in the pilot.
2. All 8 categories always returned, including zero-spend ones (Dashboard renders whatever it receives; consistent full list beats sparse).
