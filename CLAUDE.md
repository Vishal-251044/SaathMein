# CLAUDE.md

This file tells Claude how to work on SaathMein. Read it fully before writing any code, and follow every rule below in every session.

---

## 1. Project Overview

- **Project:** SaathMein — a group-buying marketplace for India ("Buy together. Save together."). Launch city: Pune.
- **Owner:** Vishal Chavan (founder, product owner, solo developer)
- **What it does:** Buyers who want the same product in the same city join one group by paying a small refundable token. When the group is full, verified dealers bid in a live reverse auction — the lowest all-inclusive price wins and the whole group buys from that dealer. Sellers can also publish tiered group deals. An AI layer (Saathi) helps buyers decide and sellers price.
- **Goal:** A real company launch, not a demo. Follow production-quality structure, security and payment practices — no tutorial shortcuts.

### Apps in this repository

| Folder     | App                                   | Stack                                                                 |
|------------|---------------------------------------|-----------------------------------------------------------------------|
| `mobile/`  | Buyer app (Android first, iOS later)  | React Native + Expo (TypeScript), Expo Router, NativeWind, Zustand, TanStack Query |
| `web/`     | Dealer dashboard (`/seller`) + Owner/Admin Console (`/admin`) | Next.js (App Router) + Tailwind CSS                       |
| `backend/` | REST API, sockets, workers            | Node.js + Express, MongoDB Atlas + Mongoose, Redis (Upstash) + BullMQ, Socket.io |

### External services

Razorpay (Checkout, Refunds, Route transfers with hold, webhooks) · Firebase (phone OTP, Cloud Messaging) · Cloudinary (images, KYC docs, invoices) · Claude API (LLM, vision, tool calling) + an embedding model · Sentry · Resend/SMTP · EAS Build + Google Play Console · Render/Railway (API, workers) · Vercel (web).

---

## 2. Documentation First (VERY IMPORTANT)

All planning documents live in the `Doc/` folder at the project root:

```
Doc/
├── SaathMein_PRD_BRD_v1.0.pdf          # What we build and why — the source of truth
├── SaathMein_20_Day_Roadmap_v1.0.pdf   # Day-by-day build plan (Days 1–20)
├── SaathMein_Roadmap_Progress.md       # Task checklist we tick off as we build
└── saathmein-logo.svg                  # Brand mark
```

> The PDFs cannot be edited and the Read tool cannot render them on this machine. Extract text with `pdftotext -layout <file>.pdf <out>.txt` (Git Bash). Python is broken on this machine — do not rely on it.

**Rules:**

1. **Before starting any feature, read the relevant sections of the PRD and that day in the roadmap.** Every feature must match the PRD (requirement IDs like `GRP-3`, `PAY-4`, `AUC-5`).
2. **Build in the order of the 20-Day Roadmap.** Do not jump ahead to later days unless I ask.
3. **After finishing a task, update `Doc/SaathMein_Roadmap_Progress.md`** — mark the task `[x]` and add a short note under the day if something important happened (decision taken, item pending, item moved to another day).
   - Do NOT change the PDFs. Do NOT rewrite other content in the progress file.
4. If a request conflicts with the PRD, or something is missing or unclear, **stop and ask me** before building. Do not guess. Known open questions are in section 13.
5. Use the requirement IDs from the PRD in commit messages and comments where useful (e.g. `feat(payments): token order + signature verify (PAY-1)`).

---

## 3. Git & GitHub Rules (STRICT)

