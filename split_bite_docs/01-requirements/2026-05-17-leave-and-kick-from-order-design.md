# Leave Order / Remove Participant — Design

**Status:** Approved (brainstorm 2026-05-17)
**Implements:** Two related capabilities on the order screen — a user can leave an order they joined, and the order creator can remove any other participant (real user or guest).

---

## Problem

Once someone joins an order, there's no way out. If they joined by accident, or got pulled away before the order arrived, they're stuck on the bill. Likewise the creator can't fix mistakes (someone added themselves but isn't actually eating).

## Goal

Give a real user a way to leave an order they joined. Give the order creator a way to remove anyone except themselves.

## Non-Goals

- Removing the creator. They delete the entire order if they want out.
- Leaving / kicking on `locked` / `finalized` / `settled` orders. Only `open`.
- Notifying the kicked user (no notification, no banner).
- Reassigning `added_by` or renormalising shares when a participant goes. The simpler rule below blocks entanglement instead.
- Undo. Once removed, you re-join via the existing Join Order button.

---

## Rules

### Permissions matrix

| Actor | Target | When | Allowed? |
|-------|--------|------|----------|
| A real user (participant) | Themselves | Order `open` and they're not the creator | ✓ |
| The order creator | Another real user | Order `open` | ✓ |
| The order creator | A guest | Order `open` | ✓ |
| The order creator | Themselves | — | ✗ (delete the order instead) |
| Anyone | Anyone | Order `locked` / `finalized` / `settled` | ✗ |

### Entanglement block

Before deleting a participant, run an entanglement check. The leave/kick is **blocked** if either condition is true:

1. The target is `added_by_participant_id` on an item that has shares from anyone other than themselves. *(Why: deleting the participant cascades the item, taking other people's shares with it.)*
2. The target has a `item_shares` row in an item whose `item_shares` includes anyone else. *(Why: removing their fraction leaves the item under-covered, breaking the calc engine's assumption that shares sum to 1.0.)*

If clear → delete. The cascade cleans up:
- Their solo items (items they added with no other sharers) — gone, intentional.
- Their `item_shares` everywhere — gone (vacuously safe since the entanglement check confirmed no other shares exist on those items).
- Their `payments` — gone. Note: `open` orders don't have payments yet (payments are inserted at finalize time), so this is academic.

### User-facing error messages

- Self-leave blocked: *"You can't leave this order while you're sharing items with others. Delete those items first, or ask the order creator to remove your share."*
- Kick blocked: *"Can't remove `<name>` — they're sharing items with others. Delete or update those items first."*

---

## UX

### Self-leave
- **Where:** Order screen, in the participants area. Visible only when:
  - `user` is a participant of this order, AND
  - `user` is **not** the order creator, AND
  - Order status is `open`.
- **Affordance:** a "Leave Order" button (styled like the existing "Leave Group" in the group screen).
- **Flow:** tap → confirm dialog ("Leave Order. You'll no longer be part of this bill.") → entanglement check → delete or alert.
- **On success:** `router.replace` back to the group screen.

### Kick by creator
- **Where:** participants list, beside each participant who is not the creator. Visible only to the order creator when status is `open`.
- **Affordance:** a small `×` (or trash icon) button on the right side of each row.
- **Flow:** tap → confirm dialog ("Remove `<name>` from this order?") → entanglement check → delete or alert. No notification.
- **On success:** participants list refetches; the row disappears.

---

## Schema

### RLS migration: `00007_order_participants_delete_policy.sql`

Add a `delete` policy permitting:
- A user to delete their own participant row (`user_id = auth.uid()`), AND
- The order creator to delete any participant in their order.

```sql
create policy "order_participants_delete" on public.order_participants
  for delete to authenticated
  using (
    user_id = auth.uid()
    or order_id in (
      select id from public.orders where created_by = auth.uid()
    )
  );
```

No other table changes — `items` and `item_shares` cascades already do the right thing via existing FK constraints (`on delete cascade`), and PostgreSQL cascades bypass RLS.

### Application-level guard

The "creator can't kick themselves / leave" rule is enforced in the UI (the buttons aren't rendered for the creator). The RLS policy above would technically allow it, but we never call it that way.

---

## Implementation

### `src/hooks/useOrders.ts`

Two new mutations sharing the same core logic:

```ts
export function useLeaveOrder() { /* deletes own participant */ }
export function useRemoveParticipant() { /* creator deletes someone else's */ }
```

Both:
1. Query `items` and `item_shares` for entanglement.
2. If entangled → throw an Error with the appropriate message.
3. Else → `delete order_participants where id = $1`.
4. Invalidate participants + items queries.

The entanglement check runs as two separate `from('item_shares').select(...)` calls (one for "I'm added_by an item with other sharers" and one for "I have a share in an item with other sharers") OR'd in JS. This avoids needing an RPC.

### `app/(tabs)/groups/[groupId]/orders/[orderId]/index.tsx`

Two UI additions:
1. **Leave Order button** rendered conditionally near the order header / actions area. Wires to `useLeaveOrder().mutateAsync({ participantId: myParticipant.id })`.
2. **Remove × button** next to each non-creator participant row, rendered only when `user.id === order.created_by`. Wires to `useRemoveParticipant().mutateAsync({ participantId: row.id })`.

### Real-time sync

Existing `useRealtimeOrder` already subscribes to `order_participants` and `items`. Deletes propagate to other users on the same order automatically — they'll see the participant disappear and any solo items gone.

---

## Edge cases

| Case | Behaviour |
|------|-----------|
| User has no items at all | Allowed. Clean delete. |
| User has only solo items they added | Allowed. Cascade deletes the items. |
| User shared an item they added with others | Blocked. |
| User has a share in an item added by someone else, but item has no other shares (unusual) | Allowed. Their share cascade-deletes; item ends with zero shares. Slightly weird but not catastrophic — calc engine treats item as zero-cost for split purposes. The item itself stays on the order (added_by stays). |
| User added an item that has only one share, but that share belongs to someone else (host added it for a guest) | Blocked, because deleting the user (added_by) would cascade-delete the item, removing the other participant's share. |
| Realtime out-of-sync — user left while another device was loading | The other device's queries refetch via realtime; they'll see the participant gone. |
| Creator is the only person left | Order has only the creator; both buttons unavailable. Order can be deleted normally. |
| Two clients try to leave at once | Both DELETEs run; the second is a no-op (row already gone). No error surfaced. |

---

## Testing

### Unit
Two new tests in `__tests__/unit/utils/orderEntanglement.test.ts` (new file). Extract the entanglement check into a pure helper `isParticipantEntangled(items, participantId)` that takes the already-fetched items+shares and returns boolean. Test cases:
- No items → false.
- User has solo item → false.
- User added shared item with others → true.
- User has share in shared item → true.
- User has share in solo-to-them item that they didn't add → false.
- User added item with only OTHER people's shares → true.

### Manual smoke test
Same 7 steps in the brainstorming summary — verifies allow / block / cascade / realtime / creator-button-visibility / locked-disabled.

---

## Rollout

Two-step:
1. **First:** push migration `00007` to cloud (`supabase db push`).
2. **Then:** OTA the JS via `npm run ota -- "..."`.

If you OTA before the migration lands, the new code calls a delete that RLS blocks → users see "Failed to remove" errors.
