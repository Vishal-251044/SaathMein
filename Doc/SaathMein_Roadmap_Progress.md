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

- [ ] Mobile: phone number and OTP screens (Firebase Auth)
- [ ] Mobile: secure token storage (expo-secure-store), auth store, auto refresh
- [ ] Mobile: protected routes and logout
- [ ] Mobile: language picker on first launch
- [ ] Backend: `POST /auth/otp/verify` (Firebase ID token → own JWT, access 15 min, refresh 30 days with rotation)
- [ ] Backend: requireAuth and requireRole middleware (buyer, seller, staff)
- [ ] Backend: OTP abuse limits per phone and device
- [ ] Backend: admin auth `POST /admin/auth/login` + TOTP 2FA (otplib), 8 h staff session, 30 min idle logout
- [ ] Backend: requireStaff(role) for Owner, Admin, Deal Manager, Finance, Support
- [ ] Web: /admin/login page with 2FA step; admin layout shell
- [ ] Backend: `npm run create-owner` script from env secrets
- [ ] Data: unique index on users.phone
- [ ] Firebase: Phone Auth, SHA-1 / SHA-256 for debug and release keys
- [ ] Tests: token service and staff permissions

### Day 3 — Profile, City & Interest Onboarding (Wed 28 Oct)
**Done when:** a new user completes onboarding; city, budget, timeline and interests are stored; Hindi and Marathi screens display correctly.

- [ ] Mobile: onboarding city (location permission or manual), area / pincode
- [ ] Mobile: interest picker (categories → brands / products, budget slider, timeline)
- [ ] Mobile: profile edit (name, photo, language), delete account
- [ ] Mobile: home placeholder showing chosen interests
- [ ] Backend: `GET/PATCH /users/me`, `POST /users/me/interests`, `DELETE /users/me`
- [ ] Backend: Cloudinary signed upload for avatars
- [ ] Backend: demandSignals collection recording interests
- [ ] Cloudinary account and upload presets
- [ ] Seed: Pune cities and areas
- [ ] Seed: category tree with rules (token, sizes, deadlines, commission)
- [ ] Web: Admin Cities page

### Day 4 — Catalog: Categories, Products & Search (Thu 29 Oct)
**Done when:** admin imports products with a CSV; a user searches "activa" with a typo and opens the product page with its Pune price.

- [ ] Mobile: category grid on Home
- [ ] Mobile: product page (image carousel, variants, specs, city price)
- [ ] Mobile: "Start a group" CTA and open-groups section on product page
- [ ] Mobile: search screen with 300 ms debounce and recent searches
- [ ] Backend: `GET /categories`, `/products?q=`, `/products/:id`, `/cities`
- [ ] Backend: Atlas Search index (brand, model, tags) with text-index fallback
- [ ] Backend: priceHistory written on every price change
- [ ] Web: Admin Catalog categories with rules editor
- [ ] Web: Products CRUD with variants and city prices
- [ ] Web: bulk CSV import with failed-row report
- [ ] Data: import 300+ launch products (two-wheelers, mobiles, cars, ACs)
- [ ] Data: indexes products.slug, products.categoryId

### Day 5 — Dealer Login, Onboarding & Dashboard v1 (Fri 30 Oct)
**Done when:** a dealer signs up and logs in, finishes KYC, gets a Razorpay Route linked account in test mode and is approved in admin; the approval appears in the audit log.

- [ ] Mobile: seller profile card component (rating, verified badge, distance)
- [ ] Mobile: "Request a missing product" form
- [ ] Mobile: Home polish with real categories and products
- [ ] Backend: `POST /seller/register`, `POST /seller/kyc` (GST, PAN, address, photos, dealer proof)
- [ ] Backend: seller staff invites
- [ ] Backend: Razorpay Route linked-account creation (test mode)
- [ ] Backend: coverage cities + categories, sellers.geo 2dsphere
- [ ] Backend: admin approve / reject with reason; email notifications
- [ ] Web: dealer sign up, login (email / phone OTP + password), KYC wizard, profile, coverage, team
- [ ] Web: Admin Sellers KYC queue with document preview
- [ ] Backend: audit-log middleware (every admin write recorded)
- [ ] Razorpay test mode account; request Route activation

### Day 6 — Groups Core & Lifecycle State Machine (Sat 31 Oct)
**Done when:** a user creates a group, a second user finds it in the list and on the product page, and the deadline job expires a test group correctly.

