# 2026-04-17 - Bug Fixes and Improvements

## Summary
Fixed numerous bugs found during testing, improved guest handling in calculations, added item edit/delete, account deletion, and rounding to nearest 0.5.

## What Was Done

### Bug Fixes
- Fixed settlement doubling debt (ledger entry direction was wrong in confirm flow)
- Fixed delete group FK violation (added ON DELETE CASCADE to order_participants.guest_id)
- Fixed delete group navigation (use router.dismissAll() + replace)
- Fixed guest not showing in finalize preview (was filtering by userId only)
- Fixed guest hostUserId not passed to calculation engine
- Fixed "Gets back EGP 0.00" showing instead of "Settled"

### New Features
- Account deletion (Apple App Store requirement) with Postgres RPC function
- Edit/delete items during open orders (tap item → Edit/Delete action sheet)
- Guest overpayment handling (shows "bodz → Moooo (Guest)" in settlements)
- "Who Pays Who" section in finalize preview
- Rounding to nearest 0.5 EGP (1.3→1.5, 1.7→2.0)

### Calculation Engine Improvements
- Guest settlements now shown as separate debt lines (guest:id prefix)
- Guest who overpaid shows host owing guest back
- Both finalize preview and order summary resolve guest names in debts
- 47 unit tests all passing

### Migrations
- 00004: delete_user_account() RPC function
- 00005: fix guest cascade on order_participants

## Decisions Made
- Round to 0.5 instead of 0.01 (cleaner amounts for Egyptian market)
- Guest payments generate visible settlement lines (not hidden in host transfer)
- Account deletion uses security definer Postgres function to delete auth.users
- Item edit/delete via tap action sheet (no swipe gesture needed)
