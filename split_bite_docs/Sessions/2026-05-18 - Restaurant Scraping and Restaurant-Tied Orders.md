# 2026-05-18 - Restaurant Scraping and Restaurant-Tied Orders

## Summary
Shipped (locally) a restaurant catalogue powered by a Talabat scraper plus a new "restaurant-tied" order mode where item entry is locked to the restaurant's menu. Earlier in the session, Apple Sign-In dashboard prep was paused mid-flow (Apple Developer key creation blocked on the 2-key cap) and will resume after the scraping work proves out.

## What shipped

### Schema (migrations 00009, 00010 — local only for now)
- `restaurants`, `menu_categories`, `menu_items` — source-agnostic via `(external_source, external_id)`. RLS allows any signed-in user to SELECT; no write policies, so only the service-role key can mutate.
- `orders.restaurant_id uuid references restaurants(id) on delete set null` — optional. Existing free-form orders keep working with NULL.

### Scraper
`scripts/scrape-talabat.js` — local Node script (no native deps, just built-in `fetch` + the existing `@supabase/supabase-js`). Run as `npm run scrape:talabat -- <url>`. Pipeline:
1. Fetches the Talabat URL with realistic browser headers (plain `fetch`; no Cloudflare wall, no Playwright needed).
2. Extracts `<script id="__NEXT_DATA__">` blob.
3. Walks `props.pageProps.initialMenuState.{restaurant, menuData.categories}`.
4. Skips the synthetic `id: -1, "Picks for you 🔥"` personalised category.
5. Upserts by `(external_source, external_id)`.
6. Stamps `last_scraped_at`. Refuses re-scrape within 6h unless `--force`.

Service-role key resolution (priority): `scripts/.env.scraper.local` → `process.env` → `supabase status -o env` (local default).

Test against Gad (`branch 697415`): 25 real categories, 270 items, sub-2s.

### Picker UX (`src/components/orders/PickFromMenuSheet.tsx`)
Two modes via discriminated-union props:
- `mode="restaurant"` — restaurant picker; returns the chosen `Restaurant`.
- `mode="item"` (default) — item picker. Optional `restaurantId` prop skips the restaurant-list step and opens straight into that restaurant's menu.

Visual polish:
- Horizontal scrollable category cards under the search bar. Active card filled brand color.
- Tap card → `SectionList.scrollToLocation` jumps to the section.
- As user scrolls, `onViewableItemsChanged` updates the active card; the horizontal bar auto-scrolls so the active card stays visible.
- Item rows are cards with 72×72 thumbnails (falls back to a letter avatar). Live in-menu search filters across categories.

### App integration
- Create-Order screen: optional "Pick restaurant" step. Auto-fills title with restaurant name if user hasn't typed one.
- Order detail screen: tinted "Ordering from <restaurant>" banner with logo + cuisine when `restaurant_id` is set.
- Add Item modal: when restaurant-tied, free-text inputs are hidden; the picker is the only entry path. Picker opens scoped to that restaurant (no restaurant-list step). Fields appear pre-filled after picking and remain editable so users can tweak quantity wording / price.
- Free-form orders unchanged.

## Tests / quality
- 95 unit tests passing (same as previous session — no new unit tests added here, since the bulk of new logic is UI / SQL that's manual-tested).
- `tsc --noEmit` clean.

## What did NOT ship to production
Local-only validation. Migrations 00009 and 00010 are NOT on cloud. Scraped data is local-only. When ready to ship:
1. `supabase db push` — apply migrations to cloud.
2. Re-run `npm run scrape:talabat -- <url>` against cloud (set `scripts/.env.scraper.local` to cloud URL + service-role key first).
3. `npm run ota -- "<msg>"` — JS-only, OTA-eligible.

## Apple Sign-In status (paused)
Earlier in the session, design and Apple Developer config for Apple + Google social login was approved and partly executed:
- ✓ Sign in with Apple capability enabled on App ID `com.leopepsi2.splitbite`.
- ✓ Services ID `com.leopepsi2.splitbite.signin` created with Supabase return URL.
- ⏸ Apple Sign-In `.p8` key creation blocked — Apple's 2-key cap is full (`73M659HY23 (SA Egypt APNs)` + `CK6KKK4PUB (SplitBite APNs)`). Decided path **B**: revoke `CK6KKK4PUB`, create a new key with BOTH "Apple Push Notifications service" AND "Sign In with Apple" capabilities at once, then upload the new `.p8` to Expo (replaces existing APNs key) AND to Supabase (for Apple Sign-In). Same `.p8`, two purposes.
- ⏸ Google Cloud OAuth client IDs (iOS + Web), Supabase Apple+Google provider config, plugin add — all blocked on the same key flip.

Resume after scraping is shipped to cloud.

## Process notes
- Brainstorming gate respected on every feature in this session (scraping, restaurant-tied orders, picker polish). Specs at `01-requirements/2026-05-18-restaurant-menu-scraping-design.md`.
- Local-first validation strategy continues to be the right call — caught a Metro-cache footgun and a finalized_at NULL bug in earlier sessions without breaking production.

## Next Steps
- Phone smoke test the new picker UX (horizontal category cards, active sync, item thumbnails).
- If verified: `supabase db push` 00009 + 00010 → re-scrape Gad against cloud → OTA the JS.
- Resume Apple Sign-In via the combined-capability key flip described above.
