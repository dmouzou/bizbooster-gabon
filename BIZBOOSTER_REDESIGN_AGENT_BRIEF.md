# BIZBOOSTER Gabon: Mobile Redesign and Optimization (Agent Brief)

Repo: `dmouzou/bizbooster-gabon` (branch `main`). Language of UI copy: French. Market: Gabon only, currency FCFA.
Visual reference mockup (2 artboards, home and cards): https://claude.ai/artifact/GK9girpssKkhmNKosuBj8x
Everything needed is also specified inline below. If the link is unreachable, the inline spec wins.

## 0. How to work

- Read this file fully, then inspect the repo before changing anything. This brief was written from `package.json`, `vite.config.ts`, `index.html`, `src/index.css`, `src/components/AdCard.tsx` and file sizes only. `App.tsx`, `services/`, `utils/` and `functions/` were NOT read. Verify every assumption marked **VERIFY**.
- Work in phases (section 8). You may push directly to `main`. Small, atomic commits with conventional messages (`feat(ui): ...`, `perf: ...`). Wherever this brief says "PR", read "the body of the commit message for that push".
- Before every push: `git pull --rebase origin main`, then `npm run lint`, `npm test`, `npm run build`. If rules or Functions changed: `npm run test:rules` (needs the Firebase emulator) and the functions lint (`functions` predeploy ESLint). Push only when everything is green.
- **First action: read `.github/workflows/*` and `DEPLOYMENT.md`.** Commit `899d1e2` mentions automated deploy in CI/CD. If a push to `main` deploys to production, then every push is a production release. In that case:
  - Push one phase milestone at a time, never a half-finished screen. Gate unfinished UI behind a flag or keep it unreachable until its phase is complete.
  - Keep changes to `firestore.rules`, `storage.rules` and `functions/` in their own commits, separate from UI commits, so each can be reverted alone.
  - After each push, wait for CI to finish and confirm it passed before the next push. If CI or the deploy fails, fix or `git revert` immediately before doing anything else.
- Never force push, never rewrite history on `main`, never edit secrets, `.env` files or production config, never run deploy commands by hand. Deployment happens only through the existing CI/CD.
- When a requirement conflicts with a hard constraint (section 2), the constraint wins. Note the conflict in the PR.
- Ask a human only when blocked on a decision that changes product behavior. Otherwise decide, state the assumption in the PR description, continue.
- Do not add dependencies without a one line justification in the PR. Prefer removing dependencies.

## 1. Goal and success metrics

Make the public mobile experience fast, clear and usable by non-technical users on mid-range Android over 3G/4G.
"100% better" means these measurable targets, measured on the home route, mobile profile, Slow 4G, 4x CPU slowdown:

| Metric | Target |
|---|---|
| LCP | < 2.5 s |
| INP | < 200 ms |
| CLS | < 0.1 |
| Initial JS (home route, gzip) | < 150 KB |
| Card image weight | <= 40 KB each (thumbnail) |
| Lighthouse mobile performance | >= 90 |
| Lighthouse accessibility | >= 95 |
| Tap targets | >= 44 x 44 px |
| Minimum text size | 12 px (body 14 px) |

Record the baseline first (Phase 0) and report before/after in every PR.
Test viewports: 360x640, 390x844, 412x915. Also check 768 and 1280 (desktop must not break).

## 2. Hard constraints (do not break)

Business rules that already exist. Do not change behavior, only presentation.

- **Payments.** A user may pay with a mobile money number different from their registered one (for example registered on Airtel, paying from Moov). The payer confirms with their PIN on the USSD push. Do not add any rule requiring the payer number to match. Do not change payment logic in `functions/` beyond status reporting. Moov is on standby.
- **No free ads.** New users get no free ads or boosters unless via an offer or coupon. Paid subscribers get free ads automatically. UI must reflect server quotas, never compute entitlement client-side.
- **Photo allowances** follow the server: 3 (Standard, Pro), 4 (Elite), 5 (Business). Read them from the server/config used today. Existing client cap of 10 photos in `EditAdModal` stays as is.
- **Ad visibility.** Only ads labelled "test ads" are shown/hidden by the super admin setting. Every ad from a registered user must be visible unless an admin deletes it in the admin panel. Do not add client-side hiding beyond past events (`isEventPast`) and existing expiry logic.
- **KYC.** ID images must NOT be deleted after review. Access control only. Do not touch `/kyc` storage behavior.
- **`contactName`** is locked once the advertiser is KYC verified (verified badge must match the verified name). Keep it locked in any new profile/publish UI.
- **Password** minimum stays 6 characters.
- **Active ads** are edited through the `resubmitAd` callable. Rules block direct client edits. Keep that flow.
- **Firestore and Storage rules: additive changes only.** An earlier strict change blocked ad publishing because the client writes fields such as `createdAt` and the ad `id`, and had to be reverted. Prefer server-side fixes. Any new field that the client must not write (thumbnails, blurhash) must be written by a Cloud Function with the Admin SDK. Any rules change needs a rules test and a passing `test:rules` run. Commit `76a8b50` notes rules tests were previously not executed (emulator absent). Fix that in CI.
- **Gabon only.** Do not build country selectors or multi-country UI. Backend Twilio multi-country OTP stays dormant in the UI.
- **Admin app** (`/admin`, `AdminPanel.tsx`, `TwilioAdminPanel.tsx`) is out of scope for redesign. Only ensure admin code never enters the public bundle.
- **Copy.** French. No em dashes in any copy or comments you write.

