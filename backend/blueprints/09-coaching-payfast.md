# 09 — Coaching + PayFast sandbox (signature, ITN webhook, status polling)

**Builder:** sonnet-tier, payment-critical — follow this spec to the letter; when in doubt STOP and return the question. Requires 01 complete.

## Goal
Coaching availability + bookings with real PayFast **sandbox** checkout: server-side signature generation, ITN webhook with signature + server-postback verification, and the `GET /coaching/bookings/:id` status endpoint (fixes Finding 2 in `REVIEW-Claude-2026-07-08.md` — the app must be able to poll server-verified payment status instead of trusting the browser redirect).

## Context
Read `00-conventions.md`. App side: `../src/services/payments.ts` (calls `createBooking(tier)`, expects `{id, checkoutUrl}`, opens checkout via `openAuthSessionAsync`, treats no-checkoutUrl/discovery as instantly confirmed) and `../src/api/endpoints.ts` `CoachingApi`. Tier prices MUST match the app's display table (`CoachingTierPricing`): discovery 0 · starter 190000 · growth 350000 · transformation 750000 (cents). The backend is the price source of truth — ignore any client-supplied amount.

## Constraints
- PayFast merchant key + passphrase live ONLY in backend env. Never returned by any endpoint, never logged.
- The ITN handler must always return HTTP 200 to PayFast (even for invalid notifications — log and ignore), per PayFast's retry semantics.
- A booking flips to `confirmed` ONLY via a verified ITN with `payment_status=COMPLETE` and matching amount. Never from the return redirect.

## Build plan
1. Migration `coaching`: models below.
2. `GET /coaching/availability` → `{slots: [{id, startsAt, endsAt}]}` — future unbooked slots, ascending. Seed: weekdays for the next 14 days at 09:00, 11:00, 14:00 SAST, 45-minute slots (regenerated idempotently relative to run date).
3. `POST /coaching/bookings` body `{tier}` (enum-validated):
   - `discovery` → create `{status:'confirmed', priceCents: 0}`, respond `{id, tier, status:'confirmed', checkoutUrl: null}`.
   - Paid tiers → create `{status:'pending_payment', priceCents: <server table>}`, build the sandbox checkout URL (below), respond `{id, tier, status:'awaiting_payment', checkoutUrl}`. (App maps anything with a checkoutUrl to the browser flow.)
