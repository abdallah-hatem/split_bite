# Finalize-Screen Draft Persistence — Design

**Status:** Approved (brainstorm 2026-05-17)
**Author:** Abdallah / pair-design with Claude
**Implements:** Persist the host's in-progress finalize state (item prices, totals, payments, merge groups) to device storage so navigating away and back doesn't wipe everything.

---

## Problem

The finalize screen has a lot of inputs — item prices for 20 items, the actual bill total, tax/VAT/delivery/discount, per-payer amounts, and now merge groups. All of it lives in `useState` inside the screen. Navigating back to the order to add an item, fix a typo, or check something else discards every input. The host has to retype everything when they re-open the screen.

## Goal

Auto-save the entire finalize state to device storage as the host types, restore it transparently on every revisit, and clear it once the bill is actually finalized (or the order is otherwise no longer in a "needs finalizing" state).

## Non-Goals

- No cross-device sync (drafts are local-only).
- No "draft restored" banner or notification — silent restore.
- No manual `Save draft` or `Discard draft` button.
- No DB schema changes.
- No backend involvement.

---

## Architecture

### Storage layer
**AsyncStorage** (already a project dependency, `@react-native-async-storage/async-storage 2.2.0`).

- Key: `finalize-draft:<orderId>` — one entry per order. No user scoping; `<orderId>` is sufficient because:
  - A given user can only host orders they created
  - Multiple users on one device sharing the same order is a non-existent edge case
  - RLS guarantees the loaded draft can only be applied if the user can actually read the order anyway
- Value (versioned for future schema migrations):
  ```ts
  type FinalizeDraft = {
    version: 1;
    savedAt: number;   // Date.now() ms
    state: {
      itemPrices:   Record<string, string>;
      actualTotal:  string;
      tax:          string;
      vat:          string;
      delivery:     string;
      discount:     string;
      payerAmounts: Record<string, string>;
      mergeGroups:  MergeGroup[];           // from src/utils/finalizeMerge.ts
    };
  };
  ```
- Unknown / mismatched `version` on load → delete and treat as no draft.

### Save trigger
- A single `useEffect` in the finalize screen watches all eight state slices.
- Debounced 500 ms so typing doesn't trigger a write per keystroke.
- Skips its first invocation so the just-loaded draft doesn't immediately re-save itself (no thrashing).
- Errors swallowed with `console.warn` — draft persistence is best-effort, never blocks the user.

### Load trigger
- On screen mount, before rendering the form, the screen calls into `useFinalizeDraft(orderId, items, participants)`.
- The hook:
  1. Reads `finalize-draft:<orderId>` from AsyncStorage.
  2. If absent → returns `{ hydrated: true, initialState: null }`.
  3. If present, `version === 1`, and `savedAt` within 30 days:
     - Calls `filterDraftToCurrentOrder(draft, currentItemIds, currentParticipantIds)`:
       - `itemPrices`: drop keys for items that don't exist anymore.
       - `payerAmounts`: drop keys for participants who left.
       - `mergeGroups`: rewrite each group's `itemIds` to only currently-existing items; drop groups whose surviving list is `< 2`.
     - Returns `{ hydrated: true, initialState: filtered.state }`.
  4. If stale (> 30 days) or schema mismatch → deletes the key and returns `{ hydrated: true, initialState: null }`.
- The screen renders a brief loading state until `hydrated === true`. In practice this is < 50 ms; the guard prevents a visible flash.

### Clear triggers
1. **On successful finalize:** the existing finalize submit handler calls `clearDraft(orderId)` right before redirecting to summary.
2. **On reopen:** `useUpdateOrderStatus` (in `src/hooks/useOrders.ts`) calls `clearDraft(orderId)` when the target status is `'open'`. After a reopen, the host should start from current DB state, not a stale pre-finalize draft.
3. **On order deletion:** `useDeleteOrder` calls `clearDraft(orderId)`.
4. **Stale auto-purge:** on every finalize-screen mount, `purgeStaleDrafts()` scans `AsyncStorage.getAllKeys()` for `finalize-draft:*` keys and deletes any with `savedAt < Date.now() - 30 * 24 * 60 * 60 * 1000`. Cheap (few keys in practice), runs at most once per mount.