## 3. Current stack and findings

Stack: React 19, Vite 6, Tailwind v4 (`@tailwindcss/vite`), Firebase 12 (Firestore, Storage, Auth phone, Functions), `lucide-react`, `motion`, `recharts`, `canvas-confetti`. Separate admin build in `/admin`. Functions in `/functions` (TypeScript, SingPay, Twilio Verify v2).

Large files (bytes): `AdminPanel` 220k, `PublishAdModal` 187k, `UserDashboard` 123k, `App.tsx` 111k, `EditAdModal` 91k, `PhoneAuthModal` 56k, `AdDetailModal` 47k, `InAppNotificationModal` 31k, `MobilePaymentSimulator` 31k, `AdCard` 28k.

Findings:
1. `vite.config.ts` has a single manual chunk (Firebase). No vendor chunks for react, motion, recharts.
2. `package.json` lists `docx`, `pdfkit`, `express`, `dotenv` as frontend dependencies. **VERIFY** none are imported client-side; move to `functions` or `devDependencies`.
3. `AdCard`: two full images per card (blurred duplicate behind the main image), up to ~8 stacked badges on the photo, `backdrop-blur` on many elements, no `React.memo`, raw full-size image URLs (no thumbs, no `srcset`), remote Unsplash fallback, JS touch swipe inside a scrolling list, 10 to 11 px text, favorite button about 28 px, `alert()` for errors, emojis as icons.
4. `index.html`: no `theme-color`, no manifest, no service worker, no preconnect.
5. **VERIFY** in `App.tsx`: whether all ads are loaded at once and filtered client-side, how many `onSnapshot` listeners exist, how category counters are computed.
6. Modals already use safe-area padding (`.app-modal-overlay` in `index.css`). Keep that pattern for bottom sheets.

## 4. Design system

Define tokens in `src/index.css` via Tailwind v4 `@theme`. Light theme only for now.

Colors:
- Primary `#047857` (hover `#065F46`), primary soft `#ECFDF5`, on-primary `#FFFFFF`
- Text `#0F172A`, muted `#475569`, border `#E2E8F0`, surface `#FFFFFF`, page `#F6F7F5`, placeholder `#DCE3EA`, chip/secondary bg `#F1F5F9`
- Sponsored: border `#B45309`, soft bg `#FFFBEB`, text `#92400E`
- Nécrologie: bg `#0F172A`, accent text `#FCD34D`
- Événement: soft bg `#FDF4FF`, text `#701A75`
- Danger `#B91C1C`. All text/background pairs must pass 4.5:1.

Type: Inter (weights 400, 600, 700, 800), self-hosted subset woff2 with `font-display: swap`, system stack fallback. Sizes: price 21/800, section title 17/800, card title 15/700, body 14/400, meta 13, label/pill 12/700. Never below 12 px.

Shape: card radius 20, buttons/inputs 14, chips 22 (pill), pills 9. Page gutter 16. Gap between cards 16. Shadow only on the raised Publier button and sheets.

Icons: `lucide-react` named imports only. No emojis in UI. Icon size 20 default, 24 in nav.

Primitives to create in `src/components/ui/`: `Button` (primary, secondary, whatsapp, dark; 48 px high), `IconButton` (44 px), `Chip` (44 px high), `Pill`, `Sheet` (bottom sheet, mobile; centered dialog at >= 640 px), `Toast` (replaces every `alert()`), `Skeleton`, `EmptyState`, `Price`, `ResponsiveImage`.

Rules:
- Every interactive element is a real `button` or `a`. Visible focus ring. `aria-label` on icon-only buttons.
- Respect `prefers-reduced-motion`. No `backdrop-blur` on list items. No hover-only affordances (hover enhancements are desktop extras).
- Safe areas: use `env(safe-area-inset-*)` on bottom nav and sheets.

