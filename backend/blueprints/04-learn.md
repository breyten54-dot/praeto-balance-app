# 04 — Learn module + points ledger

**Builder:** haiku-tier mechanical — requires 01 complete. (Numbered before Score because Score's `financialKnowledge` dimension reads Learn completions.)

## Goal
`GET /learn/modules` and `POST /learn/modules/:id/complete` working with seeded content, plus the `PointsLedger` table that Rewards (06) will consume. App shape: `LearnModule` in `../src/api/types.ts`.

## Context
Read `00-conventions.md`. Consumer: `../src/screens/LearnScreen.tsx` calls `getModules(lsmBand)` with the user's LSM band as a query param.

## Constraints
- Module content is server-seeded static data — no CMS, no admin CRUD in the pilot.
- Completion is idempotent: completing an already-completed module returns 200 with the same response, does NOT award points twice.
- v1 serves the SAME module list to every LSM band: accept and log the `lsmBand` query param, do not filter on it (content variants per band are a post-pilot item).

## Build plan
1. Migration `learn`: models below.
2. `GET /learn/modules?lsmBand=<band>` → array of `{id, pillar, title, subtitle, status, pointsAwarded, estimatedMinutes}` ordered by (pillar asc, orderIndex asc).
   **Status rule (exact):** `completed` if a `LearnCompletion` exists for (user, module); else `available` if the module has the LOWEST `orderIndex` among that user's uncompleted modules **within its pillar**; else `locked`. (Each pillar therefore always has exactly one `available` module until the pillar is finished.)
3. `POST /learn/modules/:id/complete` → unknown id: 404 `NOT_FOUND`; module `locked` for this user: 403 `{code:'FORBIDDEN', message:'Complete the previous module in this pillar first.'}`; `available`: create completion + insert `PointsLedger` row `{delta: pointsAwarded, reason: 'learn_module', refId: moduleId}`, return `{id, status:'completed', pointsAwarded}`; already `completed`: return the same 200 body, no new ledger row.
4. Seed the 12 modules below (stable ids `seed-learn-01`…`seed-learn-12`) and zero completions.
5. `test/learn.e2e-spec.ts`.

## Exact inputs

```prisma
model LearnModuleDef {
  id               String @id
  pillar           Int
  orderIndex       Int
  title            String
  subtitle         String
  pointsAwarded    Int
  estimatedMinutes Int
  completions      LearnCompletion[]
  @@unique([pillar, orderIndex])
  @@map("learn_modules")
}

model LearnCompletion {
  id        String   @id @default(cuid())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  module    LearnModuleDef @relation(fields: [moduleId], references: [id])
  moduleId  String
  createdAt DateTime @default(now())
  @@unique([userId, moduleId])
  @@map("learn_completions")
}

model PointsLedger {
  id        String   @id @default(cuid())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  delta     Int      // positive = earned, negative = spent
  reason    String   // 'learn_module' | 'redeem' | 'partner_link_bonus'
  refId     String?
  createdAt DateTime @default(now())
  @@index([userId])
  @@map("points_ledger")
}
```

Seed content (pillar / order / title / subtitle / points / minutes):
```
1 1 Where does your money go?     Track a month of real spending             50 6
1 2 Needs, wants and leaks        Spot the spending that adds no value       50 7
1 3 Your first budget             Build a simple monthly plan that sticks    75 10
2 1 The debt spiral               How short-term credit gets expensive       50 8
2 2 Good debt, bad debt           When borrowing builds vs breaks you        50 8
2 3 Getting out of arrears        A step-by-step catch-up plan               75 10
3 1 Why save at all?              Emergencies cost less when you're ready    50 6
3 2 The 30-day rule               Beat impulse buying with one habit         50 5
3 3 Saving on an irregular income Strategies when pay is unpredictable       75 9
4 1 Gambling: the real odds       What the numbers actually say              75 8
4 2 Chasing losses                Recognising the pattern before it grows    75 8
4 3 Betting within a budget       Hard limits and cooling-off tools          100 10
```

## Definition of Done
1. Seeded: `GET /api/v1/learn/modules?lsmBand=lsm_4_6` → 12 modules; exactly 4 have `status:'available'` (one per pillar: orders 1,1,1,1); the rest `locked`; ordering is (pillar, orderIndex).
2. Complete `seed-learn-01` → 200; module list now shows it `completed` and `seed-learn-02` `available`; `PointsLedger` has one row `delta:50`.
3. Repeat the same complete call → 200 identical body; ledger STILL has exactly one row (idempotency assert).
4. Complete `seed-learn-03` while `seed-learn-02` incomplete → 403 `FORBIDDEN`. Unknown id → 404. No auth → 401.
5. Full `npm run test:e2e` green.

## ASSUMPTIONS
1. Same content for all LSM bands in v1 (param accepted, unused) — flagged in code with a TODO.
2. Points values above are placeholders the user can retune later; changing them only means editing the seed.
