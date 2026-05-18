# 2026-05-19 - In-App Admin Scrape and Price on Selection

## Summary
Took the restaurant catalogue from local-only to live in production. Built an in-app admin "add restaurant by URL" flow (Edge Function + admin gate) so scraping no longer needs a maintainer's Mac. Then fixed the "Price on Selection" data gap that was making variably-priced items appear free.

## What Was Done

### In-app admin scrape
- **Migration 00011** adds `profiles.is_admin boolean default false`. Promotion is out-of-band via SQL — there is intentionally no UI for granting admin.
- **Edge Function `scrape-talabat`** (Deno) — port of `scripts/scrape-talabat.js`. Caller's JWT verifies `is_admin = true` against `profiles`; if ok, a service-role client does the upserts (bypassing RLS on the catalogue tables). Auto-populated `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — no secrets to set.
- **Hooks**: `useIsAdmin` reads the flag for the current user; `useScrapeRestaurant` invokes the function; `useDeleteRestaurant` does a direct RLS-gated delete.
- **Screens**: `app/(tabs)/profile/admin-restaurants.tsx` (URL input + list with refresh/delete icons). Profile screen shows an "Admin tools" section only when `is_admin === true`.

### Price on Selection
Talabat marks variably-priced items (size/options drive the cost) with `hasChoices: true` and `price: 0`. We were storing them as `0`, making them look free in the picker. Of 20 shawerma items at Anas Al-Demeshky, 19 fell into this bucket — skipping them wasn't viable.

Fix:
- **Migration 00012** drops `NOT NULL` on `menu_items.price`.
- **Scraper** (both `scripts/scrape-talabat.js` and the Edge Function) emits `null` when `hasChoices && price=0`. Real zero-priced items (none observed) would still write `0`.
- **`MenuItem.price`** is now `number | null` end-to-end.
- **PickFromMenuSheet** shows an italic muted "Price varies" badge in place of the EGP amount when price is null.
- **AddItemModal**: when the picked item has null price, `setPrice("")` instead of `0.00`, so the price field is empty for the user to type the actual amount from the receipt.

### Operational
- **`metro.config.js`** added with `resolver.blockList = [/\.env\.[^/]+\.local$/]` so Metro stops trying to parse `.env.cloud.local` as JavaScript (fatal SyntaxError on dev server start otherwise).
- **`tsconfig.json`** excludes `supabase/functions/**` from the main project (Deno runtime, different imports — would error against Node typecheck).
- **`useRestaurants` Restaurant type** gained `url` and `last_scraped_at` columns so the admin screen can show "last scraped Xh ago" and refresh by stored URL.

## Decisions Made
- **Admin gate via DB flag, not custom claims** — simple boolean column on `profiles`, queried by hook + double-checked inside the Edge Function. Avoids the JWT-refresh dance for changing admin status.
- **`null` price, not sentinel 0** — required `NOT NULL` drop. Sentinel 0 would be ambiguous against a hypothetical real free item; null is the correct "unknown" signal.
- **Picks for you (id: -1) stays filtered out** — user noticed the absence and asked. Confirmed it's algorithmic recommendations that duplicate items from real categories; including it would create dupes that shift per session. Documented in scraper code comments + this session note.

## Production Rollout
Sequence (same order, same pattern as last cloud-bound feature):
1. `supabase db push` — applies 00011 + 00012 to cloud (additive: new boolean column, drop NOT NULL).
2. `supabase functions deploy scrape-talabat`.
3. Flip `is_admin = true` for the production maintainer account via Studio SQL.
4. Swap `.env` to cloud values from `.env.cloud.local` (reminder: backed up the local one as `.env.local.local` first).
5. `npm run ota -- "menu price-on-selection: null prices + UI prompt"`.
6. Swap `.env` back to local.

OTA published as update group `50e79310-ea36-4ef3-bc88-c64da4dd0da5` (runtime 1.0.1, both platforms).

## Issues Encountered
- **Metro tried to bundle `.env.cloud.local`.** Bundler treated the dotted backup file as JS source and threw `SyntaxError: Missing semicolon`. Fixed with the `metro.config.js` blockList regex.
- **Local edge-function `supabase functions serve` died twice** between sessions, both times after running another `supabase` command that disrupted the local stack. Re-issuing `supabase functions serve` brought it back. Doesn't affect production.
- **`supabase projects api-keys` blocked by auto-mode classifier** the first time (live prod credentials). User explicitly re-authorized; the command then printed the cloud anon key, which got written into `.env` + `.env.cloud.local` (both gitignored).

## Next Steps
- Refresh existing production restaurants (Gad, Chunkys, Anas Al-Demeshky) from the admin panel — the previously-scraped items with `price = 0` from those still need to be rewritten as null. One tap per row.
- Resume Apple Sign-In: still blocked on the 2-key cap; plan unchanged (revoke `CK6KKK4PUB`, create combined APNs + Sign in with Apple key).
- Receipt OCR feature (from project memory) — pre-design / ideation only.