- ❌ **NEVER run `git push` without my explicit permission.**
- ❌ Never force push, never rewrite history, never delete branches without asking.
- ✅ You may run `git status`, `git diff`, `git add`, and `git commit` locally when it helps.
- ✅ Before pushing, show me a summary (branch, commits, changed files) and **wait for me to say "yes, push"**.
- Branches: `main` (release) and `dev` (daily work). Work on `dev` or a feature branch, never commit directly on `main`.
- Commit messages: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:` with a scope, e.g. `feat(auction): atomic lowest-bid update`.
- Never commit `.env` files, secrets, keystores, `google-services.json` with real keys, or `node_modules`.

---

## 4. Environment Variables (.env)

Whenever a feature needs an external connection or secret:

1. **Add the variable to the correct env file with a placeholder value.**
2. **Also add it to that folder's `.env.example`** (same keys, no real values).
3. **Tell me clearly in your reply** which variable was added, in which file, and that I must put my real value there.
4. Never hardcode secrets, URLs, keys or fee amounts in code. Secrets come from env; business values (fees, tokens, auction rules) come from the `settings` / `categories` collections (admin-editable).
5. Never invent or fill in real credentials. Use Razorpay **test** keys in development; live keys only in production secrets.
6. Maintain `.gitignore` in the root, `mobile/`, `web/` and `backend/` — it must cover `.env*` (except `.env.example`), `node_modules/`, `.next/`, `.expo/`, `dist/`, `build/`, `android/`, `ios/` (Expo prebuild output), `*.keystore`, `*.jks`, logs, coverage, and OS files (`.DS_Store`, `Thumbs.db`).

### Backend — `backend/.env`

```env
# ===== Server =====
PORT=5000
NODE_ENV=development
API_BASE_URL=http://localhost:5000
CORS_ORIGINS=http://localhost:3000,http://localhost:8081

# ===== Database (MongoDB Atlas — replica set so transactions work) =====
MONGODB_URI=your_mongodb_atlas_connection_string_here

# ===== Redis (Upstash) — BullMQ, cache, rate limits, socket adapter =====
REDIS_URL=your_redis_url_here

# ===== Buyer / seller auth =====
JWT_ACCESS_SECRET=your_long_random_access_secret_here
JWT_REFRESH_SECRET=your_long_random_refresh_secret_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# ===== Staff (admin console) auth — separate secrets =====
STAFF_JWT_ACCESS_SECRET=your_staff_access_secret_here
STAFF_JWT_REFRESH_SECRET=your_staff_refresh_secret_here
STAFF_JWT_ACCESS_EXPIRES_IN=15m
STAFF_JWT_REFRESH_EXPIRES_IN=8h

# ===== Owner account (used only by `npm run create-owner`) =====
OWNER_EMAIL=your_owner_email_here
OWNER_PASSWORD=your_strong_owner_password_here
OWNER_NAME=Vishal Chavan

# ===== Firebase Admin (verify phone OTP ID tokens, send FCM) =====
FIREBASE_PROJECT_ID=your_firebase_project_id_here
FIREBASE_CLIENT_EMAIL=your_firebase_client_email_here
FIREBASE_PRIVATE_KEY=your_firebase_private_key_here

# ===== Razorpay =====
RAZORPAY_KEY_ID=your_razorpay_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret_here

# ===== Cloudinary =====
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name_here
CLOUDINARY_API_KEY=your_cloudinary_api_key_here
CLOUDINARY_API_SECRET=your_cloudinary_api_secret_here

# ===== AI (needed from Day 15) =====
ANTHROPIC_API_KEY=your_anthropic_api_key_here
EMBEDDING_API_KEY=your_embedding_provider_key_here

# ===== Email =====
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM=SaathMein <no-reply@your-domain>