### Component / hook split

| Unit | Purpose | Depends on |
|------|---------|------------|
| `src/utils/finalizeDraftStore.ts` | Pure functions: `loadDraft`, `saveDraft`, `clearDraft`, `purgeStaleDrafts`, `filterDraftToCurrentOrder`. Testable in isolation; AsyncStorage is the only external dep and can be mocked. | `AsyncStorage`, `MergeGroup` type |
| `src/hooks/useFinalizeDraft.ts` | Composes the store: loads on mount, exposes `{ hydrated, initialState, save, clear }`. Owns the 500 ms debounce. | `finalizeDraftStore` |
| `app/(tabs)/groups/[groupId]/orders/[orderId]/finalize.tsx` | Uses the hook to seed initial state and wire `save` into every state change. Calls `clear` in the existing finalize submit handler. | `useFinalizeDraft` |
| `src/hooks/useOrders.ts` | `useDeleteOrder` and `useUpdateOrderStatus` (when reopening) call `clearDraft(orderId)`. | `finalizeDraftStore` |

No DB / schema changes. No backend.

---

## Edge cases

| Case | Behaviour |
|------|-----------|
| Two devices, one user editing the same order | Each device has its own AsyncStorage. Drafts don't sync. The DB write at finalize is single source of truth — last-write-wins as today. |
| User force-quits mid-debounce | Up to 500 ms of typing may be lost. Acceptable; rare and recoverable by retyping. |
| Order deleted from another device, then user opens local finalize | Draft loads with stale data referencing dead `itemId`s. Filter drops them silently. If everything's gone, user sees an empty form (and the order's load path will also indicate the order is gone). |
| User signs out → signs in as a different user | Drafts stay in AsyncStorage but are keyed by `orderId`s the new user can't load (RLS). Their `items` query returns nothing, so the filter wipes the draft to nothing. Auto-purged at the 30-day mark. Mildly leaky but not harmful. |
| AsyncStorage write fails (disk full, very rare) | `console.warn` and continue. Never blocks the UI. |
| Schema mismatch (future-me changes the shape) | `version` field. Unknown values → delete key, treat as no draft. |
| User adds new items to the order after draft was saved | Existing draft applies to old items; new items appear blank for the user to fill. No conflict. |
| User reopens a finalized order | `useUpdateOrderStatus` clears the draft. Finalize screen reads DB state fresh. |

---

## Testing

### Unit (`__tests__/unit/utils/finalizeDraftStore.test.ts`)

Mock `AsyncStorage` (jest-expo includes a mock by default).

1. `saveDraft` then `loadDraft` round-trips the exact state.
2. `loadDraft` on missing key returns `null`.
3. `loadDraft` with mismatched `version` returns `null` and deletes the key.
4. `loadDraft` with `savedAt` > 30 days returns `null` and deletes the key.
5. `clearDraft` removes the key.
6. `filterDraftToCurrentOrder`:
   - Keeps `itemPrices` for ids in `currentItemIds`, drops the rest.
   - Keeps `payerAmounts` for ids in `currentParticipantIds`, drops the rest.
   - For each merge group, filters `itemIds` to current ids; drops groups whose remaining length < 2.
7. `purgeStaleDrafts`:
   - Deletes drafts older than 30 days.
   - Keeps fresh drafts.
   - Skips non-`finalize-draft:` keys untouched.

### Manual smoke test

1. Open finalize, enter prices on 5 items + actual total + delivery, navigate back to the order screen.
2. Re-enter finalize → all values still there.
3. Add a new item to the order; re-enter finalize → existing prices still there, the new item's price is blank.
4. Delete one of the priced items; re-enter finalize → no crash; the deleted item's price is gone, others intact.
5. Tap Finalize → submit succeeds → re-enter finalize → form is blank (draft cleared).
6. From the summary, tap Reopen → re-enter finalize → form is blank (draft cleared on reopen).
7. Force-quit + relaunch app, then re-enter finalize on a mid-edit order → values still there.

---

## Rollout

JS-only. No native changes. No DB schema. Ships via `npm run ota -- "..."` to existing build-14 users on runtime 1.0.1.
