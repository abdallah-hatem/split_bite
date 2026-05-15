# SplitBite Dashboard

## Project Status
**Current Phase:** MVP Complete — App Store resubmission (iPhone-only, push working)
**Last Updated:** 2026-05-13

## Recent
- **APNs key reset 5/15:** even after build 14 lined up Key IDs, push delivery still failed (`InvalidProviderToken`) because the `.p8` Expo had didn't cryptographically match Apple's public key for that ID. Revoked the bad key, created a fresh one (Key ID `CK6KKK4PUB`), re-uploaded `.p8` to Expo. Receipt comes back `status: "ok"`. No rebuild needed — same Expo push tokens stay valid through APNs key rotations.
- **Build 14** (5/14, v1.0.1): bumped app version after Apple closed the 1.0.0 train (a 1.0.0 build had been approved). Shipped with `expo-notifications` plugin + iPhone-only.
- **Build 13** (5/13): added `expo-notifications` to `app.json` plugins — the native APNs entitlement was missing in earlier builds, which is why push worked in Expo Go but was dead in production. Submit rejected though, see build 14.
- Known OTA blocker logged: `src/lib/supabase.ts` `localStorage` access fails during SSR web export; one-line fix deferred until OTA is actually needed.
- Build 12 (5/4): iPhone-only after second iPad-specific rejection; defensive fixes to AuthProvider/Profile/Activity tabs.
- Custom (non-equal) item split shipped (add-only); spec at `01-requirements/2026-05-03-custom-split-design.md`.
- Guests now first-class participants: removed host-transfer in calc engine; preview/summary show guests with their own net; layout fix for Who Pays Who row.
- `CLAUDE.md` created with strict git rule and project conventions; now also documents push notification + OTA pitfalls.

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
| # | Description |
|---|------------|
| 00001 | Initial schema (11 tables + triggers + indexes) |
| 00002 | RLS policies + helper functions |
| 00003 | Pending settlements table |
| 00004 | delete_user_account() RPC function |
| 00005 | Fix guest cascade on order_participants |
