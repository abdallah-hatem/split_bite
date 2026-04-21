# API Design

## Overview
The app uses Supabase client directly — no custom API layer. All reads/writes go through:
1. **Direct table queries** (most operations, gated by RLS)
2. **RPC functions** (operations that need elevated privileges)
3. **Auth endpoints** (built-in)

## Direct Table Queries

All through `supabase.from("table").select/insert/update/delete()`:

- `profiles` — user profiles
- `groups`, `group_members`, `guests` — group management
- `orders`, `order_participants`, `items`, `item_shares`, `payments` — order flow
- `ledger_entries` — persistent balance history
- `pending_settlements` — settlement verification queue
- `push_tokens` — device tokens

RLS enforces security — see `rls-policies.md`.

## RPC Functions

### `is_group_member(p_group_id uuid) → boolean`
Security helper used in RLS policies. Not called directly from app.

### `get_group_id_by_invite_code(code text) → uuid`
Called from `useJoinGroup`. Returns group ID for invite code lookup (bypasses RLS).

### `delete_user_account() → void`
Called from Profile screen when user taps Delete Account. Deletes:
- All `push_tokens` for the user
- All `pending_settlements` involving the user
- All `ledger_entries` involving the user
- All `group_members` rows
- All `guests` where user is host
- The `profiles` row
- The `auth.users` row

## Realtime Subscriptions

Via `supabase.channel().on("postgres_changes", ...)`:
- `orders` (filter: `id=eq.{orderId}`) — status transitions
- `items` (filter: `order_id=eq.{orderId}`) — live item additions
- `order_participants` (filter: `order_id=eq.{orderId}`) — participants joining/leaving

Each subscription invalidates the relevant TanStack Query cache on any change.

## Push Notifications (Expo Push API)

Called from client via `fetch("https://exp.host/--/api/v2/push/send", ...)`:
- `notifyOrderCreated` — on order creation
- `notifyOrderFinalized` — on bill finalization
- `notifySettlement` — when someone sends settlement request
- `notifySettlementRejected` — when beneficiary rejects
- `notifyReminder` — payment reminder (1hr cooldown, AsyncStorage-tracked)

## Auth Flow
Built-in Supabase Auth:
- `signUp` → `signIn` (auto-login, no email confirmation)
- `signIn` — email/password
- `signOut` — clears session
- Session persisted via `expo-secure-store`
