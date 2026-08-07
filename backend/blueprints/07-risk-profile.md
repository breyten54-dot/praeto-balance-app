# 07 — Risk Profile module (server-side scoring, FLAG-GATED)

**Builder:** sonnet-tier — scoring must match this spec exactly; requires 01 complete.

## Goal
`POST /risk-profile/submit` and `GET /risk-profile/latest` with ALL scoring server-side (per the FAIS advice-boundary rationale in `../src/screens/RiskProfileScreen.tsx`'s header comment), gated behind `FEATURE_RISK_PROFILE_ENABLED`.

## Context
Read `00-conventions.md`. App contract: `RiskProfileResult` in `../src/api/types.ts`. The app sends `{answers: {<questionId>: <optionValue>}}` with these EXACT ids/values (from `RiskProfileScreen.tsx`):
- `time_horizon`: `lt5 | 5to10 | 11to15 | gt15`
- `market_reaction`: `sell_immediately | sell_on_5pct | wait_a_year | stay_the_course`
- `risk_association`: `danger | uncertainty | opportunity | thrill`
- `underperformance_reaction`: `very_upset | somewhat_upset | uneasy_but_ok | not_concerned`

## Constraints
- When `FEATURE_RISK_PROFILE_ENABLED` is false: BOTH routes → 403 `FEATURE_DISABLED`. This is the legal gate (pending FAIS opinion) — never soften it.
- The `disclaimer` string below is returned VERBATIM on every result. The app renders it unconditionally; legal reviewed wording must not drift.
- Scoring lives in one pure function `scoreRiskProfile(answers)` in `modules/risk-profile/risk.formula.ts`, unit-tested — same pattern as 05.

## Build plan
1. Migration `risk-profile`: model below.
2. Scoring (exact): each answer maps to points 1–4 in the option order listed above (first option = 1 … fourth = 4).
   - `riskCapacityScore = timeHorizonPoints * 25` (25/50/75/100)
   - `riskAttitudeScore = Math.round(((market + association + underperformance) / 12) * 100)` (25–100)
   - `totalScore = Math.round(0.4 * riskCapacityScore + 0.6 * riskAttitudeScore)`
   - Category by totalScore: `<=34` conservative · `35–49` moderately_conservative · `50–64` moderate · `65–79` moderately_aggressive · `>=80` aggressive
3. `POST /risk-profile/submit`: validate all four ids present with allowed values (extra keys → 400; missing/invalid → 400 `VALIDATION_ERROR`); persist submission; respond `RiskProfileResult` with `recommendedProducts` = the seeded pair for the category and the verbatim `disclaimer`.
4. `GET /risk-profile/latest` → most recent submission mapped to `RiskProfileResult`, or literal JSON `null` with 200 if none (the app types this `RiskProfileResult | null`).
5. Seed `RiskProduct` rows (two per category, ids `seed-rp-<category>-1/2`): conservative → "Praeto Stable Income Fund" / "Money Market Plus"; moderately_conservative → "Balanced Defensive Portfolio" / "Capital Preserver"; moderate → "Praeto Balanced Fund" / "Diversified Growth 60/40"; moderately_aggressive → "Growth Equity Portfolio" / "SA + Offshore Flexible"; aggressive → "High Growth Equity Fund" / "Offshore Momentum Portfolio". Descriptions: one neutral sentence each, no performance claims (e.g. "A portfolio weighted toward capital stability with modest growth exposure.").
6. `test/risk-profile.e2e-spec.ts` + `risk.formula.spec.ts`.

## Exact inputs

```prisma
model RiskProfileSubmission {
  id                String   @id @default(cuid())
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId            String
  answers           Json
  riskCapacityScore Int
  riskAttitudeScore Int
  totalScore        Int
  category          String
  completedAt       DateTime @default(now())
  @@index([userId, completedAt])
  @@map("risk_profile_submissions")
}

model RiskProduct {
  id          String @id
  category    String
  name        String
  description String
  @@map("risk_products")
}
```

Verbatim disclaimer (single source: a `const` in the module):
```
This Risk Portrait is a guide only and does not constitute financial advice as defined in the Financial Advisory and Intermediary Services (FAIS) Act. Praeto Balance is not a licensed financial services provider. Please consult a licensed financial adviser before making any investment decision.
```

Unit-test vectors (hand-computed — implementation must match):
```
A) lt5, sell_immediately, danger, very_upset
   capacity 25; attitude round(3/12*100)=25; total round(10+15)=25 → conservative
B) gt15, stay_the_course, thrill, not_concerned
   capacity 100; attitude 100; total 100 → aggressive
C) 5to10, wait_a_year, opportunity, uneasy_but_ok
   capacity 50; attitude round(9/12*100)=75; total round(20+45)=65 → moderately_aggressive
```

## Definition of Done
1. `risk.formula.spec.ts` asserts vectors A, B, C — green.
2. With flag ON: submit vector C's answers → 200; `category:'moderately_aggressive'`; exactly 2 `recommendedProducts` with the seeded names; `disclaimer` matches the verbatim string character-for-character (e2e strict equality).
3. `GET /risk-profile/latest` → the same result; on a user with no submissions → 200 `null`.
4. Missing one answer → 400 `VALIDATION_ERROR`; unknown option value → 400; extra key → 400.
5. With `FEATURE_RISK_PROFILE_ENABLED=false` (e2e overrides env): both routes → **403 `FEATURE_DISABLED`**.
6. Full `npm run test:e2e` green.

## ASSUMPTIONS
1. Question set and 1–4 ordinal scoring mirror the app's Discovery-Risk-Portrait-inspired screen; weights (40/60 capacity/attitude) and thresholds are v1 placeholders pending the FAIS opinion — isolated in `risk.formula.ts`.
2. Product names are illustrative Praeto Investments placeholders, not real registered funds — must be replaced before the flag is ever flipped on in production.
3. The disclaimer wording above is drafted, not lawyer-approved — flag for Arusha Naidoo's review alongside the legal brief.
