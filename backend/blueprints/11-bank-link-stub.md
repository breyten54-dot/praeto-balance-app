# 11 — Bank-link stub endpoints

**Builder:** haiku-tier mechanical. Requires 01 complete.

## Goal
The four bank-link endpoints working as a MOCK of an aggregator flow (Stitch/Mono arrive post-pilot behind the same interface), so the app's linking screens can be built/demo'd and the API surface is complete.

## Context
Read `00-conventions.md`. App calls (`../src/api/endpoints.ts` `BankLinkApi`): `POST /bank-link/token`, `POST /bank-link/exchange {publicToken, institutionId}`, `GET /bank-link/accounts`, `DELETE /bank-link/accounts/:id`. Responses are untyped in the app today — the shapes below become the contract.

## Constraints
- No real bank connection. Linked accounts are records only; transactions continue to come from seed data (02). Do NOT generate transactions on link.
- Link tokens: single-use, 15-minute expiry, persisted (must survive an API restart mid-flow).

## Build plan
1. Migration `bank-link`: models below.
2. `POST /bank-link/token` → create row, respond `{linkToken: <cuid>, expiresAt: <ISO>}`.
3. `POST /bank-link/exchange` body `{publicToken: string, institutionId: string}`:
   - token unknown/expired/used → 401 `{code:'UNAUTHORIZED', message:'Link token is invalid or expired.'}`
   - `institutionId` not in the map below → 400 `VALIDATION_ERROR`
   - success → mark token used, create `BankAccount` with `maskedAccountNumber` = `'****' + 4 random digits`, respond the account shape below.
4. `GET /bank-link/accounts` → `{accounts: [<account shape>]}` (active only, newest first).
5. `DELETE /bank-link/accounts/:id` → owner-checked (else 404); soft-delete (`status: 'unlinked'`); respond `{deleted: true}`.
6. `test/bank-link.e2e-spec.ts`.

## Exact inputs

Institution map (id → display name): `absa` → Absa · `fnb` → FNB · `standard_bank` → Standard Bank · `nedbank` → Nedbank · `capitec` → Capitec

Account response shape:
```json
{
  "id": "<cuid>",
  "institutionId": "capitec",
  "institutionName": "Capitec",
  "maskedAccountNumber": "****4821",
  "status": "active",
  "linkedAt": "<ISO>"
}
```

```prisma
model BankLinkToken {
  id        String   @id @default(cuid())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  used      Boolean  @default(false)
  expiresAt DateTime
  createdAt DateTime @default(now())
  @@map("bank_link_tokens")
}

model BankAccount {
  id                  String   @id @default(cuid())
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId              String
  institutionId       String
  institutionName     String
  maskedAccountNumber String
  status              String   @default("active") // active | unlinked
  linkedAt            DateTime @default(now())
  @@map("bank_accounts")
}
```

## Definition of Done
1. Token → exchange (`{publicToken:<the token>, institutionId:'capitec'}`) → 200 account with `institutionName:'Capitec'` and masked number matching `/^\*{4}\d{4}$/`.
2. Re-using the same token → **401** (single-use proof). Expired token (e2e creates one with past expiry directly in DB) → 401. `institutionId:'barclays'` → 400.
3. Accounts list shows the linked account; after DELETE → `{deleted:true}` and the list no longer includes it; deleting another user's account id → 404.
4. No auth → 401 on all four routes. Full `npm run test:e2e` green.

## ASSUMPTIONS
1. `publicToken` in the exchange call is the same value as `linkToken` (in a real aggregator these differ; the mock collapses them — the app treats both as opaque).
2. Unlinking is soft-delete for audit trail; no purge endpoint in the pilot (POPIA data-subject deletion tooling is a backend README pre-production item, tracked there).
