# SplitBite Dashboard

## Project Status
**Current Phase:** Restaurant catalogue live in production. Apple Sign-In still paused on the 2-key APNs cap.
**Last Updated:** 2026-05-19

## Recent
- **5/19 — In-app admin scrape + Price on Selection.** Profile → Admin tools → Restaurants screen lets `profiles.is_admin = true` users paste a Talabat URL and scrape server-side via the `scrape-talabat` Edge Function (Deno port of the local Node script). Migration 00011 adds the flag, 00012 makes `menu_items.price` nullable. Talabat items with `hasChoices && price=0` ("Price on Selection") now store `null`; picker shows "Price varies", AddItemModal leaves the price field empty so the user types it. Metro config added to keep `.env.cloud.local` out of the bundler. All shipped to cloud + OTA published (update group `50e79310-…`).
- **5/18 — restaurant scraping + restaurant-tied orders.** Migrations 00009 + 00010 add `restaurants`/`menu_categories`/`menu_items` + `orders.restaurant_id`. Talabat scraper at `scripts/scrape-talabat.js` pulls `__NEXT_DATA__` SSR JSON (no Playwright). Gad branch scraped: 25 categories, 270 items. New Pick-from-Menu sheet with horizontal category cards + active-scroll sync + item thumbnails. Shipped to cloud + production on 5/19. Spec at `01-requirements/2026-05-18-restaurant-menu-scraping-design.md`.
- **5/17 — Apple + Google social login paused mid-flow.** Apple Developer config: ✓ Sign in with Apple capability on App ID, ✓ Services ID `com.leopepsi2.splitbite.signin`. ⏸ Blocked on Apple 2-key cap — plan: revoke current APNs key `CK6KKK4PUB`, create new key with both APNs + Sign-in-with-Apple capabilities, upload to Expo + Supabase. Resume after scraping ships.
- **5/17 — Stats dashboard for Activity tab.** "What did I pay last 7d / 30d / All time, from where, on what." Backfill migration 00008 for orders.finalized_at (column existed but was never populated).
- **5/16 — Leave / Kick from order.** Self-leave for participants, creator can kick anyone else (open orders only). Migration 00007 adds delete policy. Entanglement check refuses if user has shared items with others.
- **5/15 — APNs key reset to `CK6KKK4PUB`** to fix `InvalidProviderToken`. Build 14 + plugin shipped notifications working in production.
- **5/14 — Build 14 (v1.0.1) shipped** to App Store. Bumped version after Apple closed the 1.0.0 train. iPhone-only, push working.
- **5/3–5/13 — Apple review fixes:** iPad dropped, expo-notifications plugin added, support URL fixed, defensive fixes to AuthProvider/Profile/Activity tabs.
- **5/3 — Foundation features**: custom (non-equal) item splits, guests as first-class participants, finalize-screen draft persistence.

---

## All Features Complete
- Auth (sign up with auto-login, sign in/out, account deletion)
- Groups (create, join via invite code, leave, kick members, delete group)
- Orders (create, add/edit/delete items for self/others, add guests, lock/reopen/delete)
- Unified item assignment (Just me / Everyone / pick specific people)
- Real-time collaboration (Supabase Realtime)
- Bill finalization (editable prices, tax/VAT/delivery/discount, multi-payer)
- Total & payment validation
- Order summary (full breakdown, who paid, per-person split, guest settlements)
- Group balances with per-order debt breakdown
- Settlement verification (beneficiary confirms, rejection notifies sender)
- Payment reminders (once per hour cooldown)
- Activity feed (paginated infinite scroll)
- Push notifications with deep linking
- Profile editing with name uniqueness check across groups
- OTA updates via EAS Update
- Rounding to nearest 0.5 EGP
- Restaurant catalogue (Talabat-sourced) + restaurant-tied orders
- In-app admin scrape (URL paste → server-side scrape via Edge Function)
- "Price on Selection" handling (null price → "Price varies" → user types it)
- 47 unit tests passing

---

## Migrations
| # | Description | Cloud? |
|---|------------|---|
| 00001 | Initial schema (11 tables + triggers + indexes) | ✓ |
| 00002 | RLS policies + helper functions | ✓ |
| 00003 | Pending settlements table | ✓ |
| 00004 | delete_user_account() RPC function | ✓ |
| 00005 | Fix guest cascade on order_participants | ✓ |
| 00006 | Fix `created_by default auth.uid()` on groups + orders | ✓ |
| 00007 | order_participants delete policy (self-leave / creator-kick) | ✓ |
| 00008 | Backfill orders.finalized_at NULLs | ✓ |
| 00009 | restaurants + menu_categories + menu_items + RLS | ✓ |
| 00010 | orders.restaurant_id (nullable, ON DELETE SET NULL) | ✓ |
| 00011 | profiles.is_admin (default false) | ✓ |
| 00012 | menu_items.price nullable (Price on Selection) | ✓ |
