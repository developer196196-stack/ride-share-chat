# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm run api-nest` — NestJS API (`artifacts/api-nest`; port 5001 locally, 8080 on Replit). Swagger UI at `/api/docs`.
- `pnpm run test` — unit tests (Trip Validation Engine + on-device vibration analyzer)
- `pnpm run e2e` — end-to-end smoke test against a running API and the real Firebase/Redis/LiveKit/Google services (start the API with `VALIDATION_ALLOW_SIMULATED=true`; creates and deletes two temporary users)
- `pnpm run check` — typecheck libs + mobile + API; `pnpm run check:api` also builds the API
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm run codegen` — regenerate React Query hooks (`lib/api-client-react`) and Zod schemas (`lib/api-zod`) from `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only; `lib/db` is currently unused)

### Mobile app (`artifacts/mobile`, Expo)

- `pnpm run mobile` — local Expo dev server on port 8081 (`pnpm run mobile:clear` to reset Metro cache)
- `pnpm --filter @workspace/mobile run dev` — Replit workflow entry (`scripts/dev.js`, port 18115)
- `pnpm run check:mobile` — typecheck the mobile app
- `pnpm run build:apk` / `pnpm run build:ios` — EAS preview builds (run `eas init` in `artifacts/mobile` once to link an Expo project)
- The app opens on the splash screen. Set `EXPO_PUBLIC_SHOW_SLEEK_SCREENS=true` (dev only) to open on the Sleek screen catalogue instead.
- Live: Authentication (4), Profile Setup (5), Rideshare Connect (6, platform picker), Permissions (7), Trip Validation (8), Vibe Selection (9), Active R.O.O.M. (10: LiveKit video + translated chat), Ride Summary (11), Traffic Grace (12), Fast-Track / Next (13), Connections ride history (14), Settings (15), plus Language & Translation and Safety & Trusted Contacts.
- Video, sensors and in-vehicle detection need a development build (`eas build --profile development`); Expo Go and web fall back to avatar tiles and no OS activity.
- Dev ride simulator: `EXPO_PUBLIC_ALLOW_SIMULATED_RIDE=true` (app) + `VALIDATION_ALLOW_SIMULATED=true` (API).

### Environment variables

Templates: `artifacts/api-nest/env.template` and `artifacts/mobile/env.template` — copy each to `.env` locally. On Replit use the Secrets panel.

| Name | Used by | Purpose |
|------|---------|---------|
| `FIREBASE_PROJECT_ID` | api-nest | Admin SDK project |
| `FIREBASE_CLIENT_EMAIL` | api-nest | Service-account email |
| `FIREBASE_PRIVATE_KEY` | api-nest | Service-account key (one line, `\n` escapes) |
| `FIREBASE_STORAGE_BUCKET` | api-nest | Optional; defaults to `<project>.firebasestorage.app` |
| `REDIS_URL` | api-nest | Realtime state, matchmaking, chat history (Upstash `rediss://…` or local `redis://localhost:6379`) |
| `GOOGLE_ROADS_API_KEY` | api-nest | Trip Validation Module 3 road matching (Snap to Roads) |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | api-nest | Video R.O.O.M.s |
| `PUBLIC_BASE_URL` | api-nest | Optional origin for share links (defaults to request host) |
| `VALIDATION_ALLOW_SIMULATED` | api-nest | Optional, dev only: accept simulated rides |
| `VALIDATION_*` thresholds | api-nest | Optional engine tuning (entry/grace speed, scores, weights, spoof checks). Unset = production defaults; see `artifacts/api-nest/env.template` for the desk-testing preset |
| `CORS_ORIGINS`, `SWAGGER_ENABLED` | api-nest | Optional |
| `EXPO_PUBLIC_API_URL` | mobile | Local API URL (not needed on Replit) |
| `EXPO_PUBLIC_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_MESSAGING_SENDER_ID` / `_APP_ID` | mobile | Firebase web app config for phone sign-in |
| `EXPO_PUBLIC_OTP_RESEND_SECONDS` | mobile | Optional resend cooldown (default 60) |
| `EXPO_PUBLIC_SHOW_SLEEK_SCREENS` | mobile | Optional, dev only: open on the screen catalogue |
| `EXPO_PUBLIC_ALLOW_SIMULATED_RIDE` | mobile | Optional, dev only: ride simulator on Trip Validation |