4. `GET /coaching/bookings/:id` → `{id, tier, status: 'awaiting_payment'|'confirmed'|'cancelled', priceCents}` — `pending_payment` maps to the wire value `awaiting_payment` (the app's `BookCoachingResult` vocabulary). Booking not owned by caller → 404 `NOT_FOUND`.
5. **Checkout URL construction** — `https://sandbox.payfast.co.za/eng/process?<query>` with fields IN THIS ORDER:
   `merchant_id, merchant_key, return_url, cancel_url, notify_url, m_payment_id, amount, item_name, signature`
   - `return_url` = `${API_PUBLIC_URL}/api/v1/payments/coaching-return?bookingId=<id>`
   - `cancel_url` = same path + `&status=cancelled`
   - `notify_url` = `${API_PUBLIC_URL}/api/v1/webhooks/payfast/itn`
   - `m_payment_id` = booking id · `amount` = `(priceCents/100).toFixed(2)` · `item_name` = `Praeto Balance — <tier label>`
   - **Signature algorithm (PayFast spec):** take the non-empty fields above (excluding `signature`) in that exact order; URL-encode each value RFC1738-style (spaces become `+`, percent-encoding uppercase); join as `key=value&key=value`; if `PAYFAST_PASSPHRASE` is non-empty append `&passphrase=<urlencoded passphrase>`; signature = lowercase hex MD5 of that string. Implement in `modules/coaching/payfast.signature.ts` as a pure function with unit tests.
6. `GET /payments/coaching-return` (`@Public`) → returns a minimal HTML page: `<script>location.href='praetobalance://payments/coaching-return'</script>` plus a "Return to the Praeto Balance app" link — this is what closes the in-app browser (the app's `openAuthSessionAsync` redirect scheme), since PayFast requires https return URLs and cannot redirect straight to a custom scheme.
7. `POST /webhooks/payfast/itn` (`@Public`, `application/x-www-form-urlencoded` — enable the urlencoded body parser for this route):
   a. Rebuild the signature from the received fields **in received order**, excluding `signature`, passphrase appended as above; compare to the received `signature` — mismatch → log, respond 200, done.
   b. Server postback: POST the raw received body to `https://sandbox.payfast.co.za/eng/query/validate`; anything but `VALID` → log, respond 200, done. (Base host from `PAYFAST_MODE`.)
   c. Load booking by `m_payment_id`; verify `parseFloat(amount_gross) * 100 === booking.priceCents` (integer compare after rounding); mismatch → log, respond 200.
   d. `payment_status === 'COMPLETE'` → set booking `confirmed`, store `payfastPaymentId = pf_payment_id`; `CANCELLED` → set `cancelled`. Record every received ITN in `PaymentNotification` (raw body Json, validity verdict).
   e. Respond 200 always.
8. `test/coaching.e2e-spec.ts` + `payfast.signature.spec.ts`.

## Exact inputs

```prisma
model CoachingSlot {
  id       String   @id @default(cuid())
  startsAt DateTime
  endsAt   DateTime
  booked   Boolean  @default(false)
  @@index([startsAt])
  @@map("coaching_slots")
}

model CoachingBooking {
  id               String   @id @default(cuid())
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId           String
  tier             String   // 'discovery' | 'starter' | 'growth' | 'transformation'
  priceCents       Int
  status           String   @default("pending_payment") // pending_payment | confirmed | cancelled
  payfastPaymentId String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  @@map("coaching_bookings")
}

model PaymentNotification {
  id        String   @id @default(cuid())
  bookingId String?
  rawBody   Json
  verdict   String   // 'valid' | 'bad_signature' | 'postback_invalid' | 'amount_mismatch' | 'unknown_booking'
  createdAt DateTime @default(now())
  @@map("payment_notifications")
}
```

`.env.example` additions (sandbox defaults are PayFast's published public sandbox credentials):
```bash
PAYFAST_MODE=sandbox                  # sandbox | live
PAYFAST_MERCHANT_ID=10000100
PAYFAST_MERCHANT_KEY=46f0cd694581a
PAYFAST_PASSPHRASE=                   # empty unless set in the sandbox dashboard
API_PUBLIC_URL=http://localhost:4000  # overridden on Fly in blueprint 12
```

## Definition of Done
1. `payfast.signature.spec.ts`: (a) golden-vector stability test — compute the signature for a fixed input once, assert the exact hex constant in the spec thereafter; (b) empty-passphrase and with-passphrase variants both covered; (c) a value containing a space and an `&` encodes correctly (space → `+`).
2. Book `discovery` → 200 `{status:'confirmed', checkoutUrl:null}`. Book `starter` → `{status:'awaiting_payment'}` with `checkoutUrl` starting `https://sandbox.payfast.co.za/eng/process?` containing `m_payment_id=<id>`, `amount=1900.00`, and a 32-char hex `signature`.
3. `GET /coaching/bookings/:id` → `awaiting_payment`; another user's booking id → 404.
4. e2e ITN simulation (postback step mocked to return `VALID`): correctly-signed `COMPLETE` ITN → booking flips `confirmed`, `PaymentNotification` verdict `valid`; **tampered-amount ITN → booking stays `awaiting_payment`**, verdict `amount_mismatch`; **bad-signature ITN → unchanged**, verdict `bad_signature`; handler returned 200 in ALL cases.
5. `GET /payments/coaching-return?bookingId=x` → 200 HTML containing `praetobalance://`.
6. Invalid tier → 400 `VALIDATION_ERROR`. No auth on booking routes → 401. Full `npm run test:e2e` green.

## ASSUMPTIONS
1. Slots are informational in the pilot: bookings do not consume a specific slot (the app's `createBooking` sends only `{tier}`, no slotId). Slot-picking UI is post-pilot; availability endpoint feeds a display list.
2. PayFast source-IP verification is SKIPPED in sandbox mode (signature + server postback + amount check give three verification layers); add IP verification when `PAYFAST_MODE=live` — leave a `TODO(live)` marker.
3. `API_PUBLIC_URL=http://localhost:4000` means sandbox ITNs cannot reach a local machine — full end-to-end PayFast testing happens after blueprint 12 deploys to Fly; until then the mocked-postback e2e is the verification.
