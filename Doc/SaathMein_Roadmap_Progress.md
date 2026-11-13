# SaathMein — Roadmap Progress

Task checklist for `SaathMein_20_Day_Roadmap_v1.0.pdf`. Tick `[x]` when a task is done; add short notes under the day (decisions, pending items, moved tasks). Do not change task wording.

Planned dates: Day 1 = Mon 26 Oct 2026 · v1.0 = Sun 8 Nov · v1.1 = Sat 14 Nov 2026.

---

## Set Up Before Day 1

- [ ] MongoDB Atlas cluster (replica set, transactions), DB user, network access, Vector Search tier
- [ ] Upstash Redis
- [ ] Firebase project: Phone Auth + Cloud Messaging, Android app + SHA keys
- [ ] Razorpay test mode; submit business KYC for live; request Route activation
- [ ] Cloudinary account + upload presets (avatars, products, KYC private, invoices, share cards)
- [ ] Expo account + EAS CLI
- [ ] Google Play Console developer account
- [ ] Claude API key + embedding model key (needed by Day 15)
- [ ] Hosting: Render/Railway, Vercel, domain for deep links and emails
- [ ] Email: Resend or SMTP
- [ ] Sentry projects (React Native, Next.js, API)
- [ ] Authenticator app on Owner's phone
- [ ] Three Android test phones with UPI apps
- [ ] List of 15 Pune two-wheeler + mobile sellers; aim for 5 signed by Day 9
- [ ] CA / lawyer: token structure, terms, refund policy, grievance officer

---

## Sprint 1 — Core Marketplace (Days 1–14)

### Day 1 — Foundation & Project Setup (Mon 26 Oct)
**Done when:** the app runs on an Android phone with tabs and the Sunrise theme; `/api/health` returns DB "connected"; the seller/admin web app runs locally.

- [x] Mobile: Expo app (TypeScript) with Expo Router; tabs Home, Search, My Groups, Saathi, Profile
- [x] Mobile: NativeWind + theme tokens (light and dark)
- [x] Mobile: fonts Plus Jakarta Sans, JetBrains Mono, Noto Sans Devanagari
- [x] Mobile: API client (axios + interceptors), TanStack Query and Zustand providers
- [x] Mobile: i18n with i18next (en, hi, mr)
- [x] Mobile: app icon, adaptive icon, splash screen
- [x] Backend: Express layered structure (routes → controllers → services → models)
- [x] Backend: config loader, central error handler, pino logger
- [x] Backend: Helmet, CORS whitelist, JSON limits, rate limiter
- [x] Backend: `GET /api/health` with MongoDB and Redis status
- [x] Web: Next.js app for seller + admin with Tailwind tokens
- [ ] Data: MongoDB Atlas + Mongoose connection
- [x] Data: base schemas User, Seller, Category, Product, City, Group, GroupMember, Bid, Payment, Ledger
- [ ] Data: Upstash Redis connection
- [x] DevOps: ESLint + Prettier, `.env.example`, Git `main` + `dev`, folders mobile/ web/ backend/
- [ ] DevOps: EAS project init (development, preview, production profiles)

Notes:
- Built 27 Oct 2026. Stack versions: Expo SDK 58 (RN 0.88, React 19.3), Next.js 16.4 (Cache Components on), Express 5, Mongoose 9, Zod 4, NativeWind 4.2.7 (Tailwind 3 on mobile, Tailwind 4 on web).
- PENDING (owner): MongoDB Atlas + Redis connection code is done, but `MONGODB_URI` / `REDIS_URL` in `backend/.env` are placeholders. `/api/health` returns 503 "not_configured" until they are filled; the "connected" path is covered by a test.
- PENDING (owner): `eas.json` profiles are written; `npx eas-cli@latest login` + `init` needs your Expo account.
- PENDING (verify): the app has not yet been run on a real Android phone (`npx expo start` + Expo Go). Lint and typecheck pass; native bundle export was skipped.
- Android package / iOS bundle id set to `com.saathmein.app` — confirm before the first Play Console upload (it can never change after that).
- Money is stored as integer paise (`*Paise` fields) and percentages as basis points (`*Bps`) in every schema.
- `PAYMENT_STATUS` adds `failed` to the PRD list, so the payment.failed webhook has a status to record.
- Port 5000 is used by another app on this machine; run SaathMein with a different PORT locally if needed.
- Roadmap PDF says "Saffron Night theme"; PRD §14.1 defines "Sunrise" — using Sunrise.
- Roadmap lists an `Offer` schema; PRD data model uses `bids` + `auctionDealers` — using Bid.

### Day 2 — Phone OTP Auth, Roles & Admin Login (Tue 27 Oct)
**Done when:** a new user logs in with OTP and stays logged in after restarting the app; the Owner logs in at /admin/login with password + 2FA; buyers get 403 on admin APIs.

- [x] Mobile: phone number and OTP screens (Firebase Auth)
- [x] Mobile: secure token storage (expo-secure-store), auth store, auto refresh
- [x] Mobile: protected routes and logout
- [x] Mobile: language picker on first launch
- [x] Backend: `POST /auth/otp/verify` (Firebase ID token → own JWT, access 15 min, refresh 30 days with rotation)
- [x] Backend: requireAuth and requireRole middleware (buyer, seller, staff)
- [x] Backend: OTP abuse limits per phone and device
- [x] Backend: admin auth `POST /admin/auth/login` + TOTP 2FA (otplib), 8 h staff session, 30 min idle logout
- [x] Backend: requireStaff(role) for Owner, Admin, Deal Manager, Finance, Support
- [x] Web: /admin/login page with 2FA step; admin layout shell
- [x] Backend: `npm run create-owner` script from env secrets
- [x] Data: unique index on users.phone
- [ ] Firebase: Phone Auth, SHA-1 / SHA-256 for debug and release keys
- [x] Tests: token service and staff permissions