- [ ] Mobile: create group flow (product / variant, target size, deadline, public or community)
- [ ] Mobile: "Join a similar group instead?" step
- [ ] Mobile: group page (people counter + progress bar, time left, members, status timeline)
- [ ] Mobile: group cards; My Groups tab (joined, leading)
- [ ] Backend: group state machine with guarded transitions (open → full → auction_live → won → purchasing → completed + runner_up, expired, no_deal, cancelled)
- [ ] Backend: `POST /groups`, `GET /groups` (filters), `GET /groups/:id`, `GET /groups/similar`
- [ ] Backend: community groups (invite code, join-by-code, leader approval)
- [ ] Backend: BullMQ jobs (deadline check, auction close)
- [ ] Data: indexes groups.{cityId, status, deadline}, groups.{productId, cityId, status}
- [ ] Data: unique index groupMembers.{groupId, userId}
- [ ] Tests: every state transition
- [ ] Web: Admin Groups list (read-only)

### Day 7 — Razorpay Payments, Refunds & Ledger (Sun 1 Nov · Power day)
**Done when:** in Razorpay test mode, three users pay tokens and join; one leaves and is refunded; an expired group refunds everyone; the ledger matches Razorpay exactly.

- [ ] Mobile: Razorpay React Native SDK in an EAS development build
- [ ] Mobile: join flow (token summary, refund rules, pay by UPI / card)
- [ ] Mobile: money timeline per group (paid, held, refunded, transferred) + receipts
- [ ] Mobile: leave group with refund preview
- [ ] Mobile: join waitlist when a group is full
- [ ] Backend: `POST /payments/order`, `/payments/verify` (HMAC signature)
- [ ] Backend: `/payments/webhook` for payment.captured, payment.failed, refund.*, transfer.*, settlement.processed (idempotent)
- [ ] Backend: join = payment + member + count in one MongoDB transaction
- [ ] Backend: refund service (leave open group, expired, no_deal, cancelled, back-out fee after lock)
- [ ] Backend: ledger service (append-only)
- [ ] Backend: Route transfer service (token minus commission, on hold, release / reverse)
- [ ] Backend: waitlist (freed seat offered to next user for 2 h)
- [ ] DevOps: webhook URL on a Render preview / public tunnel
- [ ] Backend: daily reconciliation job vs Razorpay settlements
- [ ] Tests: duplicate webhook, failed payment, every refund path
- [ ] Backend: commission rules per category read from settings

### Day 8 — Live Groups, Chat, Push & Sharing (Mon 2 Nov)
**Done when:** two phones see the counter change instantly when one joins; chat works; a push arrives when the group fills; a WhatsApp link opens the group in the app.

- [ ] Mobile: socket client (live counter, status changes, new-member animation)
- [ ] Mobile: group chat (text, images, polls for leader, pin, report)
- [ ] Mobile: push notifications (Expo Notifications + FCM) and notification centre
- [ ] Mobile: share to WhatsApp with deep link (expo-linking, Android App Links)
- [ ] Backend: Socket.io gateway (JWT auth, room per group, Redis adapter)
- [ ] Backend: chat messages API with rate limits and profanity filter
- [ ] Backend: notification service (push + in-app, quiet hours 10 pm – 8 am)
- [ ] Backend: deep-link route `/g/:code` → app or Play Store
- [ ] FCM credentials in Expo
- [ ] assetlinks.json for App Links on the domain
- [ ] Play Console: create the app; start internal testing
- [ ] Play Console: start closed testing (12+ testers for 14 days if personal account)

### Day 9 — Dealer Live Auction: Lowest Price Wins (Tue 3 Nov)
**Done when:** a full group of 5 test buyers gets live bids from 3 test dealers; each bid must beat the lowest; a last-minute bid extends the timer; at close the lowest dealer wins automatically and all 5 members get deal codes for that dealer.

- [ ] Mobile: live auction card (falling price, dealers bidding, time left, "₹X saved so far")
- [ ] Mobile: price-drop chart and "new lowest price" animation
- [ ] Mobile: winner screen (dealer name, address, rating, final price)
- [ ] Mobile: 24 h exit window with refund preview
- [ ] Mobile: seller-led deal page (tier ladder, "X more to unlock")
- [ ] Backend: group full → auction_live; notify eligible dealers (city, category, rating)
- [ ] Backend: `POST /seller/auctions/:groupId/join` (commitment) and `/bids` (ceiling, min step, breakdown totals, atomic lowest-price update)
- [ ] Backend: socket events auction:lowest, auction:extended, auction:won; outbid push + email
- [ ] Backend: auction close job (exactly once; lowest wins, earliest on tie; deal codes for all members)
- [ ] Backend: anti-sniping, minimum-dealers rule, runner-up fallback
- [ ] Backend: `POST /seller/deals` with tiers; automatic tier-unlock broadcast
- [ ] Web: dealer Live auctions list and Upcoming groups
- [ ] Web: dealer bid screen (price + breakdown, current lowest, my rank, timer)
- [ ] Web: dealer Won groups with members and deal codes
- [ ] Tests: concurrent bids, tie, extension, runner-up, 0 / 1 dealer