Google Cloud Translation uses the same Firebase service account (role **Cloud Translation API User**), so it needs no extra variable.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: NestJS 11 (`artifacts/api-nest`) with Firebase Admin (Auth, Firestore, Storage) via `lib/firebase`; Socket.IO gateway at `/api/v1/room/stream`; Redis (ioredis); LiveKit server SDK; Google Cloud Translation v3; Google Roads API
- Mobile: Expo SDK 57 + Expo Router, TanStack Query, Zustand, React Hook Form + Zod, Firebase JS SDK (phone auth)
- Validation: Zod — request bodies validated in Nest with the generated `@workspace/api-zod` schemas
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth); run `pnpm run codegen` after editing.
- `artifacts/api-nest/src/auth` — bootstrap / me / profile / photo-upload endpoints; Firestore `users/{uid}`, Storage `users/{uid}/avatar/*`.
- `artifacts/api-nest/src/validation` — Trip Validation Engine: pure scoring/state machine (`validation.engine.ts`, tuned in `validation.config.ts`), Redis persistence + grace sweeper (`validation.service.ts`), Google Roads matcher.
- `artifacts/api-nest/src/rooms` — R.O.O.M. matchmaking (Redis), Next + 60-min blocks, LiveKit tokens, ride summaries (`users/{uid}/rides`); `src/chat` — chat + translation; `src/safety` — share links, public page `/api/share/:token`, alerts, reports; `src/realtime` — WebSocket gateway.
- `artifacts/mobile/lib/telemetry` — GPS/accelerometer/activity collector, on-device FFT, dev simulator; `modules/activity-recognition` — native in-vehicle detection (Kotlin + Swift).
- `artifacts/mobile/lib/firebase`, `components/firebase` — Firebase client + reCAPTCHA verifier (WebView on native, widget on web); `hooks/use-firebase-phone-auth.ts`.
- `artifacts/mobile` — Expo Router app (Expo SDK 57, RN 0.86). Screens in `app/rider/{onboarding,room,account}`, registry in `screens.json`.
- `artifacts/mobile/constants` — design tokens from the Sleek `:root` (colors, typography, radius/shadow), Iconify SVG registry (`icons.ts`), routes.
- `artifacts/mobile/components/ui` — shared primitives (Screen, Button, Pill, Card, Toggle, Icon, animations); `components/rideshare` — app-specific pieces.
- `sleek-temp-ref/` — Sleek HTML/Tailwind reference screens (gitignored).

## Architecture decisions

- Mobile never talks to Firestore/Storage directly: it signs in with Firebase Auth, then calls api-nest with the ID token (`Authorization: Bearer`). Nest verifies it with the Admin SDK.
- Phone OTP works in Expo Go (no native Firebase module): native gets a reCAPTCHA token from a WebView and calls Identity Toolkit REST; web uses `RecaptchaVerifier`. Same approach as floaters-app.
- Avatars upload through short-lived signed Storage URLs from `POST /v1/auth/me/photo-upload`; the profile stores the object path, and `photoUrl` is re-signed on each read.
- The old Express `api-server` template was replaced by `api-nest` (same Replit artifact id).
- The server decides validation state: the phone sends sensor summaries only; scoring, GRACE timers and termination run in api-nest (a module with no data counts as a neutral 50, so GPS alone can never verify).
- Chat goes through our WebSocket (not LiveKit data) so it can be translated once per language, moderated and attached to reports.
- Safety messages open the rider's own SMS/WhatsApp/email app pre-filled (no Twilio in phase one).

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `nodeLinker: hoisted` in `pnpm-workspace.yaml` is required for React Native Gradle builds — don't remove it.
- The mobile app pins React 19.2.3 (Expo 57) while web artifacts use the catalog React; `metro.config.js` forces a single React copy for the app.
- Don't set `CI=1` for the mobile dev workflow — it hides Replit's native preview options.
- Firebase console: enable **Phone** sign-in, add your dev hosts (e.g. `localhost`, `127.0.0.1`) under Authentication → Authorized domains, and allow your SMS regions. Use test phone numbers while developing to avoid SMS quota.
- Web profile-photo uploads PUT directly to Storage, so the bucket needs a CORS rule allowing `PUT` from the web origin (native apps don't need it).
- `lib/firebase` and `lib/api-zod` must be built (CJS) before Nest runs — the api-nest `predev`/`prebuild`/`pretypecheck` scripts do it.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