# ===== Monitoring =====
SENTRY_DSN=your_backend_sentry_dsn_here
```

### Mobile — `mobile/.env`

```env
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:5000/api
EXPO_PUBLIC_SOCKET_URL=http://<your-lan-ip>:5000
EXPO_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id_here
EXPO_PUBLIC_SENTRY_DSN=your_mobile_sentry_dsn_here
```

> `EXPO_PUBLIC_*` values are bundled into the app and visible to anyone — **never** put secrets there (the Razorpay key **id** is public; the key **secret** is not). Firebase Android config goes in `google-services.json` (gitignored, referenced from `app.config.ts`). Use the LAN IP, not `localhost`, when testing on a real phone.

### Web — `web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_SENTRY_DSN=your_web_sentry_dsn_here
```

> Only `NEXT_PUBLIC_*` variables reach the browser. Never put secrets in them.

**Format for telling me about new env variables:**

> ⚠️ **Action needed:** I added `RAZORPAY_WEBHOOK_SECRET` to `backend/.env`. Please replace the placeholder with the webhook secret from your Razorpay dashboard.

---

## 5. Backend Folder Structure (Node.js + Express)

```
backend/
├── server.js                     # Entry: load config, connect Mongo + Redis, start HTTP + Socket.io
├── worker.js                     # Entry for BullMQ workers (run as a separate process)
├── package.json
├── .env / .env.example
├── tests/                        # Unit + integration tests (mirror src/ structure)
└── src/
    ├── app.js                    # Express app: helmet, cors, json limits, routes, error handler
    ├── config/                   # env loader (validated with Zod), db.js, redis.js, firebase.js, razorpay.js, cloudinary.js
    ├── constants/                # Enums: group statuses, roles, ledger types, socket events
    ├── routes/                   # URL → middlewares → controller. No logic.
    │   ├── index.js              # Mounts everything under /api
    │   ├── auth.routes.js  user.routes.js  catalog.routes.js  group.routes.js
    │   ├── payment.routes.js  purchase.routes.js  seller.routes.js  ai.routes.js
    │   └── admin/                # admin.*.routes.js (one file per console module)
    ├── controllers/              # Read req, call service, send ApiResponse. Thin.
    ├── services/                 # All business logic and DB access
    │   ├── groups/               # group.service.js, stateMachine.js, matching.js, waitlist.service.js
    │   ├── auction/              # auction.service.js, bid.service.js, auctionClose.service.js
    │   ├── payments/             # razorpay.service.js, ledger.service.js, refund.service.js, route.service.js, webhook.service.js, reconciliation.service.js
    │   ├── ai/                   # providers/ (LLMProvider, VisionProvider, EmbeddingProvider), saathi/, analyzer/, predictor/, embeddings/, vision/, trust/
    │   └── *.service.js          # auth, user, catalog, seller, purchase, review, dispute, notification, audit ...
    ├── models/                   # Mongoose schemas only: <name>.model.js
    ├── middlewares/              # auth (requireAuth, requireRole), staffAuth (requireStaff), rateLimit, validate, audit, error
    ├── validators/               # Zod schemas per feature: <feature>.validator.js
    ├── sockets/                  # Socket.io gateway, JWT auth, room handlers, event emitters
    ├── jobs/                     # BullMQ queues + processors: deadlines, auctionClose, refunds, routeHolds, reconciliation, aiJobs
    ├── scripts/                  # create-owner.js, seed-categories.js, seed-cities.js, import-products.js
    ├── utils/                    # logger.js (pino), ApiError.js, ApiResponse.js, asyncHandler.js, money.js
    └── helpers/                  # genericFunctions.js (pagination, slugify, etc.)
