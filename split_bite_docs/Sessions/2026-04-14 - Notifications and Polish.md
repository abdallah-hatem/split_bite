# 2026-04-14 - Notifications and Polish

## Summary
Implemented push notifications with deep linking, fixed numerous bugs found during physical device testing.

## What Was Done
1. Push notifications via Expo Push API for order created, finalized, settlement
2. EAS project setup for push token generation
3. Notification tap deep linking (order summary, group detail, activity)
4. Fixed push_tokens RLS (was blocking token reads across users)
5. Fixed null user crash on sign out from order screen
6. Silent refetch on group detail focus
7. Lock order requires at least one item
8. Group detail silent refetch on focus (no spinner)

## Bug Fixes
- push_tokens SELECT policy opened to all authenticated (needed for cross-user token reads)
- Settle up ledger entry direction reversed (was doubling debt instead of canceling)
- Null user guard on JoinOrderButton during sign out
- Total validation: items + fees must equal bill total before finalization

## Decisions Made
- Push notifications sent from client via Expo Push API (not Edge Functions)
- Notification tap: order_finalized → summary screen, order_created → group detail, settlement → activity tab
- push_tokens readable by any authenticated user (tokens are opaque, not sensitive)
