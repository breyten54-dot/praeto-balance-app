# Praeto Balance

A React Native (Expo) mobile app for iOS and Android — financial wellness,
budgeting, and responsible-gambling spend management for South African
households, built by Praeto Group Holdings.

## Stack

- Expo SDK 51 / React Native 0.74 — one codebase for iOS + Android
- TypeScript, strict mode
- React Navigation (bottom tabs + native stack for modals)
- TanStack Query for all server data
- Zustand for client-only state (session, subscription flag, LSM band)
- RevenueCat for App Store / Play Store compliant subscriptions
- PayFast for real-world service payments (coaching bookings)
- EAS Build/Submit for CI builds and store submission

## Getting started

```
npm install
cp .env.example .env
npx expo start
```

You'll need a backend running (or pointed at staging) for anything past
the login screen to work — see backend/README.md for what that backend
needs to expose. This repo does not include the backend implementation.

## The two payment paths — read this before touching payments code

This is the single most consequential architectural decision in the app,
and it exists to avoid App Store rejection.

In-app subscriptions live in src/services/subscriptions.ts and go through
RevenueCat to native StoreKit / Play Billing, because they unlock digital
content inside the app — Apple/Google require their own IAP for this
(App Store Review Guideline 3.1.1).

Coaching bookings live in src/services/payments.ts and go through a
PayFast hosted web checkout, because they pay for a human-delivered,
real-world service — exempt from IAP requirements the same way Uber or a
plumber-booking app is exempt.

Never link out to a web checkout for a subscription that unlocks app
features, and never route a real-world service through native IAP. If a
future feature is ambiguous, ask before building — getting this wrong is
an App Store rejection, not just a code review comment.

## Feature flags

src/config/env.ts gates balanceSave and riskProfileModule OFF in
production by default. These stay off until Arusha Naidoo's regulatory
opinion (see Praeto_Balance_PreLaunch_Legal_Brief.docx) confirms the
FAIS/NCA/Banks Act position on each. Flip them once cleared — ideally via
a remote config service so re-enabling doesn't require an app store
release.

## Project structure

```
App.tsx                        root: providers, session rehydration
src/
  config/env.ts                 dev/staging/production config + flags
  api/
    client.ts                   axios instance, auth token refresh
    endpoints.ts                 typed API calls
    types.ts                     shared API response types
  services/
    subscriptions.ts             RevenueCat - in-app subscriptions
    payments.ts                   PayFast - coaching bookings
  navigation/AppNavigator.tsx     tab + stack navigation
  screens/                        one file per screen
  components/                     shared UI (Card, ScoreRing, BudgetBar)
  context/appStore.ts             zustand - session/subscription state
  theme/colors.ts                  Praeto Balance brand tokens
backend/README.md                 required API surface + scaling notes
```

## Building for TestFlight / Play Console internal testing

```
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

## Building for production release

```
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

Before your first production build, replace every REPLACE_WITH_*
placeholder in app.json and eas.json with real values: your EAS project
ID, Apple Team ID, App Store Connect app ID, and Google Play service
account key path.

## Pre-launch checklist

- Legal opinion received from Arusha Naidoo — confirm before flipping
  balanceSave / riskProfileModule feature flags on in production
- RevenueCat products configured in App Store Connect + Play Console and
  mirrored in a RevenueCat Offering
- PayFast merchant account moved from sandbox to live credentials
- Backend deployed with a real Postgres instance in af-south-1 or
  equivalent SA-region hosting
- Privacy policy and terms of service URLs added to app.json and both
  store listings (required by both Apple and Google)
- App Store screenshots and Play Store feature graphic prepared
- TestFlight / Play internal testing round completed on real devices
