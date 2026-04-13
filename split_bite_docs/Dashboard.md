# SplitBite Dashboard

## Project Status
**Current Phase:** Phase 5 - Final polish + Push notifications
**Last Updated:** 2026-04-14

---

## Completed
### Phase 1: Foundation - DONE
### Phase 2: Groups - DONE
### Phase 3: Orders & Items - DONE
### Phase 4: Calculations & Finalization - DONE
### Phase 5: Balances, Activity, Profile - DONE (except push notifications)

---

## Remaining
- [ ] Push notifications (order created, finalized, settlement)
- [ ] Deep link handling for invite codes

---

## Key Features Working
- Auth (sign up/in/out with session persistence)
- Groups (create, join via invite code, leave, kick members, member list)
- Orders (create, add items with split options, add guests, lock/reopen/delete)
- Item splitting (just me / split with specific people / everyone)
- Real-time collaboration (Supabase Realtime)
- Bill finalization (editable prices, tax/VAT/delivery/discount, multi-payer)
- Total validation (items + fees must equal bill total)
- Payment validation (payments must match bill total)
- Order summary (full breakdown, who paid, per-person split, settlements)
- Group balances with per-order debt breakdown
- Settle up flow with ledger reversal
- Activity feed (paginated, all ledger entries across groups)
- Paginated orders list and activity feed (infinite scroll)
- Group cards show active orders, owner badge, "your order" indicator
- Profile with sign out
- 35 unit tests passing