Notes:
- Built 28 Oct 2026. Backend: 68 tests pass (token service, refresh rotation + reuse detection, staff permissions incl. "buyers get 403 on admin APIs", 2FA, lockout, OTP limits, full staff login flow).
- Refresh tokens are opaque `<sessionId>.<random>` strings; only an HMAC is stored (`sessions` collection, TTL index). Reusing an old refresh token revokes the whole session.
- App sessions slide (30 days from last refresh); staff sessions are absolute 8 h and end after 30 min without API activity (checked on every staff request).
- Staff refresh token = httpOnly `sm_staff_rt` cookie (path /api/admin/auth); access token kept in memory only. Cookie routes require the `X-Requested-With` header (CSRF guard).
- 2FA: TOTP secrets AES-256-GCM encrypted with `TWO_FACTOR_ENCRYPTION_KEY`; codes can't be replayed; 10 one-time backup codes; 5 wrong passwords/codes → 15 min lock. First staff login forces 2FA setup (setup key shown as text + otpauth link — a QR code needs a QR library, not added).
- OTP limits: 3 per 10 min per phone (PRD), 5 per 10 min per device, 20 per hour per IP; Indian mobiles only (+91 6–9xxxxxxxxx). Firebase itself sends the SMS — also enable SMS region policy (India only) + App Check in Firebase to stop direct SMS abuse.
- Library added: `@react-native-firebase/app` + `auth` (native Firebase phone OTP — the PRD's chosen service), `expo-dev-client`, `expo-crypto`. Phone login needs an EAS development build; it does not work in Expo Go (the app shows a notice).
- Firebase native plugins are switched on by `mobile/app.config.ts` only when `google-services.json` exists.
- API now answers 503 `DATABASE_UNAVAILABLE` (instead of 500) while MongoDB is not connected.
- Backend tests run with `node --experimental-vm-modules` (otplib / firebase-admin ship ESM-only dependencies).
- PENDING (owner): Firebase project, Phone Auth, Android app `com.saathmein.app` with SHA-1/SHA-256 from `eas credentials`, `google-services.json` → `mobile/`, service-account key → `backend/.env`.
- PENDING (owner): fill the Day 2 secrets in `backend/.env`, then `npm run create-owner`.
- PENDING (Day 5): log staff logins to the audit log; new-device email alert (ADL-4) once the email service exists.
- Not verified end-to-end yet: needs MongoDB + Firebase + a development build on a phone.

### Day 3 — Profile, City & Interest Onboarding (Wed 28 Oct)
**Done when:** a new user completes onboarding; city, budget, timeline and interests are stored; Hindi and Marathi screens display correctly.

- [x] Mobile: onboarding city (location permission or manual), area / pincode
- [x] Mobile: interest picker (categories → brands / products, budget slider, timeline)
- [x] Mobile: profile edit (name, photo, language), delete account
- [x] Mobile: home placeholder showing chosen interests
- [x] Backend: `GET/PATCH /users/me`, `POST /users/me/interests`, `DELETE /users/me`
- [x] Backend: Cloudinary signed upload for avatars
- [x] Backend: demandSignals collection recording interests
- [ ] Cloudinary account and upload presets
- [x] Seed: Pune cities and areas
- [x] Seed: category tree with rules (token, sizes, deadlines, commission)
- [x] Web: Admin Cities page

Notes:
- Built 28 Oct 2026. Backend: 94 tests pass (location matching, profile/interests/deletion, signed avatar uploads, admin cities permissions, seed data sanity).
- DECISION (Vishal, 28 Oct): all categories active at launch except groceries (PRD Q1/Q10). Car commission flat ₹5,000 per car (PRD Q4). Other defaults: bikes flat ₹1,000, electronics/appliances 3%, solar/interiors 2.5%, groceries 4.5%, gym/courses 5%; back-out fee ₹99 (₹0 for groceries). All editable in admin later.
- Seeds: `npm run seed` (= `seed:cities` + `seed:categories`). Pune has 37 areas with Hindi/Marathi names and pincodes (several areas share a pincode — e.g. 411014 Kharadi/Viman Nagar — so auto-detect only pre-selects an area when the pincode is unique). Re-running never overwrites admin changes; `seed:categories -- --reset-rules` restores default rules on purpose.
- `GET /categories` and `GET /cities` (+ `/cities/match`) were built today because onboarding needs them (roadmap lists them on Day 4). Day 4 still adds products, search and admin category editing.
- Added to the data model: `category.nameTranslations`, `category.featuredBrands` (brand choices until products exist on Day 4), `city/area.nameTranslations`, `user.interests.brands`, `user.onboardingCompletedAt`, `demandSignals` (TTL 180 days).
- Onboarding: first login → city & area ("Use my location" or manual) → interests (skippable) → Home. Language picked on first launch is saved to the account.
- Avatars: signed direct upload to Cloudinary (public id fixed to `saathmein/avatars/<userId>`, resized on upload), response signature verified by the API. No upload preset needed. Photos resized to 512 px on the phone first.
- Account deletion erases personal data and keeps an anonymous stub (needed later for payment/ledger history); ends all sessions; removes demand signals, photo and the Firebase user. PENDING (Day 7): block deletion while a token is held.
- PRD ACC-5 also mentions "data export" — not in the roadmap; not built yet.
- PENDING (Day 5): audit log for admin city/area changes.
- PENDING (owner): Cloudinary account + `CLOUDINARY_*` in `backend/.env`; run `npm run seed` once MongoDB is set.
- Not verified on a real phone yet (needs MongoDB, Firebase and a development build).

### Day 4 — Catalog: Categories, Products & Search (Thu 29 Oct)
**Done when:** admin imports products with a CSV; a user searches "activa" with a typo and opens the product page with its Pune price.

- [ ] Mobile: category grid on Home
- [x] Mobile: product page (image carousel, variants, specs, city price)
- [x] Mobile: "Start a group" CTA and open-groups section on product page
- [x] Mobile: search screen with 300 ms debounce and recent searches
- [x] Backend: `GET /categories`, `/products?q=`, `/products/:id`, `/cities`
- [x] Backend: Atlas Search index (brand, model, tags) with text-index fallback
- [x] Backend: priceHistory written on every price change
- [x] Web: Admin Catalog categories with rules editor
- [x] Web: Products CRUD with variants and city prices
- [x] Web: bulk CSV import with failed-row report
- [x] Data: import 300+ launch products (two-wheelers, mobiles, cars, ACs)
- [x] Data: indexes products.slug, products.categoryId

Notes:
- Built 29 Oct 2026. Backend: 127 tests pass (CSV parser, typo matching incl. "actva/acitva/activ → Activa", import validation + failed-row report, a dry run of the whole starter catalog, price history diffs, presenters, catalog permissions).
- DECISION (Vishal, 29 Oct): starter catalog = 315 real models (88 two-wheelers incl. Activa 6G with 3 variants, 81 cars, 99 mobiles/laptops, 50 ACs/TVs/appliances) with APPROXIMATE Pune prices. Every product imports HIDDEN with "Needs price review". Staff check prices in Admin → Products (filter "Needs price review") and switch each product Live, which clears the flag.
- Commands (after seeds): `npm run import:products` (starter file `src/scripts/data/launch-products.csv`, or pass your own CSV; `--dry-run` checks only) and `npm run search:indexes` (Atlas Search index `product_search`).
- Search: Atlas Search fuzzy matching when the index exists; otherwise an in-memory typo-tolerant fallback (Damerau–Levenshtein over brand/model/tags, cached 60 s, fine to a few thousand products). The roadmap's "text-index fallback" is this fuzzy fallback, because a plain text index cannot handle typos.
- Prices are per city AND per variant (`priceByCity.variantKey`, null = whole product). Headline price = on-road, else ex-showroom, else MRP. Every admin/CSV price change writes `priceHistory` (append-only); `GET /products/:id/price-history` is ready for Day 17 charts.
- Product page "Start a group" records a demand signal (`POST /products/:id/interest`) and tells the user group creation opens soon — the real flow replaces it on Day 6. Logged-in views and searches are also recorded as demand signals.
- Product images: signed Cloudinary uploads from Admin → Products (CSV can also carry https image URLs). Starter products have no images yet.
- Admin catalog routes are Owner/Admin/Deal Manager only; the role check is scoped to /categories and /products so it cannot block other admin modules (tested).
- PENDING (owner): run `npm run seed`, `npm run import:products`, `npm run search:indexes` once MongoDB Atlas is set; review prices before switching products live.
- PENDING (Day 5): audit log for category/product/import changes.

### Day 5 — Dealer Login, Onboarding & Dashboard v1 (Fri 30 Oct)
**Done when:** a dealer signs up and logs in, finishes KYC, gets a Razorpay Route linked account in test mode and is approved in admin; the approval appears in the audit log.

- [x] Mobile: seller profile card component (rating, verified badge, distance)
- [x] Mobile: "Request a missing product" form
- [x] Mobile: Home polish with real categories and products
- [x] Backend: `POST /seller/register`, `POST /seller/kyc` (GST, PAN, address, photos, dealer proof)
- [x] Backend: seller staff invites
- [x] Backend: Razorpay Route linked-account creation (test mode)
- [x] Backend: coverage cities + categories, sellers.geo 2dsphere
- [x] Backend: admin approve / reject with reason; email notifications
- [x] Web: dealer sign up, login (email / phone OTP + password), KYC wizard, profile, coverage, team
- [x] Web: Admin Sellers KYC queue with document preview
- [x] Backend: audit-log middleware (every admin write recorded)
- [ ] Razorpay test mode account; request Route activation

Notes:
- Built 30 Oct 2026. Backend: 176 tests pass (dealer sign-up/login/lockout, email codes, KYC rules incl. PAN↔GSTIN and dealer proof for vehicles, forged upload rejected, Razorpay Route setup with mocked SDK incl. resume after failure, approve/reject rules, team rules, audit middleware + redaction, dealer and admin permission matrix, audit entry on approval, popular products). Web builds; mobile typecheck + lint pass.
- DECISION (Claude, needs Vishal's OK): dealer login is **email + password** only. The business mobile is stored as a contact, not a login, because it is not OTP-verified on the web; phone OTP login for dealers (PRD wording) is deferred. Endpoints live under `/api/seller/auth/*` (register = `/api/seller/auth/register`). Dealer refresh token is an httpOnly cookie (`sm_seller_rt`), separate from the admin session.
- One dealer team per person; the owner manages KYC, bank, profile and team; staff (invited by email, 7-day link) get the "seller" role and read access. Max 20 per team.
- KYC: GST, PAN, shop photo required (+ authorised dealer certificate for Cars/EVs and Two-wheelers). Documents are private (Cloudinary `authenticated`), staff open them with 10-minute links. Resubmitting after "sent back" needs the documents uploaded again.
- Razorpay Route: submitting KYC creates the linked account → stakeholder → Route product → settlement bank. Bank details go to Razorpay only (we keep last 4 digits + IFSC). Every step is resumable; errors show in Admin → Sellers with "Retry" (retry also refreshes the activation status). Admin approval is blocked until the account exists and the bank is set. Business category/subcategory sent to Razorpay come from `RAZORPAY_ROUTE_CATEGORY` / `RAZORPAY_ROUTE_SUBCATEGORY` (defaults `ecommerce` / `ecommerce_marketplace`) — confirm with Razorpay.
- Emails (Resend over HTTPS, no SDK): verification code, KYC submitted/approved/sent back, team invite, "KYC waiting" to reviewers. Without `RESEND_API_KEY` emails are written to the API log (dev).
- Audit log: every successful admin write (cities, categories, products, images, CSV imports, seller review, product requests) plus staff logins; secrets redacted; before/after keep changed fields only. Viewer: `GET /api/admin/audit-logs` (Owner/Admin) and the Activity card on a seller. Full audit page stays on Day 13. Closes the Day 2/3/4 audit PENDING items (staff logout and new-device alert still PENDING).
- Mobile: product page shows "Verified dealers in {city}"; "Request this product" from empty search, empty category and Profile; Home has a "Popular in {city}" rail (`GET /products?sort=popular`: distinct buyers' views/interest in the last 30 days, topped up alphabetically). Distance on dealer cards appears once the app sends the buyer's location (Day 11 discovery).
- Admin → Product requests inbox (buyer and dealer requests, mark added/rejected).
- PENDING (owner): Razorpay test account + Route activation; fill `RAZORPAY_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `SELLER_WEB_URL` in `backend/.env`.
- Not verified end-to-end yet (needs MongoDB, Razorpay test keys and Cloudinary).

### Day 6 — Groups Core & Lifecycle State Machine (Sat 31 Oct)
**Done when:** a user creates a group, a second user finds it in the list and on the product page, and the deadline job expires a test group correctly.

- [x] Mobile: create group flow (product / variant, target size, deadline, public or community)
- [x] Mobile: "Join a similar group instead?" step
- [x] Mobile: group page (people counter + progress bar, time left, members, status timeline)
- [x] Mobile: group cards; My Groups tab (joined, leading)
- [x] Backend: group state machine with guarded transitions (open → full → auction_live → won → purchasing → completed + runner_up, expired, no_deal, cancelled)
- [x] Backend: `POST /groups`, `GET /groups` (filters), `GET /groups/:id`, `GET /groups/similar`
- [x] Backend: community groups (invite code, join-by-code, leader approval)
- [x] Backend: BullMQ jobs (deadline check, auction close)
- [x] Data: indexes groups.{cityId, status, deadline}, groups.{productId, cityId, status}
- [x] Data: unique index groupMembers.{groupId, userId}
- [x] Tests: every state transition
- [x] Web: Admin Groups list (read-only)

Notes:
- Built 30 Oct 2026. Backend: 328 tests pass (all 100 status pairs, every guard, optimistic lock, model refusing status writes outside the state machine, deadline sweep, auction close, group rules, routes and admin permissions). Web builds; mobile typecheck + lint pass.
- DECISION (Vishal, 30 Oct — open question 5): an auction started early at ≥70% uses the SAME rules and ceiling; dealers see the real member count.
- DECISION (Vishal): a membership always means a paid token (PAY-2). A new group shows "0 of N" — the leader takes their seat by paying the token on Day 7 ("pay to start" goes into the create flow then).
- DECISION (Vishal): at the deadline with ≥70% (and at least 1 member) the leader has 48 h to extend once (+7 days, never beyond the category's max deadline from creation) or start the auction early; no answer → expired. Below 70% → expired. Values live in the new `settings` collection (`groups.earlyStartThresholdBps`, `leaderDecisionHours`, `extensionDays`, `maxOpenGroupsPerLeader` = 5), with defaults until the Settings page (Day 11).
- State machine: `services/groups/stateMachine.js` is the only writer of `group.status` — the Group model now throws on any save/update touching status without it. Writes use the current status as an optimistic lock (exactly once); side effects (schedule auction close; refunds TODO Day 7) run after the change.
- Jobs: new `worker.js` (`npm run worker`, needs `REDIS_URL`): minute sweep (deadlines + overdue auctions safety net) and one delayed auction-close job per end time (Redis lock + state-machine lock). Auction close today: lowest price wins, earliest wins a tie, runner-up = best other dealer, no bids → no_deal. Min-dealers extension, admin pause and deal codes stay on Days 9–10. BullMQ is only loaded when Redis is configured.
- Community groups: every group has an 8-character invite code (no 0/O/1/I/L); community groups are hidden from search and 404 for people without the code; optional leader approval happens before payment (`pending_approval` → `approved`, then pay on Day 7). Leader can cancel only while nobody has paid.
- Mobile: "Start a group" on the product page opens the create flow (replaces the Day 4 interest-only button); product page lists open groups; group page with people counter + Sunrise bar, time left, timeline, invite code + share sheet, leader decision card, join requests; My Groups (Joined / Leading) with "Have an invite code?"; `saathmein://g/<code>` opens a group. https share links and links opened before login come with sharing on Day 8.
- Test fixes: health test no longer reloads the whole app twice (it timed out under parallel load); Jest timeout 20 s for bcrypt-heavy auth tests.
- PENDING (owner): `REDIS_URL` (Upstash) in `backend/.env` and run `npm run worker` next to the API — without it deadlines are not processed.
- Not verified end-to-end yet (needs MongoDB + Redis). To check "Done when": create a group with a 3-day deadline, open it from a second account via the product page or the list, then set its `deadline` in the past in Atlas and wait for the worker sweep (≤1 min) → status `expired`.

### Day 7 — Razorpay Payments, Refunds & Ledger (Sun 1 Nov · Power day)
**Done when:** in Razorpay test mode, three users pay tokens and join; one leaves and is refunded; an expired group refunds everyone; the ledger matches Razorpay exactly.

- [ ] Mobile: Razorpay React Native SDK in an EAS development build
- [x] Mobile: join flow (token summary, refund rules, pay by UPI / card)
- [x] Mobile: money timeline per group (paid, held, refunded, transferred) + receipts
- [x] Mobile: leave group with refund preview
- [x] Mobile: join waitlist when a group is full
- [x] Backend: `POST /payments/order`, `/payments/verify` (HMAC signature)
- [x] Backend: `/payments/webhook` for payment.captured, payment.failed, refund.*, transfer.*, settlement.processed (idempotent)
- [x] Backend: join = payment + member + count in one MongoDB transaction
- [x] Backend: refund service (leave open group, expired, no_deal, cancelled, back-out fee after lock)
- [x] Backend: ledger service (append-only)
- [x] Backend: Route transfer service (token minus commission, on hold, release / reverse)
- [x] Backend: waitlist (freed seat offered to next user for 2 h)
- [ ] DevOps: webhook URL on a Render preview / public tunnel
- [x] Backend: daily reconciliation job vs Razorpay settlements
- [x] Tests: duplicate webhook, failed payment, every refund path
- [x] Backend: commission rules per category read from settings

Notes:
- Built 8 Nov 2026. Backend: 400 tests pass (signatures, commission split, ledger balances for every flow, order rules, the join transaction incl. duplicates / last seat / late payment / amount mismatch, every refund path incl. back-out fee and fee-only, retries, webhook idempotency and redelivery, Route hold / release / reverse / failed transfer, reconciliation auto-fixes, raw-body webhook route). Mobile typecheck + lint pass.
- DECISION (Vishal, 8 Nov — open question 1): the token is a PART-PAYMENT. The dealer gets token minus commission through Route (on hold until the purchase is confirmed); the buyer pays the winning price minus the token at the shop. Commission above the token is invoiced to the dealer.
- DECISION (Vishal, 8 Nov — open question 3): the buyer convenience fee is charged at purchase (Day 10), ₹0 at launch. Today the token is the only charge; refunds always return the full token (minus the back-out fee only after lock).
- Join flow: `POST /payments/order` (amount = the group's token snapshot; the seat is held 15 min = `settings.payments.seatReservationMinutes`) → Razorpay Checkout (UPI first) → `POST /payments/verify` (HMAC with the key secret; captures if only authorized). The ONE join path (`confirmCapturedPayment`) is used by verify, the webhook and reconciliation: payment paid + ledger `token_held` + seat (`memberCount` +1, guarded) + member, in one transaction; duplicates do nothing; the last seat moves the group to `full` (state machine); a payment that arrives after the last seat is taken (or with a wrong amount) is refunded in full.
- Webhook: `POST /api/payments/webhook` reads the RAW body (signature over exact bytes, webhook secret), outside the general rate limit; event ids stored in `webhookEvents` (processed once; a failed one runs again on redelivery). Handled: payment.captured / authorized / failed, refund.processed / failed, transfer.processed / failed, settlement.processed.
- Refunds: one refund per payment + reason, claimed in the database BEFORE calling Razorpay (never twice); queued in BullMQ (`refunds`, retried with backoff; the minute sweep re-queues failed ones up to 8 attempts); ledger `refund` (+ `fee`) written when Razorpay says processed. Paths: leave open (full), leave after lock (minus `group.backoutFeePaise`, snapshot at creation), expired / no_deal / cancelled (all members, via group effects), seat unavailable, amount mismatch. Leaving during `auction_live` is blocked; the 24 h exit window after a win comes on Day 10.
- Ledger: added `transfer_reversal` and `commission_reversal` types (corrections stay new rows). Route transfer service (hold / release / reverse) is ready and tested; it is called from the auction win (Day 9) and purchase confirmation (Day 10).
- Waitlist: free to join when full; a freed seat is offered to the next person for 2 h (`settings.payments.waitlistOfferHours`), only they can pay for it; expired offers go to the back of the line.
- Reconciliation: nightly 02:30 IST (BullMQ scheduler) over the previous IST day; lost captures and lost refund.processed are fixed automatically through the normal paths; other differences are stored in `reconciliationReports` for the Payment monitor (Day 13); Razorpay fee/tax saved per payment.
- Mobile: `react-native-razorpay` 3.0.0 (loaded lazily — in Expo Go the pay button explains that payments need the app build). Pay screen, money timeline with receipt, leave sheet with refund preview, waitlist / seat-offer actions, "Start group" now goes straight to paying the leader's token. Public key id comes from the server, so no new app env variable.
- Fixes: invite-code errors now use `INVITE_CODE_INVALID` (it reused the OTP code); Day 6 group errors and payment errors now show translated messages instead of "something went wrong"; bcrypt cost is `BCRYPT_ROUNDS` (12, production refuses less; tests use 4 — the slow cost-12 hashing was timing out tests).
- PENDING (owner): Razorpay test keys + webhook secret; create the webhook in the Razorpay dashboard (events above) pointing to a public URL — locally run a tunnel (e.g. `cloudflared tunnel --url http://localhost:5000`) and use `https://<tunnel>/api/payments/webhook`; `REDIS_URL` + `npm run worker`; build the EAS development build (`eas build --profile development --platform android`) — Razorpay Checkout does not run in Expo Go.
- Not verified end-to-end yet. "Done when" check: in test mode, 3 users pay tokens and join; one leaves (refund); expire the group (set `deadline` in the past) → everyone refunded; then compare the `ledgers` collection with the Razorpay dashboard (and the nightly reconciliation report).

### Day 8 — Live Groups, Chat, Push & Sharing (Mon 2 Nov)
**Done when:** two phones see the counter change instantly when one joins; chat works; a push arrives when the group fills; a WhatsApp link opens the group in the app.

- [x] Mobile: socket client (live counter, status changes, new-member animation)
- [x] Mobile: group chat (text, images, polls for leader, pin, report)
- [x] Mobile: push notifications (Expo Notifications + FCM) and notification centre
- [x] Mobile: share to WhatsApp with deep link (expo-linking, Android App Links)
- [x] Backend: Socket.io gateway (JWT auth, room per group, Redis adapter)
- [x] Backend: chat messages API with rate limits and profanity filter
- [x] Backend: notification service (push + in-app, quiet hours 10 pm – 8 am)
- [x] Backend: deep-link route `/g/:code` → app or Play Store
- [ ] FCM credentials in Expo
- [x] assetlinks.json for App Links on the domain
- [ ] Play Console: create the app; start internal testing
- [ ] Play Console: start closed testing (12+ testers for 14 days if personal account)

Notes:
- Built 8 Nov 2026. Backend: 432 tests pass (socket auth + room access, share page + assetlinks, notifications: quiet hours / language / deferred push / dead tokens / token moves, chat: members only, profanity, polls, pins, reports, live effects incl. 24 h reminder once and night-time seat offers). Web builds; mobile typecheck + lint pass.
- Sockets: Socket.io on the API server (`group:<id>` and `user:<id>` rooms), app access token in the handshake, Redis adapter when `REDIS_URL` is set. The worker has no socket server: it publishes on Redis (`saathmein:socket-emit`) and each API instance re-emits to its own clients. Events: `group:count`, `group:member`, `group:status`, `chat:message`, `chat:update`, `notification:new`. The app polls every 15 s while the socket is down (60 s safety refresh while live).
- Chat: members + leader only (winning dealer joins on Day 9); 10 messages/min per person; abusive words masked (built-in English + Hindi/Marathi list, no extra library); photos via signed Cloudinary uploads (resized to 1280 px on the phone); polls by the leader (one vote per member); up to 3 pinned; hidden after 3 reports (Support review queue on Day 12).
- Notifications: saved for the in-app centre (90-day TTL) in the user's language (en/hi/mr templates on the server), sent live, pushed through the Expo push service (no SDK). Quiet hours 22:00–08:00 IST: pushes wait until 08:00 (minute sweep). Sent today: group full, deadline in 24 h, leader decision, group ended (refund), auction started, refund done, waitlist seat offer, join request + decision. New lowest price / won / price validity arrive with Days 9–10.
- DECISION (Claude, small): a waitlist seat freed during quiet hours is held until 10:00 IST (2 h from 08:00), so nobody loses a seat while asleep.
- Sharing: group page shares to WhatsApp (falls back to the share sheet) with `https://<domain>/g/<code>`. The web app proxies `/g/*` and `/.well-known/assetlinks.json` to the backend (Next.js rewrites), so the public domain works for links. Android App Links: `autoVerify` filter for `EXPO_PUBLIC_APP_LINK_HOST`; links opened while signed out are kept and opened after login (`+native-intent`).
- Fix: chat photos no longer use the square 512 px avatar picker.
- PENDING (owner): `eas init` (adds the EAS project id needed for push tokens); upload the FCM V1 service-account key to Expo (expo.dev → Credentials) — then FCM task can be ticked; Play Console app + internal testing; copy the app signing SHA-256 (Play Console → App integrity) into `ANDROID_SHA256_CERT_FINGERPRINTS`; set `APP_LINK_BASE_URL` (backend) and `EXPO_PUBLIC_APP_LINK_HOST` / `EXPO_PUBLIC_SOCKET_URL` (mobile) to real values; new development build (expo-notifications + App Links are native changes).
- Not verified end-to-end yet. "Done when" check: two phones on one group — pay from one, the counter changes on the other within a second; chat both ways; fill the group → "Your group is full" push; send the WhatsApp link to a phone with the app → opens the group.

### Day 9 — Dealer Live Auction: Lowest Price Wins (Tue 3 Nov)
**Done when:** a full group of 5 test buyers gets live bids from 3 test dealers; each bid must beat the lowest; a last-minute bid extends the timer; at close the lowest dealer wins automatically and all 5 members get deal codes for that dealer.

- [x] Mobile: live auction card (falling price, dealers bidding, time left, "₹X saved so far")
- [x] Mobile: price-drop chart and "new lowest price" animation
- [x] Mobile: winner screen (dealer name, address, rating, final price)
- [x] Mobile: 24 h exit window with refund preview
- [x] Mobile: seller-led deal page (tier ladder, "X more to unlock")
- [x] Backend: group full → auction_live; notify eligible dealers (city, category, rating)
- [x] Backend: `POST /seller/auctions/:groupId/join` (commitment) and `/bids` (ceiling, min step, breakdown totals, atomic lowest-price update)
- [x] Backend: socket events auction:lowest, auction:extended, auction:won; outbid push + email
- [x] Backend: auction close job (exactly once; lowest wins, earliest on tie; deal codes for all members)
- [x] Backend: anti-sniping, minimum-dealers rule, runner-up fallback
- [x] Backend: `POST /seller/deals` with tiers; automatic tier-unlock broadcast
- [x] Web: dealer Live auctions list and Upcoming groups
- [x] Web: dealer bid screen (price + breakdown, current lowest, my rank, timer)
- [x] Web: dealer Won groups with members and deal codes
- [x] Tests: concurrent bids, tie, extension, runner-up, 0 / 1 dealer

Notes:
- Built 9 Nov 2026. Backend: 484 tests pass (bid rules incl. the compare-and-set race, min step, ceiling, breakdown, anti-sniping cap; close: tie, min-dealers extension, 0 / 1 dealer; winner, back-out, runner-up, timeouts; deal tiers; eligibility; settlement holds/reversals; exit-window refund; dealer route permissions). Web builds; mobile typecheck + lint pass.
- Decisions (8 Nov 2026): open question 2 → verified dealers with fewer than 3 reviews may bid (3.5 minimum applies from 3 reviews); open question 4 → seller-led deal below its first tier at the deadline is expired and every token refunded; only one dealer after the 24 h minimum-dealers extension → bidding stops and the leader has 24 h to accept that price or cancel with full refunds (no answer = cancel).
- Rules live in `settings.auctions` (min rating, reviews for rating, extensions, decision / exit / runner-up hours, price-alert throttle, bid cooldown, back-out suspension days) and the category's `rules.auction` (duration, ₹200 / 0.25% step, 5 min anti-sniping ×6, min 2 dealers). The ceiling is the city's catalog price for the variant (cheapest variant for "any variant").
- Bids: inside a transaction, compare-and-set on the current lowest bid + end time, so two simultaneous bids cannot both win (the loser gets `BID_RACE` and retries). Bids are permanent. Dealers see only the anonymous lowest price and their own rank; buyers see the falling price, never dealer names, until the result.
- Close runs once (job id per end time + Redis lock + state machine). Won → 24 h exit window (leave = refund minus back-out fee; freed seats go to the waitlist at the same price), deal codes (10 characters) for every seated member.
- Money (PAY-4): on every win (auction, runner-up, seller-led deal, seat taken after a win) each seated token minus commission goes to the dealer's Razorpay linked account ON HOLD; reversed first when the dealer backs out, the group ends, or a member leaves in the exit window; the minute sweep retries failed holds. A reversed transfer can be replaced (runner-up).
- Back-out (owner only on the web): rating penalty + 30-day auction suspension; the group is offered to the runner-up for 24 h, else cancelled / no deal with full refunds.
- Web: socket.io-client 4.8.1 added (approved list); `NEXT_PUBLIC_SOCKET_URL` added to `web/.env.local` + `.env.example`.
- MOVED to Day 10: the winning dealer joining the group chat (Day 8 note); deal-code QR + scan / confirm.
- Not verified end-to-end yet (needs MongoDB, Redis + worker, Razorpay test keys, dealers with Route accounts). "Done when" check: 5 test buyers fill a group; 3 verified test dealers join from /seller/auctions and bid; place one bid in the last 5 minutes (timer +5 min); after close the lowest dealer wins and all 5 members see their deal code on the group page.

### Day 10 — Deal Codes, Purchases & Commission (Wed 4 Nov)
**Done when:** the winning dealer scans a deal code; the purchase completes; the Route hold is released to the dealer minus commission in test mode; the buyer gets a saving card and leaves a review.

- [x] Mobile: deal-code ticket (QR + code, seller, price, validity)
- [x] Mobile: upload invoice photo
- [x] Mobile: "You saved ₹X" share card
- [x] Mobile: review the seller after purchase
- [x] Backend: unique signed deal codes for every member when the auction is won
- [x] Backend: `POST /seller/purchases/confirm` (scan or enter code)
- [x] Backend: completion rules (seller confirms, or invoice + 48 h with no objection)
- [x] Backend: auction won → Route transfers on hold; completion → hold released, commission entry, review request
- [x] Backend: monthly commission invoices with GST numbering
- [x] Web: seller Purchases (scan QR with webcam or enter code)
- [x] Web: seller Payouts page
- [x] Web: Admin Commissions page
- [x] Tests: commission math for every category

Notes:
- Built 10 Nov 2026. Backend: 538 tests pass (commission split for car / two-wheeler / mobile / laptop / groceries / solar rules, GST CGST+SGST vs IGST, FY numbering, IST months, invoice issue idempotent; signed QR + forged QR; confirm completes once, expired / used / other dealer's code refused; invoice 48 h + objection; expiry refund minus fee with hold reversal and retry; hold-release retry; reviews; Commissions permissions Support / Deal Manager 403). Web builds; mobile typecheck + lint pass.
- Decisions (9 Nov 2026): unused deal code at the end of the dealer's price validity → hold reversed, token refunded minus the back-out fee, reminder 48 h before; invoice + 48 h without objection completes the purchase until the Day 19 AI invoice check is added in front; QR libraries react-native-qrcode-svg (mobile) and jsqr (web) approved; commission invoices are print-ready web pages (browser "Save as PDF"), no PDF library.
- A purchase record is created with each deal code (price, token, validity = dealer's 7–15 days from the win; seller-led deals `settings.purchases.sellerDealValidityDays` = 15). QR = `SM1.<code>.<HMAC>` signed with `DEAL_CODE_SECRET`; dealers may also type the code (rate-limited). Token is part-payment: the ticket shows "pay at the shop" = price − token.
- Completion (dealer confirm or invoice path): member → purchased, commission recorded (`commissions`), the member's held Route transfer released (created first if the win-time one had failed), "You saved ₹X" push + review. First sale moves the group to purchasing; when no code is open it is completed. Leaving in the exit window cancels the member's code.
- Commission is earned at completion; the part kept from the token was already recorded in the ledger at transfer time (no double entry). Monthly invoices on the 1st at 03:00 IST (BullMQ) or "Issue invoices" in Admin → Commissions; number SM/2026-27/0001 from an atomic counter; GST 18% on top of commission, CGST+SGST when the dealer GSTIN state = ours, else IGST; balance due = total − kept from tokens.
- PENDING (owner / CA): SaathMein legal name, GSTIN, address and SAC code go in `settings.billing` (placeholders now); confirm with the CA that GST is charged on top of the commission (current setting) and the SAC code. Admin settings screen is Day 11.
- Reviews: only completed buyers, once per purchase; dealer rating updated atomically (running average).
- Seller web: Purchases (webcam QR scan or typed code → preview → confirm; view invoice, object within 48 h), Payouts (on hold / released / taken back, settlements, invoices), printable invoice page; Admin → Commissions (filters, totals, CSV, invoices, issue a month) for Owner / Admin / Finance.
- New env: `DEAL_CODE_SECRET` in `backend/.env` + `.env.example` (production refuses a weak value).
- MOVED to Day 12: winning dealer in the group chat (from Day 9) and objected invoices → disputes queue. Mobile "My deal codes" list screen uses `GET /users/me/deal-codes` — the ticket is on the group page for now.
- Not verified end-to-end yet (needs MongoDB, Redis + worker, Razorpay test keys with Route, Cloudinary). "Done when" check: win a group in test mode → the dealer opens /seller/purchases and scans a member's QR (or types the code) → confirm → Payment.transfer.status = released and a hold_release ledger row; the buyer sees "You saved ₹X" and leaves a review.

### Day 11 — Discovery, Home Feed & Community Groups (Thu 5 Nov)
**Done when:** Home shows real ranked sections for Pune; a society group is joinable only with its code; referral credits appear after a referred purchase.

- [x] Mobile: Home sections (Near you, Ending soon, Almost full, Seller deals, Trending, Categories)
- [x] Mobile: filters (category, area, price, group size, time left, type)
- [x] Mobile: community private group, invite code / QR, approve members
- [x] Mobile: referral link and wallet screen
- [x] Backend: `GET /feed/home` with rule-based ranking v1
- [x] Backend: Trending = joins in last 48 h, cached in Redis (5 min)
- [x] Backend: referral and wallet credits service
- [x] Backend: group-leader bonus on completion
- [x] Web: Admin Curation (banners, featured deals, category order)
- [x] Web: Admin Settings (fees, token per category, back-out fee, bidding hours, feature flags)

Notes:
- Built 12 Nov 2026. Backend: 574 tests pass (ranking v1, feed sections + public-only + seller-deal flag, trending cache key, referral rules incl. own code / loop / too late / after purchase, credits once per key incl. a concurrent duplicate, leader bonus guard, settings validation per section, Curation / Settings Owner + Admin only, banner links in-app only, maintenance mode). Web builds; mobile typecheck + lint pass.
- Decisions (12 Nov 2026): wallet credits are earned and shown now; spending on tokens (with refunds back to the wallet) MOVED to Day 13. Defaults ₹100 referrer + ₹100 friend on the friend's first completed purchase (once), ₹500 leader bonus only when the leader's own purchase and at least 3 other members' purchases completed. All amounts and rules in `settings.referrals` (Admin → Settings).
- Feed ranking v1 (Near you, Seller deals): 40% how full, 30% closing soon (7-day window), 20% matches my interests, 10% new (14 days). Ending soon = open, closes within 72 h; Almost full = 60%+ of target; Trending = most joins in 48 h, Redis 5 min per city (no Redis → computed each time). Near you uses the leader's area, now stored on new groups (older groups have no area). Community groups never appear. AI "Groups for You" replaces Near you on Day 16.
- Filters on GET /groups: area, type, price range (city price: on-road, else ex-showroom, else MRP), group size, time left. Mobile browse screen is /browse (home "See all" presets).
- Referral: code created on first use, link https://<domain>/r/<code> (share page + Android App Link /r/). A new account (≤ 30 days, no completed purchase) can add a code once; a link opened before login is added automatically after login. Wallet = append-only `walletTransactions` + `user.walletBalancePaise` in one transaction, unique key per reward.
- Community groups: invite QR (react-native-qrcode-svg) holds the https share link, so any phone camera opens the group; join by code and leader approval already existed (Day 6).
- Admin → Curation (Owner, Admin): banners with Hindi / Marathi titles, image (signed Cloudinary upload), in-app link only, city, dates, order; featured groups; category order. Admin → Settings (Owner, Admin): groups, auctions, payments, purchases, billing (GST), referrals and feature flags; per-category values stay in Categories. Every change audited with before / after.
- Feature flags enforced: referrals, seller-led deals, community groups, maintenance mode (buyers and dealers can read; changes get 503; admin, auth and Razorpay webhooks keep working). Settings are cached 60 s per process, so changes reach the API and worker within a minute.
- Not verified end-to-end (needs MongoDB + Redis + a seeded Pune catalog with groups). "Done when" check: with a few open groups in Pune, Home shows the sections; a community group opens only with its code / QR; a referred friend's first completed purchase shows ₹100 in both wallets.

### Day 12 — Trust, Reviews, Reports & Disputes (Fri 6 Nov)
**Done when:** a buyer opens a "price not honoured" dispute; the seller responds; Support decides a refund; the refund and the seller penalty are both logged.

- [x] Mobile: report a group, member, seller, message or review
- [x] Mobile: disputes (open with evidence, timeline, status)
- [x] Mobile: seller profile (rating, reviews, verified badge)
- [x] Backend: reviews API (completed buyers only) and rating aggregates
- [x] Backend: reports + disputes API with timeline; 48 h seller SLA job
- [x] Backend: seller penalties (warning, rating penalty, bidding suspension)
- [x] Backend: privacy — phone numbers hidden until acceptance
- [x] Web: Admin Disputes and Reports queue with evidence viewer
- [x] Web: seller respond to disputes
- [x] Web: legal pages (terms, privacy, refund policy, grievance officer)

Notes:
- Built 12 Nov 2026. Backend: 609 tests pass (dispute open rules, every decision money path — refund with hold reversal, refund while the token is with SaathMein, credits only once released and never above the token, wrong path refused, no double decision, penalties; 48 h escalation and late answers; reports visibility, duplicates, own content, actions per target, closing every report on a target; rating with penalties; phone masking; invoice dues; Disputes / Reports queue Owner + Admin + Support only, decision reason required and audited). Web builds; mobile typecheck + lint pass.
- Decisions (12 Nov 2026): Support refund = token with SaathMein or on hold → hold reversed and full token refunded to the bank, deal code cancelled; token already released → SaathMein wallet credits (up to the token), recorded as a dealer due billed (without GST) on the next monthly commission invoice. A rating penalty counts as one 1-star rating in the dealer average (`ratingCount` includes penalties for the 3.5 auction rule; buyers see the number of reviews). The winning dealer sees a member's phone masked until the 24 h exit window ends, then in full; other members never see phones. Legal pages are full drafts marked "pending legal review".
- Disputes: buyer opens on a purchase (code issued, invoice uploaded, objected or completed) with up to 6 private photos and chat message ids; one open dispute per purchase; the dealer has 48 h (`settings.disputes.sellerResponseHours`), then the minute sweep escalates it (a late answer is still recorded). A dealer objecting to a buyer's invoice now opens a dispute for Support. While a dispute is open the purchase does not expire or auto-complete.
- Reports: group, member (long press in the group; members now carry an opaque id), dealer, chat message (also counts toward the auto-hide after 3), review. Support: dismiss, hide / show again (reviews recompute the rating), warn dealer, suspend account; one decision closes every open report on that target.
- Penalties come from one service (disputes, reports, a winner backing out). Public dealer profile GET /sellers/:id + /reviews; mobile dealer screen opens from the winner card and the deal ladder.
- PENDING (owner): fill `web/src/utils/legal.js` (company name, address, CIN, GSTIN, support contacts, grievance officer) and have a lawyer review the four pages, then set `isDraft: false`. New mobile env `EXPO_PUBLIC_WEB_URL` (legal links in Profile).
- MOVED to Day 13: the winning dealer in the group chat (moved from Day 9/10), staff "suspend account" un-suspend and penalty removal screens, wallet spending on tokens.
- Not verified end-to-end (needs MongoDB, Redis + worker, Razorpay test mode, Cloudinary). "Done when" check: after a win, the buyer opens "Problem with the dealer?" → price not honoured with a photo; the dealer answers on /seller/disputes; Support opens /admin/disputes, chooses Refund + Rating penalty with a reason; the refund appears in the buyer's money timeline and ledger, and the penalty on the dealer; both are in the audit log.

### Day 13 — Full Owner Console & Live Monitoring (Sat 7 Nov)
**Done when:** the Owner watches a test auction live with dealer names, sees payments, holds and refunds on the Payment monitor, receives an alert when a webhook fails, cancels a test group (everyone refunded) and every action appears in the audit log.

- [x] Mobile: loading skeletons, empty and error states on all screens
- [x] Mobile: offline cached screens and retry banners
- [x] Backend: `/admin/monitor` (overview, groups, auctions, payments, dealers, buyers, system health — live via sockets)
- [x] Backend: auction actions (pause, extend, cancel, force runner-up — reason required)
- [x] Backend: Razorpay monitor data (success rate by method, refunds pending / failed, holds, webhook failures, reconciliation)
- [x] Backend: alert rules (payment, auction, suspicious bidding, reconciliation, system) → console + email + push
- [x] Backend: permission matrix per route + tests (Support gets 403 on Payments, Settings, Team)
- [x] Web: Admin Overview dashboard with live charts
- [x] Web: Auction monitor with full bid timeline
- [x] Web: Payment, Dealer, Buyer monitors, System health
- [x] Web: Alerts centre; Team invites and roles; Audit log viewer; CSV export
- Notes: Staff sockets join a `staff` room only (staff token); monitors refresh live on `monitor:changed` / `alert:new`, 30 s polling fallback. Every staff action needs a reason (10+ chars) and writes before/after to the audit log; cancel goes through the state machine (refunds after held transfers are reversed); manual refunds are refused while a token is on hold at the dealer (reverse first). Alerts are deduplicated (repeats count up), emailed to the Owner + the handling role, pushed (warning/critical) to the buyer-app account in `settings.alerts.ownerPushPhone`; thresholds editable in Admin → Settings → Alerts. Team: Owner-only invites (72 h link, account + password on the invite page, 2FA at first sign-in), role change / disable end sessions; the Owner cannot be changed. Permission matrix test covers every monitor, action, alert, Team, Settings and audit route for all 5 roles (172 cases). Backend tests: 811 passing.
- Carry-overs done: the winning dealer's team chats with the group as the business (web dealer room + mobile "dealer" tag); staff lift penalties early (Sellers → dealer → Penalties) and suspend / reactivate buyers (Buyer monitor).
- Mobile offline: connectivity is judged from API reachability (no new native module); key screens (home, my groups, group pages incl. deal codes, payments, products, dealers, wallet, disputes, categories, cities) are saved to the app cache and open offline; cache cleared on sign-out (previously the query cache was not cleared at all). Needs a new dev build only if `expo-file-system` was not already linked (it ships with Expo, so normally no rebuild).
- MOVED to Day 16: wallet credit spending on tokens (decided 13 Nov 2026).
- PENDING: `AdminDashboardHome.jsx` (old Day 2 home) is no longer used — delete with Vishal's OK. Staff logout / new-device alert still PENDING from Day 2.

### Day 14 — QA, Hardening & Launch v1.0 (Sun 8 Nov · Power day)
**Done when:** install from the Play testing track → OTP → join a group with a real UPI token → seller bids → auction won → purchase confirmed → payout; admin console live.

- [ ] Mobile: real-device QA on 3 Android phones, 360 px layouts
- [ ] Mobile: accessibility (labels, 48 dp targets, contrast)
- [ ] Mobile: Sentry for React Native
- [ ] Mobile: EAS production build (AAB) version 1.0.0
- [ ] Backend: security review (validation, rate limits, webhook signatures, CORS)
- [ ] Backend: load test (500 socket clients, 50 joins / min)
- [ ] Backend: fix all P0 bugs
- [ ] DevOps: deploy API + workers (Render / Railway), web (Vercel); Atlas production rules and backups
- [ ] DevOps: GitHub Actions lint + tests on every PR
- [ ] Play listing: screenshots, feature graphic, privacy policy URL, data safety form
- [ ] Upload AAB to internal / closed testing; tag v1.0.0
- [ ] Sunday extra: end-to-end bug bash with 5 real users; live Razorpay keys after activation; socket load test

Notes:
- Roadmap "Done when" says "seller bids → accept"; the auction picks the winner automatically (PRD §10.5), so "accept" = auction won.

---

## Sprint 2 — AI Integration (Days 15–20)

### Day 15 — AI Foundation & Saathi v1 (Mon 9 Nov)
**Done when:** a user asks "1.2 lakh ke andar best bike Pune mein" and gets real products and open groups as tappable cards; cost is logged per message.

- [ ] Mobile: Saathi chat screen with streaming replies; floating Saathi button
- [ ] Mobile: violet AI styling (Saathi glow)
- [ ] Mobile: answer cards (product, group, offer — tap to open)
- [ ] Mobile: quota indicator, thumbs up / down
- [ ] Backend: AI service with LLMProvider (Claude API), VisionProvider, EmbeddingProvider
- [ ] Backend: Saathi tools (searchProducts, findGroups, getPriceInsights, explainRules)
- [ ] Backend: `POST /ai/saathi/chat` (SSE streaming) + conversation storage
- [ ] Backend: quotas, aiUsage cost logs, versioned prompt templates, Redis cache
- [ ] Backend: guardrails (grounded answers; confirm screen for any action)
- [ ] Web: Admin AI control centre (provider, model, quotas, daily cost)
- [ ] Web: low-rated answers review list

### Day 16 — Smart Match & Demand Nudges (Tue 10 Nov)
**Done when:** two test users with different interests see clearly different Groups for You; a nudge appears after 5 users show interest in a product with no group.

- [ ] Mobile: "Groups for You" row with "Why this?" labels
- [ ] Mobile: nudge card ("Start a group — 9 people near you want this")
- [ ] Backend: embedding job for products and groups
- [ ] Backend: user interest vector from onboarding, views, joins, Saathi chats
- [ ] Backend: ranking (similarity + city + budget + urgency + seller rating)
- [ ] Backend: demand nudges from demandSignals clusters
- [ ] Data: Atlas Vector Search index on products.embedding
- [ ] Data: nightly re-embed of changed products
- [ ] Feature flag: AI feed vs rule feed; track click-through
- [ ] Carry-over (from Day 13): wallet credits can pay part of a token; refunds of that part go back to the wallet

### Day 17 — Deal Predictor & Price Insights (Wed 11 Nov)
**Done when:** an open group shows "Now ~4% · at 20 members ~7% · 78% likely to fill by Friday"; price chart and best-time hint show on product pages.

- [ ] Mobile: savings meter (now %, next tier %, fill probability, confidence)
- [ ] Mobile: price history chart on product page; best-time hint
- [ ] Mobile: follow a product → price-drop and festival alerts
- [ ] Backend: predictor v1 (discount curve from past offers and tiers per category)
- [ ] Backend: fill probability from join velocity and similar past groups
- [ ] Backend: `GET /ai/predict/:groupId` (cached, recomputed on join)
- [ ] Backend: price insights service + festival calendar
- [ ] Backend: accuracy log vs real outcomes
- [ ] Data: seed historical offers for demo categories
- [ ] Data: nightly priceHistory roll-ups

### Day 18 — Offer Analyzer, Snap-to-Find & Smart Compare (Thu 12 Nov)
**Done when:** two offers show a clear breakdown with one hidden charge flagged; a photo of a phone box finds the right product and its open group.

- [ ] Mobile: Offer Analyzer panel (breakdown bars, hidden-charge flags, best-value explanation)
- [ ] Mobile: upload a showroom quote photo to compare
- [ ] Mobile: Snap-to-Find camera with top-3 confirm
- [ ] Mobile: Smart Compare for 2–3 products
- [ ] Backend: `POST /ai/offers/analyze` (structured breakdown JSON schema, flags, summary → bids.analysis)
- [ ] Backend: quote OCR via vision model → breakdown
- [ ] Backend: `POST /ai/snap` (identify brand / model / variant → catalog match)
- [ ] Backend: `POST /ai/compare`
- [ ] Web: seller bid form shows the analyzer preview before submit
- [ ] Tests: analyzer output schema on 20 sample offers

### Day 19 — Seller AI, Share Cards & Trust AI (Fri 13 Nov)
**Done when:** a seller sees demand for Activa in Kothrud with suggested tiers; a fake test-account cluster is flagged; an uploaded invoice is matched automatically.

- [ ] Mobile: AI share card (poster + WhatsApp text in the user's language)
- [ ] Mobile: @Saathi in group chat
- [ ] Mobile: "Catch me up" chat summary
- [ ] Backend: Demand Radar (14-day forecast by product and area + tier advice)
- [ ] Backend: share-card rendering (template + generated copy) to Cloudinary
- [ ] Backend: Trust AI (device / payment links, join-leave patterns, risk score)
- [ ] Backend: invoice OCR check (GSTIN, product, amount vs offer)
- [ ] Backend: review-spam and abusive-chat classifier
- [ ] Web: seller Insights page (Demand Radar, tier advice, bid helper)
- [ ] Web: Admin Trust queue with signals

### Day 20 — Voice, AI Hardening & Launch v1.1 (Sat 14 Nov)
**Done when:** saying "Pune mein 15 lakh ke andar 7-seater dikhao" opens Saathi results; all AI features are live with monitoring, limits and docs.

- [ ] Mobile: voice input for Saathi (EN / HI / MR) + spoken replies
- [ ] Mobile: AI onboarding tooltips; quota and error states
- [ ] Mobile: final polish of all AI screens
- [ ] Backend: rate limits on all AI routes; abuse detection
- [ ] Backend: provider fallback and graceful degradation
- [ ] Tests: quotas, analyzer schema, guardrails
- [ ] Backend: AI cost dashboard (daily spend per feature)
- [ ] EAS build v1.1.0 → Play testing / production
- [ ] Update PRD and README; record demo video
- [ ] Retrospective: what slipped, what is next (iOS, groceries, more cities)

---

## Decisions Log

| Date | Decision | Affects |
|------|----------|---------|
| 27 Oct 2026 | Theme is "Sunrise" (PRD §14.1), not "Saffron Night" | Day 1 |
| 27 Oct 2026 | Auction bids stored in `bids` + `auctionDealers` (PRD §13); no separate `offers` collection | Days 1, 9, 18 |
| 27 Oct 2026 | Build started 27 Oct (planned 26 Oct) — schedule is one day behind | All |
| 30 Oct 2026 | Dealer login = email + password; business phone is a contact only (dealer phone OTP deferred) — pending Vishal's OK | Days 5, 9 |
| 30 Oct 2026 | Open question 5: early-start auction (≥70%) keeps the same rules and ceiling | Days 6, 9 |
| 30 Oct 2026 | Membership = paid token; new groups start at 0 members, leader pays to take a seat | Days 6, 7 |
| 30 Oct 2026 | Deadline at ≥70%: leader has 48 h to extend once (+7 days, capped at category max) or start early; else expired | Day 6 |
| 8 Nov 2026 | Open question 1: token is a part-payment of the bill; dealer gets token minus commission via Route (on hold) | Days 7, 9, 10 |
| 8 Nov 2026 | Open question 3: buyer convenience fee charged at purchase, ₹0 at launch | Days 7, 10 |
| 8 Nov 2026 | Open question 2: verified unrated dealers (< 3 reviews) may bid; 3.5 minimum once rated | Day 9 |
| 8 Nov 2026 | Open question 4: seller-led deal below its first tier at the deadline → expired, all tokens refunded | Day 9 |
| 8 Nov 2026 | Single dealer after the minimum-dealers extension → leader has 24 h to accept or cancel (refund all); no answer = cancel | Day 9 |
| 9 Nov 2026 | Unused deal code at price-validity end → hold reversed, refund minus back-out fee (reminder 48 h before) | Day 10 |
| 9 Nov 2026 | Invoice + 48 h with no dealer objection completes a purchase; AI invoice check added in front on Day 19 | Days 10, 19 |
| 9 Nov 2026 | QR libraries approved: react-native-qrcode-svg (mobile), jsqr (web) | Day 10 |
| 9 Nov 2026 | Commission invoices: printable web page (no PDF library); 18% GST on top of commission, SM/FY/seq numbering — pending CA confirmation | Day 10 |
| 12 Nov 2026 | Wallet credits earned + shown on Day 11; spending on tokens moved to Day 13 | Days 11, 13 |
| 12 Nov 2026 | Referral ₹100 + ₹100 on the friend's first completed purchase; leader bonus ₹500 when leader + 3 others bought (all editable) | Day 11 |
| 12 Nov 2026 | Dispute refunds: on hold / with SaathMein → full bank refund; released → wallet credits billed to the dealer | Days 12, 13 |
| 12 Nov 2026 | Rating penalty = one 1-star rating in the dealer average | Day 12 |
| 12 Nov 2026 | Winning dealer sees member phones only after the 24 h exit window (masked before) | Day 12 |
| 12 Nov 2026 | Legal pages drafted, marked pending legal review; details in web/src/utils/legal.js | Day 12 |
| 13 Nov 2026 | Wallet credit spending on tokens moved again, to Day 16 (after v1.0) | Days 13, 16 |
| 13 Nov 2026 | Owner push alerts go to the buyer-app account whose phone is set in Admin → Settings → Alerts; bell + email for all staff | Day 13 |
