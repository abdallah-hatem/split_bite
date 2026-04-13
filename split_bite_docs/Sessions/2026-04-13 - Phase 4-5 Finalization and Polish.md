# 2026-04-13 - Phase 4-5: Finalization, Calculations, and Polish

## Summary
Completed the calculation engine, bill finalization flow, and comprehensive order summary. Fixed numerous UX issues from testing on physical device.

## What Was Done

### Calculation Engine
- `calculations.ts` — full split engine with adjustment ratio, proportional tax/VAT/delivery/discount, guest-to-host debt transfer, rounding fix
- `settlement.ts` — greedy min-transaction algorithm
- `currency.ts` — EGP/USD/EUR formatting helpers
- 35 unit tests all passing

### Finalize Flow
- Finalize screen with editable item prices, bill total, tax/VAT/delivery/discount
- Live preview showing per-person breakdown
- Payment validation (payments must match bill total)
- Participant selection for item splitting (just me / split with... / everyone)

### Order Summary (rebuilt)
- Bill breakdown (items, tax, VAT, delivery, discount, total)
- Items with who ordered / who it's split with
- Who paid section
- Per-person breakdown (items share, delivery share, tax, owes, paid, net)
- Settlements section (A → B: amount)
- Finalized orders link directly to summary from group detail

### Bug Fixes & UX
- Fixed calculation using added_by instead of actual item_shares
- Removed misleading bill mismatch warning
- Replaced tip with delivery, added VAT field
- Fixed dark theme on physical device (forced light mode + dark status bar text)
- Fixed white header text (explicit headerStyle on all stack navigators)
- Silent refetch on groups tab focus (no spinner)
- Leave group functionality for non-owners
- Items show who ordered them and split participants

## Decisions Made
- Removed tip field (not common in Egyptian market), added delivery + VAT
- Forced light theme for now (dark mode support deferred)
- Finalized orders navigate to summary, not order detail
- Payment validation blocks finalization if amounts don't match

## Next Steps
- Build Balances screen and Settle Up flow
- Build Activity feed
- Push notifications
