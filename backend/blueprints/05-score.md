# 05 — Balance Score module (formula v1 + history)

**Builder:** sonnet-tier — the formula must be implemented EXACTLY as specified; requires 01–04 complete.

## Goal
`GET /score` and `GET /score/history` computing the Praeto Balance Score server-side from budget, gambling, and learn data, returning the app's `BalanceScoreResponse` shape exactly. Server-side because the methodology must be changeable without an app release and un-fakeable from a rooted device (see `../backend/README.md` §1).

## Context
Read `00-conventions.md`. App contract: `BalanceScoreResponse` in `../src/api/types.ts` — five named dimensions, each 0–100, plus overall `score`, `changeFromLastMonth`, `computedAt`. Consumer: `../src/screens/DashboardScreen.tsx` (ScoreRing + "▲ N points this month").

## Constraints
- The formula below is **v1 and lives in ONE pure function** `computeScore(inputs): {score, dimensions}` in `modules/score/score.formula.ts` with unit tests — no DB access inside the function. All tuning later happens in that one file.
- Snapshots are per calendar month, upserted — never more than one row per (user, month).

## Build plan
1. Migration `score`: model below.
2. Pure formula (exact):
   - Inputs for month M: `incomeCents`, `totalSpentCents`, `categoriesOverLimit` (count of the 8 budget categories where spent > limit), `gamblingSpentCents`, `gamblingLimitCents`, `completedLearnModules` (all-time count).
   - `clamp(x) = Math.max(0, Math.min(100, Math.round(x)))`
   - `spendRatio = incomeCents === 0 ? 1 : totalSpentCents / incomeCents`
   - `moneyManagement = clamp(150 - 100 * spendRatio)`   // spend ≤50% of income → 100; ≥150% → 0
   - `spendingControl = clamp(100 - 20 * categoriesOverLimit - (gamblingSpentCents > gamblingLimitCents ? 10 : 0))`
   - `savingBehaviour = clamp(((Math.max(0, incomeCents - totalSpentCents)) / (incomeCents || 1)) * 400)`   // ≥25% left over → 100
   - `financialKnowledge = clamp(completedLearnModules * 12)`   // all 12 modules → 100 (12*12=144 clamps)
   - `debtResilience = 50`   // constant in v1 — no debt data exists yet; documented placeholder
   - `score = clamp(0.25*moneyManagement + 0.25*spendingControl + 0.20*savingBehaviour + 0.20*financialKnowledge + 0.10*debtResilience)`
3. `GET /score`: gather current-month inputs, run formula, upsert this month's `ScoreSnapshot`, read previous month's snapshot (`changeFromLastMonth = current.score - previous.score`, `0` if no previous), respond `{score, changeFromLastMonth, dimensions:{...all five...}, computedAt: now ISO}`.
4. `GET /score/history?months=N` (N int 1–24, default 6) → `{months: [{month:'YYYY-MM', score:number}]}` ascending, from stored snapshots only (months without a snapshot are omitted, not zero-filled).
5. On first run for the demo user, also backfill the PREVIOUS month's snapshot from 02's previous-month seed data so `changeFromLastMonth` is non-zero out of the box.
6. `test/score.e2e-spec.ts` + `modules/score/score.formula.spec.ts` (unit).

## Exact inputs

```prisma
model ScoreSnapshot {
  id         String   @id @default(cuid())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId     String
  month      String   // 'YYYY-MM'
  score      Int
  dimensions Json
  computedAt DateTime @default(now())
  @@unique([userId, month])
  @@map("score_snapshots")
}
```

Unit-test vectors the formula spec MUST assert (hand-computed here — if the implementation disagrees, the implementation is wrong):
```
A) income 1850000, spent 925000, overLimit 0, gamblingOver false, learn 0
   → spendRatio 0.5 → moneyManagement 100; spendingControl 100;
     savingBehaviour clamp((925000/1850000)*400)=clamp(200)=100;
     financialKnowledge 0; debtResilience 50;
     score = clamp(25+25+20+0+5) = 75
B) income 1850000, spent 2035000 (110%), overLimit 3, gamblingOver true, learn 6
   → moneyManagement clamp(150-110)=40; spendingControl clamp(100-60-10)=30;
     savingBehaviour 0; financialKnowledge 72; debtResilience 50;
     score = clamp(10 + 7.5 + 0 + 14.4 + 5) = clamp(36.9) = 37
C) income 0, spent 0, overLimit 0, gamblingOver false, learn 12
   → spendRatio 1 → moneyManagement 50; spendingControl 100; savingBehaviour 0;
     financialKnowledge 100; debtResilience 50;
     score = clamp(12.5+25+0+20+5) = 63  (division-by-zero guard proof)
```

## Definition of Done
1. `score.formula.spec.ts` asserts vectors A, B, C exactly — green.
2. `GET /api/v1/score` → 200 with all five dimensions present, each 0–100; calling twice does not create a second snapshot for the month (DB count assert).
3. `changeFromLastMonth` is a non-zero integer for the seeded demo user (backfill proof).
4. `GET /score/history?months=6` → `{months:[...]}` ascending with ≥2 entries; `months=99` → 400 `VALIDATION_ERROR`.
5. No auth → 401. Full `npm run test:e2e` green.

## ASSUMPTIONS
1. `debtResilience = 50` constant is acceptable for v1 (no debt/credit data source exists). The dimension stays visible in the app rather than being hidden, so the ring layout matches the design.
2. Score weights (25/25/20/20/10) are a defensible v1, not validated methodology — revisit with real pilot data; only `score.formula.ts` changes.
3. History returns stored snapshots only; pre-launch months simply won't exist.