### Day 10 — Deal Codes, Purchases & Commission (Wed 4 Nov)
**Done when:** the winning dealer scans a deal code; the purchase completes; the Route hold is released to the dealer minus commission in test mode; the buyer gets a saving card and leaves a review.

- [ ] Mobile: deal-code ticket (QR + code, seller, price, validity)
- [ ] Mobile: upload invoice photo
- [ ] Mobile: "You saved ₹X" share card
- [ ] Mobile: review the seller after purchase
- [ ] Backend: unique signed deal codes for every member when the auction is won
- [ ] Backend: `POST /seller/purchases/confirm` (scan or enter code)
- [ ] Backend: completion rules (seller confirms, or invoice + 48 h with no objection)
- [ ] Backend: auction won → Route transfers on hold; completion → hold released, commission entry, review request
- [ ] Backend: monthly commission invoices with GST numbering
- [ ] Web: seller Purchases (scan QR with webcam or enter code)
- [ ] Web: seller Payouts page
- [ ] Web: Admin Commissions page
- [ ] Tests: commission math for every category

### Day 11 — Discovery, Home Feed & Community Groups (Thu 5 Nov)
**Done when:** Home shows real ranked sections for Pune; a society group is joinable only with its code; referral credits appear after a referred purchase.

- [ ] Mobile: Home sections (Near you, Ending soon, Almost full, Seller deals, Trending, Categories)
- [ ] Mobile: filters (category, area, price, group size, time left, type)
- [ ] Mobile: community private group, invite code / QR, approve members
- [ ] Mobile: referral link and wallet screen
- [ ] Backend: `GET /feed/home` with rule-based ranking v1
- [ ] Backend: Trending = joins in last 48 h, cached in Redis (5 min)
- [ ] Backend: referral and wallet credits service
- [ ] Backend: group-leader bonus on completion
- [ ] Web: Admin Curation (banners, featured deals, category order)
- [ ] Web: Admin Settings (fees, token per category, back-out fee, bidding hours, feature flags)

### Day 12 — Trust, Reviews, Reports & Disputes (Fri 6 Nov)
**Done when:** a buyer opens a "price not honoured" dispute; the seller responds; Support decides a refund; the refund and the seller penalty are both logged.

- [ ] Mobile: report a group, member, seller, message or review
- [ ] Mobile: disputes (open with evidence, timeline, status)
- [ ] Mobile: seller profile (rating, reviews, verified badge)
- [ ] Backend: reviews API (completed buyers only) and rating aggregates
- [ ] Backend: reports + disputes API with timeline; 48 h seller SLA job
- [ ] Backend: seller penalties (warning, rating penalty, bidding suspension)
- [ ] Backend: privacy — phone numbers hidden until acceptance
- [ ] Web: Admin Disputes and Reports queue with evidence viewer
- [ ] Web: seller respond to disputes
- [ ] Web: legal pages (terms, privacy, refund policy, grievance officer)

### Day 13 — Full Owner Console & Live Monitoring (Sat 7 Nov)
**Done when:** the Owner watches a test auction live with dealer names, sees payments, holds and refunds on the Payment monitor, receives an alert when a webhook fails, cancels a test group (everyone refunded) and every action appears in the audit log.

- [ ] Mobile: loading skeletons, empty and error states on all screens
- [ ] Mobile: offline cached screens and retry banners
- [ ] Backend: `/admin/monitor` (overview, groups, auctions, payments, dealers, buyers, system health — live via sockets)
- [ ] Backend: auction actions (pause, extend, cancel, force runner-up — reason required)
- [ ] Backend: Razorpay monitor data (success rate by method, refunds pending / failed, holds, webhook failures, reconciliation)
- [ ] Backend: alert rules (payment, auction, suspicious bidding, reconciliation, system) → console + email + push
- [ ] Backend: permission matrix per route + tests (Support gets 403 on Payments, Settings, Team)
- [ ] Web: Admin Overview dashboard with live charts
- [ ] Web: Auction monitor with full bid timeline
- [ ] Web: Payment, Dealer, Buyer monitors, System health
- [ ] Web: Alerts centre; Team invites and roles; Audit log viewer; CSV export

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