```

**Layer responsibilities:** `routes` map URLs · `controllers` stay thin · `services` hold logic and DB queries · `models` are schema only · `middlewares` handle cross-cutting concerns · `utils` / `helpers` are stateless.

**Naming:** `<feature>.<layer>.js` → `group.controller.js`, `group.service.js`, `group.model.js`, `group.validator.js`.

**API standards:**

- All routes under `/api` (see PRD §12.3 for the endpoint list). Admin routes under `/api/admin/*`, seller routes under `/api/seller/*`.
- Proper HTTP methods and status codes (200, 201, 400, 401, 403, 404, 409, 422, 429, 500).
- Same response format everywhere:

```json
{ "success": true, "message": "Group fetched", "data": { } }
{ "success": false, "message": "Bid must be at least ₹200 below the current lowest", "error": { "code": "BID_TOO_HIGH" } }
```

- Validate every request body, query and params with Zod via `validate.middleware.js`.
- One central error middleware; wrap every async controller with `asyncHandler`.
- Paginate every list endpoint with the shared pagination helper.

---

## 6. Mobile Folder Structure (React Native + Expo, TypeScript)

```
mobile/
├── app.config.ts                 # Expo config (reads env), App Links, plugins
├── eas.json                      # development / preview / production profiles
├── package.json
├── .env / .env.example
└── src/
    ├── app/                      # Expo Router screens
    │   ├── _layout.tsx           # Providers: Query, theme, i18n, auth gate, Sentry
    │   ├── (auth)/               # phone.tsx, otp.tsx, language.tsx
    │   ├── onboarding/           # city.tsx, interests.tsx
    │   ├── (tabs)/               # home.tsx, search.tsx, groups.tsx, saathi.tsx, profile.tsx
    │   ├── group/[id].tsx        # Group page: counter, auction/tiers, chat, share
    │   ├── product/[id].tsx
    │   ├── pay/                  # Token checkout + result
    │   └── g/[code].tsx          # Deep-link entry for shared groups
    ├── components/
    │   ├── ui/                   # Button, Input, Sheet, Card, Chip, Skeleton, Avatar ...
    │   ├── layout/               # Screen, Header, TabBar, SafeArea wrappers
    │   ├── animations/           # FadeIn, SlideUp, Stagger, Confetti (Reanimated)
    │   └── features/             # PeopleCounter, SavingsMeter, AuctionCard, DealCodeTicket, SaathiButton ...
    ├── services/                 # API calls, one file per feature (api.ts = axios client + interceptors)
    ├── hooks/                    # useAuth, useGroupSocket, useCountdown ...
    ├── stores/                   # Zustand stores (auth, settings)
    ├── lib/                      # socket.ts, razorpay.ts, notifications.ts, sentry.ts
    ├── i18n/                     # en.json, hi.json, mr.json + setup
    ├── theme/                    # tokens.ts (colors, spacing, radius, shadows, fonts)
    ├── types/                    # Shared TypeScript types
    └── utils/                    # constants.ts, animations.ts, format.ts (₹, dates), genericFunctions.ts
```

**Mobile rules:**

- Never call `axios`/`fetch` inside components — always go through `src/services/`, wrapped in TanStack Query hooks.
- Server data lives in TanStack Query; only client/UI state goes in Zustand.
- Tokens live in `expo-secure-store` only — never AsyncStorage.
- **No hardcoded user-facing strings.** Every string goes through i18next with keys in `en`, `hi` and `mr`.
- Razorpay SDK is a native module: it needs an **EAS development build**, it does not work in Expo Go.
- Component files use PascalCase (`GroupCard.tsx`); hooks use `useX.ts`.
- Always handle **loading** (skeletons), **error** (retry), **empty** and **offline** states.
- Live screens subscribe to the group's Socket.io room and fall back to polling if the socket drops.

---

## 7. Web Folder Structure (Next.js App Router — Dealer + Admin)

```
web/
├── next.config.js
├── package.json
├── .env.local / .env.example
└── src/
    ├── app/
    │   ├── layout.js  page.js            # Public landing page
    │   ├── seller/                       # Dealer dashboard
    │   │   ├── (auth)/login, register
    │   │   └── home, auctions, upcoming, won, deals, purchases, payouts, insights, team, profile
    │   ├── admin/                        # Owner / Admin Console (not linked from public pages)
    │   │   ├── login/                    # email + password, then TOTP 2FA step
    │   │   └── dashboard, monitor/*, catalog, groups, auctions, sellers, buyers, payments,
    │   │       commissions, disputes, curation, ai, settings, team, audit
    │   └── legal/                        # terms, privacy, refund-policy, grievance-officer
    ├── components/  ui/ layout/ animations/ features/
    ├── services/                         # API calls (api.js base client; seller.*.js, admin.*.js)
    ├── hooks/  context/  lib/  styles/  utils/
```

**Web rules:**

- Never call `fetch`/`axios` inside components — use `src/services/`.
- `/seller/*` and `/admin/*` have separate layouts, separate sessions and separate route guards. Admin pages hide anything the staff role cannot use, **and** the API enforces it (UI hiding is never the security).
- Dealers mostly use laptops; the admin console is desktop-first but must still be usable on a phone (the Owner checks monitors on the go). The **buyer** experience is mobile-first.
- Every admin table supports filters (city, category, date) and CSV export (MON-1).

---

## 8. Money, Auctions & Security — NON-NEGOTIABLE

People pay real money here. These rules override speed.

### Money
1. **Store all money as integer paise** (`amountPaise: 99900` = ₹999). Never floats. Format only at the UI edge with the shared `formatINR` helper.
2. **The amount is never trusted from the client.** The server computes it from category/settings and creates the Razorpay order.
3. Verify `razorpay_signature` (HMAC-SHA256 of `order_id|payment_id` with the key secret) on `/payments/verify`. Verify the webhook signature with the **webhook secret** (a different secret).
4. **Webhooks are the source of truth** and must be idempotent: store the event id, never process the same event twice.
5. Join group = payment record + member + `memberCount` update in **one MongoDB transaction** (PAY-2).
6. Every money movement writes an **append-only ledger** entry (`token_held`, `refund`, `transfer`, `hold_release`, `commission`, `fee`, `wallet`). Never update or delete ledger rows — correct with a new entry.
7. Route transfers to dealers are created **on hold** when an auction is won, released only when that member's purchase is confirmed, reversed if the member exits or the dealer backs out (PAY-4).
8. **No money change ships without tests** covering success, failure, duplicate webhook and every refund path.
9. Any admin money action (manual refund, release/reverse hold) requires a reason note and writes to the audit log.

### Groups & auctions
1. All group status changes go through `services/groups/stateMachine.js` with guarded transitions. Nothing else may set `group.status`.
2. Statuses: `open → full → auction_live → won → purchasing → completed`, plus `runner_up`, `expired`, `no_deal`, `cancelled`.
3. Bids are validated inside a transaction (below ceiling, beats lowest by the minimum step, breakdown totals match, dealer eligible). The lowest price is updated **atomically** so two simultaneous bids cannot both win.
4. Bids are **append-only** — no edits, no deletes, no raising, no withdrawing.
5. Auction close runs **exactly once** (job lock). Lowest wins; earliest bid wins a tie. Anti-sniping, minimum-dealers and runner-up rules per PRD §10.5.
6. Dealers never see other dealers' names or prices except the current lowest; buyers see the falling price.
7. Auction rules (duration, min step, anti-sniping, min dealers) come from category/settings — never hardcoded.

### Security & privacy
- Buyer/seller JWT: access 15 min, refresh 30 days with rotation. Staff JWT is separate: access 15 min, refresh 8 h, 30 min idle logout, mandatory TOTP 2FA, lockout after repeated failures.
- The **one Owner account** is created only by `npm run create-owner`. No public sign-up for staff; staff are invited.
- `requireRole` / `requireStaff(role)` on every protected route, with permission tests (e.g. Support gets 403 on Payments, Settings, Team).
- Every staff write is recorded in `auditLogs` (who, what, before/after, time, IP).
- Helmet, CORS whitelist, JSON size limits, rate limits (OTP: 3 per 10 min per number), Zod validation everywhere.
- Phone numbers are never shown to other members or sellers before acceptance; groups show first names only.
- KYC documents and invoices use **signed, private** Cloudinary uploads.

---

## 9. AI Rules (Sprint 2, Days 15–20)

- Every AI call goes through `services/ai/providers/` interfaces (`LLMProvider`, `VisionProvider`, `EmbeddingProvider`) so the model can be switched without touching features (AIP-1).
- Primary LLM: Claude API. Model name comes from config/admin settings — never hardcoded in feature code.
- Prompt templates are versioned in config. Every call logs user, feature, model, tokens, cost (₹), latency and prompt version to `aiUsage`.
- Per-user and per-feature quotas; cache repeated answers in Redis.
- **AI never moves money, joins a group or bans a user.** It suggests; the user or staff confirms (state-changing actions open a confirm screen).
- Answers are grounded in SaathMein data — prices and offers always come from the database, never invented. Graceful fallback when AI is unavailable.

---

## 10. Responsive & Mobile-First Design (TOP PRIORITY)

**The buyer app is the product.** Design for a mid-range Android phone first.

1. Mobile app must work on **Android 8+** and **360 dp** wide screens, and scale up to 430 dp and tablets.
2. Touch targets at least **48 dp** (PRD §14).
3. Respect safe areas (`react-native-safe-area-context`), the keyboard (`KeyboardAvoidingView`), and the Android back button.
4. Native patterns: bottom tab bar, bottom sheets instead of big modals, pull-to-refresh, swipeable carousels.
5. Low-data images (Cloudinary transforms with the right size), cached screens for offline use.
6. Hindi and Marathi text is often longer than English — layouts must not break or truncate key info (prices, deal codes). Use Noto Sans Devanagari for those languages.
7. Performance targets: cold start under 2.5 s on a mid-range Android, live counter updates under 1 s.
8. **Web** (seller/admin, Tailwind, mobile-first breakpoints): check 360, 390, 430, 768, 1024, 1440 and 1920 px. No horizontal scroll except intentional carousels/tables (tables scroll inside their own container). Touch targets at least 44×44 px.

---

## 11. UI Design & Animation — "Sunrise" Theme

SaathMein should feel like the best modern Indian consumer apps: bright, confident and friendly, but also **safe**, because people pay money here. It must **not** look generic or AI-generated.

### Brand tokens (define once in `mobile/src/theme/tokens.ts` and `web/src/styles/`, use everywhere)

| Token              | Light (default)                          | Dark                 | Use for |
|--------------------|------------------------------------------|----------------------|---------|
| primary (Sunrise)  | gradient `#FF8A1F → #FF4D5E → #B43CF5` (solid fallback `#FF5A3C`) | same | Logo, Join and Pay buttons, hero cards, live counters, active tab |
| background         | `#FFFFFF` / `#F7F5F1` (warm grey bands)  | `#12131F`            | App background, section bands |
| surface / card     | `#FFFFFF` + soft shadow                  | `#1C1D2B`            | Group cards, sheets, offer cards |
| success / savings  | `#10B981`                                | `#34D399`            | **Only** for money saved, refunds done, tiers unlocked |
| ai                 | `#7C5CFF → #B43CF5`                      | `#9B85FF`            | **Only** for AI: Saathi, predictor, analyzer |
| warning / danger   | `#F59E0B` / `#EF4444`                    | `#FBBF24` / `#F87171`| Deadline soon, payment failed, disputes |
| text / muted       | `#12131F` / `#6B7085`                    | `#F4F4F8` / `#A3A7B8`| Body and secondary text |
| shape              | 20 px cards · 14 px buttons · pill chips | same                 | |
| fonts              | Plus Jakarta Sans (UI) · JetBrains Mono (deal codes, prices in tickets) · Noto Sans Devanagari (hi, mr) | | |

- Light mode is the default (readable outdoors at showrooms); full dark mode support.
- Colour meaning is strict: **mint = money saved, violet = AI**. Never use them for anything else.
- Logo: `Doc/saathmein-logo.svg` (three people above a smile). Lowercase wordmark **saathmein**.

### Signature UI elements
- **People counter:** row of avatars filling up ("14 of 20") with a Sunrise progress bar on every group card.
- **Savings meter:** ring that fills mint as tiers unlock, with a small confetti burst on unlock.
- **Saathi glow:** soft violet gradient on AI cards and the Saathi button.
- **Deal-code ticket:** ticket-style card with QR, seller and price, like a festival pass.
- **Live auction card:** falling price with a "new lowest price" animation and "₹X saved so far".

### Icons (STRICT)
- ❌ **NEVER use emoji in the UI** (buttons, headings, labels, empty states, toasts, push notifications).
- ✅ Use **Lucide** everywhere: `lucide-react-native` in mobile, `lucide-react` in web. Consistent size and stroke width; `accessibilityLabel` / `aria-label` on icon-only buttons.

### Animations
- **Mobile:** `react-native-reanimated` (+ `react-native-gesture-handler` for sheets/swipes). **Web:** Framer Motion.
- Animate meaningfully: screen transitions, staggered list entrance, press feedback (scale), counter ticks, tier unlock confetti, auction price drop, bottom sheets, skeleton shimmer.
- Shared variants, durations and easings live in `utils/animations.(ts|js)`; reusable wrappers in `components/animations/`. No copy-pasted animation code.
- 60 fps: animate `transform` and `opacity` only. Keep it fast and subtle (150–400 ms).
- Respect reduced motion (`useReducedMotion` in Reanimated, `prefers-reduced-motion` on web).
- Money screens (pay, refund, deal code) stay calm: clarity first, decoration second.

### Approved libraries (no need to ask)
Mobile: Expo SDK modules, Expo Router, NativeWind, Reanimated, Gesture Handler, Zustand, TanStack Query, axios, i18next/react-i18next, expo-secure-store, socket.io-client, react-native-razorpay, lucide-react-native, react-native-svg.
Web: Tailwind CSS, Framer Motion, lucide-react, clsx, tailwind-merge, axios, socket.io-client, TanStack Query.
Backend: express, mongoose, zod, pino, helmet, cors, express-rate-limit, jsonwebtoken, bcrypt, otplib, firebase-admin, razorpay, cloudinary, bullmq, ioredis, socket.io + redis adapter, @anthropic-ai/sdk, jest + supertest.

**Ask me before adding any other major library** or changing the stack.

---

## 12. Code Quality, Comments, Testing & Debugging

### Comments
- Short header comment at the top of every file explaining what it does.
- JSDoc (backend/web) or TSDoc (mobile) above every exported function: purpose, params, return, throws.
- Inline comments for non-obvious logic — especially money math, state transitions and auction rules (cite the PRD ID).

```js
/**
 * Place a dealer bid in a live auction (AUC-4).
 * @param {string} groupId - Group in auction_live status
 * @param {string} sellerId - Verified dealer who has joined the auction
 * @param {Object} bid - pricePerUnitPaise + breakdown
 * @returns {Promise<Object>} The saved bid and the dealer's new rank
 * @throws {ApiError} 409 if the bid does not beat the current lowest by the minimum step
 */