## 5. Screen specs (mobile first, 390 wide reference)

### 5.1 App shell (replaces current mobile header and `MobileArcCategoryMenu`)
- Top bar: wordmark (reuse `BizboosterLogo`) left, notifications `IconButton` right (opens existing `InAppNotificationModal` content as a full-screen sheet on mobile).
- Search row: text input (48 px high, placeholder "Rechercher une annonce") plus a 48 px filter button opening the filter sheet. Debounce 250 ms.
- Category chips: horizontal scroll, snap, hidden scrollbar. Order: Tout, Immobilier, Véhicules, Emploi, Événements, then the remaining categories (Bric-à-brac, Nécrologie, Avis de recherche, etc.) using the existing category source of truth. Selected chip is primary filled.
- Bottom tab bar (mobile only, hidden at >= 1024): Accueil, Recherche, Publier (raised 56 px circular primary button, center), Favoris, Compte. Height 80 incl. safe area. Active color primary, inactive muted. Publier opens the publish flow. Compte opens `UserDashboard` (or phone auth if logged out).
- Desktop (>= 1024): keep a top nav and multi-column grid (2 to 4 columns). Do not regress it.

### 5.2 Feed card (`AdCard`, rewrite)
Structure, top to bottom:
1. Photo 16:10, flat `#DCE3EA` placeholder until loaded. Overlays: transaction badge top-left (white pill, 12/700; uses `getAdTransactionBadge`), favorite `IconButton` top-right (44 px), photo counter pill bottom-right (dark). Max 2 overlays plus favorite. Category-specific chips (propertyType, vehicle category, profession, etc.) move into the body, not onto the photo.
2. Body (padding 14, gap 8): price (primary, 21/800, with unit suffix in muted 14/600 via existing `formatAdPrice`, `formatPriceUnit`), title (15/700, 2 lines), one location line with map-pin icon (`province · city · neighborhood`, truncated), meta row: "Vérifié" pill (shield icon, soft green) left, remaining time right (13 muted).
3. Actions: primary WhatsApp button (flex 1, 48 high) plus 48 px square call button. Owner actions (Modifier, Prolonger) appear in `UserDashboard` cards, not the public feed.
4. No description on the card. Remove the 300-char description block.
Behavior: whole card tappable (opens detail), `recordAdInteraction` still fires, button clicks `stopPropagation`. `React.memo` with a stable comparator. No JS swipe: photo changes happen in the detail gallery.
Category variants share the same skeleton:
- **Nécrologie**: dark ribbon "Avis d'obsèques" + "Diffusion nationale", name (17/800), "Veillée : lieu · date", no price, actions "Condoléances" (dark/amber) and "Famille".
- **Avis de recherche**: red ribbon, no price, actions "Signaler" and "Urgence", reward pill when `hasReward`.
- **Événement**: 64 px date block (day big, month 12/700, fuchsia soft), event type as title, venue, "Entrée libre" when price is 0, single full-width "Contacter l'organisateur" button.
- **Sponsorisée/boosted**: 2 px amber border and "Sponsorisée" pill. VIP keeps its badge but in the body.

### 5.3 Compact card (`AdCardCompact`, new, for search results and favorites list)
Row layout: 104 px square thumbnail left; right column: price (17/800), title (14/700, 2 lines), location (13 muted), bottom row with Vérifié pill and a 44 px WhatsApp icon button. Sponsorisée variant adds amber border and pill. Provide a list/grid toggle in search results (default compact).

### 5.4 Ad detail (new route/page on mobile, `AdDetailModal` stays for desktop)
- Full-screen page with back button. Gallery uses CSS scroll-snap (no JS touch handlers), counter pill, pinch-zoom lightbox optional.
- Content order: price, title, badges, key facts grid (category specific, reuse existing data fields), description (expandable after 6 lines), seller block (verified badge, `VerifiedAdvertiserModal` as sheet), location, report link (`ReportAdModal` as sheet), share (`ShareAdModal` as sheet).
- Sticky bottom action bar (safe-area aware): WhatsApp (primary, flex 1) + Appeler. Nécrologie/Avis variants use their contextual labels.
- Deep link: `#ad-<id>` (or router path). Back button restores feed scroll position.

### 5.5 Filter sheet (replaces `ImmobilierFilterBar`, `VehiclesFilterBar`, `EmploiFilterBar`, `TutoringFilterBar`, `NecrologieFilterBar` on mobile)
One `FilterSheet` driven by a per-category config object (fields, types, options). Sections collapse. Sticky footer: "Réinitialiser" and "Voir N résultats" (primary). Active filters appear as removable chips under the search bar. Desktop may keep inline bars that read the same config.

