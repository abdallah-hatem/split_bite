# SplitBite Dashboard

## Project Status
**Current Phase:** MVP Complete - Polish & Deep linking
**Last Updated:** 2026-04-14

---

## All MVP Features Complete
- Auth (sign up/in/out with session persistence)
- Groups (create, join via invite code, leave, kick members)
- Orders (create, add items with split options, add guests, lock/reopen/delete)
- Item splitting (just me / split with specific people / everyone)
- Real-time collaboration (Supabase Realtime)
- Bill finalization (editable prices, tax/VAT/delivery/discount, multi-payer)
- Total validation (items + fees must equal bill total)
- Payment validation (payments must match bill total)
- Order summary (full breakdown, who paid, per-person split, settlements)
- Group balances with per-order debt breakdown
- Settle up flow with ledger reversal
- Activity feed (paginated infinite scroll)
- Paginated orders list (infinite scroll)
- Push notifications (order created, finalized, settlement)
- Profile screen with sign out
- Silent refetch on screen focus
- 35 unit tests passing

---

## Active Work
- [ ] Notification deep linking (tap notification → navigate to relevant screen)

---

## Push Notifications Status
| Event | Notified |
|-------|----------|
| Order created | Group members |
| Order finalized | Group members |
| Settlement received | Recipient |
| Member joins group | Not yet |
| Item added to order | Not yet |
| Order locked | Not yet |
