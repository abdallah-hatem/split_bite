# 2026-04-13 - Phase 2-3: Orders, Hooks, and Refactoring

## Summary
Completed Phase 2 (Groups) and Phase 3 core (Orders & Items). Extracted all direct Supabase calls into TanStack Query hooks, built reusable components, and implemented the full order lifecycle with real-time collaboration.

## What Was Done

### Hooks (TanStack Query)
- `useGroups` — fetches groups with active order count, owner flag, and "your order" indicator
- `useCreateGroup`, `useJoinGroup` — mutations with cache invalidation
- `useGroup`, `useGroupMembers` — single group detail
- `useOrders`, `useOrder`, `useOrderParticipants`, `useOrderItems` — order queries
- `useCreateOrder`, `useAddItem`, `useAddGuest`, `useDeleteOrder`, `useUpdateOrderStatus` — order mutations
- `useRealtimeOrder`, `useRealtimeItems` — Supabase Realtime subscriptions that invalidate TanStack cache

### Components
- `GroupCard` — shows owner badge, active order count, "your order" indicator
- `MemberRow` — member with role badge
- `OrderCard` — order with status badge

### Screens
- Refactored all group screens to use hooks (no more direct Supabase calls)
- Create Order screen
- Order Detail screen with full functionality:
  - Add Item modal (full-screen with KeyboardAvoidingView)
  - Add Guest modal (full-screen)
  - Participant chips (user vs guest styling)
  - Items list with shared labels
  - Lock/Reopen/Delete order (owner only)
  - Join Order button for non-participants
  - Live Realtime updates

### Bug Fixes
- Fixed RLS infinite recursion (added `is_group_member()` security definer function)
- Fixed `created_by` FK violation (defaulted to `auth.uid()` in DB)
- Fixed group join RLS (opened `groups_select` policy for invite code lookup)
- Fixed stale sessions after DB reset (switched to API-based user seeding)
- Fixed keyboard blocking modals (switched from bottom sheet to full-screen modals)

### Cleanup
- Removed template files (two.tsx, modal.tsx, +html.tsx)
- Added seed-users.sh script for post-reset user creation
- Added orders delete RLS policy

## Decisions Made
- Full-screen modals instead of bottom sheets (keyboard compatibility)
- Groups SELECT policy opened to all authenticated users (needed for invite code lookup)
- Active order metadata fetched alongside groups in single query (no N+1)

## Next Steps
- Phase 4: Calculation engine, bill finalization, settlement algorithm
- Push notifications (pulled forward from Phase 5)
