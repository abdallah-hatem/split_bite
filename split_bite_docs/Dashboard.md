# SplitBite Dashboard

## Project Status
**Current Phase:** Phase 5 - Balances, Settlements & Polish
**Last Updated:** 2026-04-13

---

## Completed
### Phase 1: Foundation - DONE
### Phase 2: Groups - DONE
### Phase 3: Orders & Items - DONE
### Phase 4: Calculations & Finalization - DONE

---

## Active Work: Phase 5
- [ ] Balances screen (group-wide net balances)
- [ ] Settle Up flow
- [ ] Activity feed
- [ ] Push notifications
- [ ] Profile editing

---

## Key Features Working
- Auth (sign up/in/out with session persistence)
- Groups (create, join via invite code, leave, member list)
- Orders (create, add items with split options, add guests, lock/reopen/delete)
- Real-time collaboration (Supabase Realtime)
- Bill finalization (editable prices, tax/VAT/delivery/discount, multi-payer, payment validation)
- Order summary (full breakdown, who paid, per-person split, settlements)
- Group cards show active orders, owner badge, "your order" indicator
- 35 unit tests passing (calculations + settlement)

---

## Tech Stack
- **Frontend:** Expo SDK 54 + TypeScript + Expo Router v6
- **Backend:** Supabase (Auth, Postgres, Realtime)
- **State:** TanStack Query v5 + Supabase Realtime
- **Testing:** Jest + jest-expo (35 tests passing)
