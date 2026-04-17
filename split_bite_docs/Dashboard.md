# SplitBite Dashboard

## Project Status
**Current Phase:** MVP Complete — App Store build in progress
**Last Updated:** 2026-04-17

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
