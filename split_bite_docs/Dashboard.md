# SplitBite Dashboard

## Project Status
**Current Phase:** Phase 4 - Calculations & Finalization
**Last Updated:** 2026-04-13

---

## Completed
### Phase 1: Foundation
- [x] Expo SDK 54 + TypeScript scaffold
- [x] Supabase local dev (auth, DB, realtime)
- [x] Auth flow with SecureStore session persistence
- [x] Full database schema (11 tables + RLS + triggers)
- [x] Jest + RNTL + MSW test infrastructure

### Phase 2: Groups
- [x] Groups list with active order indicators
- [x] Create/Join group flows
- [x] Group detail (members, invite code, orders)
- [x] TanStack Query hooks (`useGroups`, `useGroup`, `useGroupMembers`)
- [x] Extracted components (`GroupCard`, `MemberRow`)

### Phase 3: Orders & Items
- [x] Create Order screen
- [x] Order Detail with items, participants, status
- [x] Add Item modal (full-screen, keyboard-safe)
- [x] Add Guest modal (full-screen)
- [x] Order lifecycle (lock/reopen/delete)
- [x] Supabase Realtime (live item + participant updates)
- [x] TanStack Query hooks (useOrders, useOrder, useAddItem, etc.)
- [x] `OrderCard` component with status badges

---

## Active Work: Phase 4
- [ ] Build `calculations.ts` — split engine
- [ ] Build `settlement.ts` — min-transaction algorithm
- [ ] Build Finalize screen
- [ ] Build `finalize-order` Edge Function
- [ ] Build Order Summary screen
- [ ] Implement calculation + settlement tests (40+ cases)

---

## Key Decisions
- `is_group_member()` security definer function for RLS (avoids recursion)
- `created_by` defaults to `auth.uid()` in DB
- Full-screen modals (not bottom sheets) for keyboard compatibility
- Groups SELECT open to all authenticated (needed for invite code lookup)
- Active order metadata fetched with groups in single query

---

## Tech Stack
- **Frontend:** Expo SDK 54 + TypeScript + Expo Router v6
- **Backend:** Supabase (Auth, Postgres, Realtime, Edge Functions)
- **State:** TanStack Query v5 + Supabase Realtime
- **Testing:** Jest + jest-expo (configured), RNTL, MSW (setup done)
