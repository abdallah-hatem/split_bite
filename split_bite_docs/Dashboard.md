# SplitBite Dashboard

## Project Status
**Current Phase:** Restaurant catalogue / Apple Sign-In in flight — local-only for now
**Last Updated:** 2026-05-18

## Recent
- **5/18 — restaurant scraping + restaurant-tied orders (local).** Migrations 00009 + 00010 add `restaurants`/`menu_categories`/`menu_items` + `orders.restaurant_id`. Talabat scraper at `scripts/scrape-talabat.js` pulls `__NEXT_DATA__` SSR JSON (no Playwright). Gad branch scraped: 25 categories, 270 items. New Pick-from-Menu sheet with horizontal category cards + active-scroll sync + item thumbnails. Local-only validation; cloud push deferred. Spec at `01-requirements/2026-05-18-restaurant-menu-scraping-design.md`.
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
| 00009 | restaurants + menu_categories + menu_items + RLS | ✗ local only |
| 00010 | orders.restaurant_id (nullable, ON DELETE SET NULL) | ✗ local only |