### 5.6 Publish flow (refactor `PublishAdModal`, 187 KB)
Full-screen stepper on mobile, dialog on desktop. Steps: 1 Catégorie, 2 Photos, 3 Détails, 4 Prix et durée, 5 Aperçu, 6 Paiement (when required). Progress bar and back at top, sticky primary "Continuer" at bottom.
- Fields come from a per-category schema (`src/features/publish/schemas/*`), not from one giant component. Preserve every existing field, validation, payload shape, quote logic (`quoteReady` guard), payment lock-on-close behavior and photo memory handling.
- Photos: camera or gallery picker, client-side compression to WebP, longest side 1280, quality ~0.8, before upload. Show per-photo progress and remove/reorder. Enforce allowance from server.
- Autosave draft to `localStorage` (this is the real app, not an artifact) with restore prompt.
- Payment step: show USSD push waiting state, live status via listener on the payment doc, clear timeout and retry states, copy explaining the payer confirms with their PIN on their phone. Do not restrict the payer number.
- Preserve `eventData` handling for Événements and `resubmitAd` whitelists.

### 5.7 Account and auth
- `UserDashboard` (123 KB): mobile pass. Tabs become a segmented control, ad cards use compact layout with owner actions (Modifier, Prolonger, Réactiver), status badges (`PENDING_PAYMENT`, `PENDING_REVIEW`, expired) never mislabeled.
- `PhoneAuthModal`, `KycUploadModal`, `ExtendAdModal`, `ReactivateAdModal`, `SubscriptionUpgradeModal`, `UserPreferencesModal`, `CguModal`, `ReportAdModal`, `ShareAdModal`: render as bottom sheets on mobile using `Sheet`. Logic unchanged.

## 6. Frontend performance work

1. **Image pipeline (largest win).**
   - Client: compress before upload (see 5.6).
   - Server: Storage-trigger Cloud Function generates `thumb` (400 px wide, WebP) and `medium` (800 px, WebP) and a tiny dominant color, and writes `thumbUrl`, `mediumUrl`, `dominantColor` onto the ad doc with the Admin SDK (client cannot write them under current rules; do not loosen rules). **VERIFY** the Storage path layout and how to map a file to its ad id.
   - Set `Cache-Control: public, max-age=31536000, immutable` on uploaded objects.
   - Render: `ResponsiveImage` uses `thumbUrl` (feed), `mediumUrl` (detail), falls back to `images[0]` for legacy ads. Explicit width/height or aspect-ratio to prevent CLS, `loading="lazy"` and `decoding="async"`, `fetchpriority="high"` only on the first card, solid `dominantColor` background while loading.
   - Delete the blurred duplicate image and the Unsplash fallback. Use a local inline SVG placeholder.
   - Optional backfill script (`scripts/backfill-thumbs.ts`) for existing ads, run by a human.
2. **Rendering.** `React.memo` cards, stable callbacks, `content-visibility: auto` with `contain-intrinsic-size` on cards, infinite scroll via IntersectionObserver (page size 12), skeletons during loads, `useDeferredValue` for search/filter, lift single modal state out of each card (the verified modal currently lives per card).
3. **Bundle.**
   - Route-level code splitting. Split `App.tsx` into `pages/` (Home, Search, Detail, Favorites, Account), `features/` (feed, filters, publish, auth) and hooks.
   - `manualChunks`: `vendor-react`, `vendor-firebase`, `vendor-motion`, `vendor-charts`. Lazy-load `canvas-confetti`, `recharts`, and `motion` (use `LazyMotion` if kept).
   - Remove `docx`, `pdfkit`, `express`, `dotenv` from frontend deps if unused client-side.
   - Add `rollup-plugin-visualizer` (script `npm run analyze`) and confirm no `AdminPanel`/`TwilioAdminPanel` code in the public bundle.
   - Keep demo ads as a dynamic import (already done in Lot 8).
4. **PWA.** `vite-plugin-pwa`: manifest (name BIZBOOSTER, `lang: fr`, theme `#047857`, 192/512 and maskable icons), service worker with precached shell, stale-while-revalidate runtime cache for ad images (cap entries), offline fallback screen, install prompt after the second visit. Add `theme-color`, `apple-touch-icon`, `preconnect` to Firebase endpoints in `index.html`. Do not cache Firestore API or payment calls.
5. **Low data.** Honor `navigator.connection.saveData`: use `thumbUrl` everywhere, disable autoplay/motion. Keep `viewport-fit=cover`.
6. **CI gates.** Lighthouse CI on the home route (mobile) and `size-limit` on the initial chunk. Fail the build over budget.