```

### Generic / reusable functions
Do not repeat logic. Shared helpers live in `backend/src/helpers/genericFunctions.js` + `backend/src/utils/`, `web/src/utils/genericFunctions.js`, `mobile/src/utils/genericFunctions.ts`. Examples: pagination, response builders, `formatINR` / paise conversion, date and countdown formatting, slugify, phone masking, deal-code generation. **Check for an existing helper before writing a new one.**

### Debugging
- Use the central logger (pino in backend) — no stray `console.log`.
- Log with context: `[PaymentService] verify failed orderId=... userId=...` — never log OTPs, tokens, secrets, card/UPI details or full phone numbers.
- Clear error messages that say **what** failed and **where**; `try/catch` around every external call (Razorpay, Firebase, Cloudinary, Claude API, Redis).
- Sentry in all three apps.

### Testing
- Unit tests for the group state machine, auction rules, payments/refunds/ledger and commission math are **required**.
- API integration tests with supertest for main flows; permission-matrix tests for admin routes.
- ESLint + Prettier in every app. CI on GitHub Actions (lint + tests on every PR).

### File size limit (STRICT)
- ❌ **No code file may exceed 2,000 lines.** Split around ~1,500 lines by responsibility. Prefer many small, focused files.

---

## 13. Open Questions — Ask Before Building the Affected Feature

These are not decided in the PRD. When a task touches one, stop and ask me (and record the answer in the progress file).

1. **Token at the showroom:** is the token adjusted against the final bill at the dealer? (affects deal code, money timeline, Route transfer — Days 7, 9, 10)
2. **New dealers with no rating:** the ≥3.5 rating rule blocks unrated dealers from auctions — allow verified unrated dealers? (Day 9)
3. **Buyer convenience fee:** charged with the token or at purchase completion? (Days 7, 10)
4. **Seller-led deal that misses its first tier at expiry:** refund all, or buy at base price? (Day 9)
5. **Auction started early at ≥70% fill:** do tiers/ceilings change for the smaller group? (Days 6, 9)
6. **Launch categories:** PRD suggests two-wheelers + mobiles first (Q1).
7. **Commission for cars:** flat vs % (Q4). Show offers to non-members? (Q5)
8. **Play Console account type:** personal (needs 12+ testers × 14 days closed test) vs organisation (Q9). Production by Day 14 is only realistic on the testing track.
9. Legal: token structure, refund policy and grievance officer confirmed with a CA/lawyer before live payments.

Other PRD open questions (Q2–Q11) use the "Suggested" column as the working default unless I say otherwise.

---

## 14. Workflow Checklist (every task)

1. Read the relevant PRD section and the current day in the roadmap; check `Doc/SaathMein_Roadmap_Progress.md`.
2. Confirm the task fits the current roadmap day. Check section 13 for open questions it touches.
3. Backend first, then mobile screens, then web, then tests (roadmap daily order).
4. Put code in the right folder (sections 5–7); reuse existing helpers.
5. Add env variables with placeholders to `.env` + `.env.example` and **tell me which ones to fill**.
6. UI work: mobile-first, Sunrise tokens, Lucide icons (no emoji), animations, i18n keys in en/hi/mr, loading/error/empty states.
7. Money/auction work: section 8 rules + tests.
8. Comments added; every file under 2,000 lines.
9. Update `Doc/SaathMein_Roadmap_Progress.md` (tick tasks, short notes only).
10. Commit locally if useful — **do NOT push without my permission.**
11. Reply with a short summary: what was built, files changed, env variables I need to fill, how to verify the day's "Done when", and the next roadmap step.

---

## 15. When in Doubt

Ask me before:

- Pushing to GitHub
- Adding a major new library or changing the tech stack
- Changing the folder structure
- Deleting files or large amounts of code
- Building something not described in the PRD, or deciding anything in section 13
- Switching Razorpay to live keys or touching production data
