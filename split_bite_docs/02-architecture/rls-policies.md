# RLS Policies

Location: `supabase/migrations/00002_rls_policies.sql`

## Helper Functions

### `is_group_member(group_id)` — security definer
Checks if current user is a member of a group. Bypasses RLS to avoid recursion when checking from within policies.

### `get_group_id_by_invite_code(code)` — security definer
Used by the join flow to look up a group by invite code. Bypasses `groups_select` RLS which would otherwise block non-members from finding the group.

### `delete_user_account()` — security definer
Deletes current user's auth record and all related data. Used for account deletion (Apple requirement).

## Policies by Table

### profiles
- **SELECT**: any authenticated user (display names needed for UX)
- **UPDATE**: own row only

### groups
- **SELECT**: `created_by = auth.uid() OR is_group_member(id)`
- **INSERT**: `created_by = auth.uid()` (defaulted via `auth.uid()`)
- **UPDATE**: admins only
- **DELETE**: creator only

### group_members
- **SELECT**: fellow group members via `is_group_member()`
- **INSERT**: self only (joining)
- **DELETE**: admins can kick, users can leave self

### guests
- **SELECT**: group members
- **INSERT**: `host_user_id = auth.uid() AND is_group_member(group_id)`
- **UPDATE**: host only

### orders
- **SELECT**: group members
- **INSERT**: `created_by = auth.uid() AND is_group_member(group_id)`
- **UPDATE/DELETE**: creator only

### order_participants, items, item_shares, payments
- **SELECT**: members of the order's group
- **INSERT/UPDATE/DELETE**: gated by order state (e.g., items only writable when status='open')
- **payments INSERT**: order creator, status `locked` or `finalized`

### ledger_entries
- **SELECT**: group members
- **INSERT**: restricted by type:
  - `order_debt` / `guest_transfer`: only order creator
  - `settlement`: only involved parties (`from_user_id = auth.uid() OR to_user_id = auth.uid()`)

### pending_settlements
- **SELECT**: both parties
- **INSERT**: `from_user_id = auth.uid()` (payer initiates)
- **UPDATE**: `to_user_id = auth.uid()` (beneficiary confirms/rejects)

### push_tokens
- **SELECT**: any authenticated user (needed to send notifications to group members)
- **INSERT/DELETE**: own tokens only

## Key Patterns

1. **Use security definer functions** to avoid RLS recursion when one table's policy checks another
2. **Guard by group membership** for anything in a group scope
3. **Guard by ownership** for creator/host-only actions
4. **Default `auth.uid()`** for `created_by` columns so the client doesn't need to know/pass it