## 7. Backend work

1. **Pagination and queries (VERIFY current behavior first).** Query by category server-side, `orderBy` + `limit(12)` + `startAfter`. Use existing indexes in `firestore.indexes.json`, add composite indexes only as needed (additive). Replace client-side counting of categories with `getCountFromServer` aggregation or a maintained counter doc written by Functions.
2. **Listeners.** No whole-collection `onSnapshot`. Realtime only for: current user's ads, payment doc being awaited, notifications.
3. **Offline cache.** Initialize Firestore with `persistentLocalCache` and multi-tab manager.
4. **Functions.** Set `minInstances: 1` on hot callables (`initiateSingPayPayment`, `approveAd`, `resubmitAd`) via per-function options, review region vs users, keep `setGlobalOptions` caps. No business logic changes.
5. **Search.** Phase 1: add normalized keyword fields written by a Function on ad create/update. Phase 2 (separate decision, do not build now): external search engine.
6. **Observability.** Firebase Performance Monitoring and `web-vitals` reporting to Analytics; Sentry (or equivalent) with release tagging; alert on payment failures and `NEEDS_REVIEW` payments (Functions logging with structured fields).
7. **Rules.** Only additive. Add tests for any new rule. Run `test:rules` in CI with the emulator.

## 8. Work plan and acceptance criteria

**P0 Baseline (no UI changes).** Add Lighthouse CI config, `analyze` script, `web-vitals`. Produce `docs/perf-baseline.md` with: bundle sizes per chunk, Lighthouse mobile scores for home, feed query count and read counts, answers to all **VERIFY** items. Accept: report merged, numbers reproducible by command.

**P1 Quick wins.** Dependency cleanup, vendor chunks, `index.html` meta and preconnect, PWA manifest + SW, image compression on upload, thumbnail Function + `ResponsiveImage`, remove blur duplicate and Unsplash fallback, `React.memo` on `AdCard`, replace `alert()` with `Toast`. Accept: initial JS and LCP improved vs baseline, card image <= 40 KB for new ads, legacy ads still render, no rules changes.

**P2 Design foundation.** Tokens in `@theme`, `ui/` primitives, Inter self-hosted, replace emojis with icons, enforce 12 px minimum and 44 px targets in shared components. Accept: Storybook-free visual check page `/__ui` (dev only) showing all primitives, axe has no critical issues.

**P3 Shell and feed.** App shell, bottom tab bar, search row, chips, new `AdCard` and variants, `AdCardCompact`, skeletons, infinite scroll, server pagination, category counters via aggregation. Accept: matches section 5.1 to 5.3 at 360/390/412, feed scroll stays 60 fps on throttled CPU, no horizontal scroll, desktop grid intact.

**P4 Detail page and routing.** Section 5.4 with scroll position restore and deep links. Accept: share links open the right ad, sticky action bar never covers content, gallery works by swipe with no JS handlers.

**P5 Filter sheet.** Section 5.5 with config-driven fields for Immobilier, Véhicules, Emploi, Tutoring, Nécrologie, Événements. Accept: every filter that exists today still exists, result counts correct, active chips removable.

**P6 Publish stepper.** Section 5.6. Accept: payload byte-identical to today for the same inputs (add snapshot tests), quote/payment flow and close-lock unchanged, draft restore works, photo allowance enforced from server, all categories publishable on a 360x640 device.

**P7 Account and sheets.** Section 5.7. Accept: all listed modals are bottom sheets on mobile, no clipped content under the notch or keyboard.

**P8 Backend tuning.** Section 7 items 3 to 6. Accept: documented read-count reduction, cold-start improvement on hot callables, alerts configured (as code or documented steps).

**P9 Hardening.** Delete dead code, finish splitting `App.tsx` and `UserDashboard.tsx`, a11y pass (keyboard, screen reader labels, contrast), enable CI gates from section 6.6, final before/after report. Accept: all section 1 targets met or exceptions documented with cause.

## 9. Definition of done (every push to main)

- Lint, unit tests and build pass locally and in CI. Rules tests pass if touched.
- Before/after numbers for any perf claim.
- Screenshots at 360, 390 and 768 for UI changes, saved under `docs/redesign/` (not committed if large; list them in the commit body otherwise).
- No hard constraint from section 2 violated. State this explicitly in the commit body.
- No new `alert()`, no emojis as icons, no text below 12 px, no tap targets below 44 px.
- Commit body lists assumptions and any **VERIFY** answers found.
- Keep `docs/redesign/LOG.md` updated after each push: what shipped, CI result, anything reverted, what is next. A human reads this log instead of PRs.
