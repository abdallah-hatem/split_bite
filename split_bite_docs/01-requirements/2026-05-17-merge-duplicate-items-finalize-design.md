# Merge Duplicate Items in Finalize — Design

**Status:** Approved (brainstorm 2026-05-17)
**Author:** Abdallah / pair-design with Claude
**Implements:** A finalize-screen helper that lets the host group duplicate items into one row so they enter the price *once* per group instead of once per item.

---

## Problem

When 4–5 people are in a shared order and each adds "the same item" with slightly different spellings — `pizza`, `Pizza`, `Margherita`, or in Arabizi `ta3mya` / `taamya` / `t3mya` — the Item Prices section on the finalize screen ends up with 9–10 rows. The host has to type prices into each one, and most of those prices are the same. It's tedious and error-prone.

Computer-driven fuzzy matching (Levenshtein, normalization, LLM) is unreliable on transliterated Arabic and creates false positives. A short human glance at the list is faster than any heuristic.

## Goal

Give the host a **manual** way to combine duplicate-looking rows in the Item Prices section so they type one price per group instead of one per row. Nothing changes outside the finalize screen.

## Non-Goals

- No automatic detection of duplicates. The human picks.
- No fuzzy-match suggestions, no Levenshtein, no LLM call.
- No DB schema changes. The `items` table stays as it is.
- No changes to the order's main item list, the order summary, or the calc engine.
- No persistence of merge groups across finalize-screen sessions. Closing the screen discards the grouping (entered prices persist as drafts in the existing local state, same as today).
- No renaming of underlying items. The merged row's display name is the first selected item's `name`, used only for the merged row in the finalize UI.

---

## User Experience

### Where it lives

Inside the existing **Item Prices** section on the finalize screen — same place that already shows per-item price inputs.

### Controls

A small toggle button above the list:

```
Item Prices                                 [ Combine items ]
```

Tapping it enters **merge mode** (button toggles to `[ Done ]`). In merge mode, each item row gains a small circular checkbox on the left of the row:

```
┌─────────────────────────────────────────────┐
│ ⃝  Pizza             Split: bodz   [   50 ] │
│ ⃝  pizza             Split: yara   [   50 ] │
│ ⃝  Margherita Pizza  Split: omar   [   50 ] │
│ ⃝  Pizza             Split: sara   [   50 ] │
└─────────────────────────────────────────────┘
```

User taps rows to select them. Selected rows show a filled checkbox + slight highlight. A bottom toolbar shows:

```
┌─────────────────────────────────────────────┐
│   2 selected            [ Merge selected ]  │
└─────────────────────────────────────────────┘
```

`[ Merge selected ]` is disabled until 2+ rows are checked. Tapping it collapses the selected rows into a single merged row at the position of the first selected item:

```
┌─────────────────────────────────────────────┐
│ ⌄  Pizza ×4          Split: 4 people  [   ] │
└─────────────────────────────────────────────┘
```

The single price input replaces the four individual ones. The `⌄` chevron (or a small `×` icon) unmerges the group back into its underlying rows.

Tapping `[ Done ]` exits merge mode — checkboxes hide, the bottom toolbar disappears, merged groups remain merged. The host can now type prices in the simplified view.

### Naming (N2 — first item's name)

The merged row's display name is the **name of the first selected item**, suffixed with `×N` where `N` is the count. No prompt, no edit affordance in the merge UI. If the host doesn't like the name, they can fix it on the main order screen (existing item-edit flow) before finalizing.

### Price input semantics

The price input on a merged row is **per-item price**. When the user types `50`:
- Each of the N underlying items' draft prices is set to `50`.
- The Items Sum line includes `50 × N` for the group.
- When the user taps Finalize, the existing submit path writes each underlying item's `price` to the DB individually — no change to that code.

Blank input = `null` price for each underlying item (same as today's single-item behaviour).

### Edge cases

| Case | Behaviour |
|------|-----------|
| Selected items already have different draft prices | Merged input starts blank. Unmerging restores the original per-item draft prices. |
| Selected items have different participants | Allowed — each underlying item keeps its own assignment. Per-item price applies to all. The merged row's `Split: ...` shows the union of unique participant names ("4 people" if 4 unique, otherwise names joined). |
| User selects items already inside an existing merge group | Sequential merges flatten — the new group contains the union of all underlying items. |
| User unmerges (taps chevron) | Group dissolves. Each underlying item's price = the merged group's last-entered price. |
| Order has only 1 item | `[ Combine items ]` button is hidden (nothing to merge). |
| User leaves finalize screen | Merge groups are discarded. Re-opening = clean slate. Draft prices persist as today. |

---

## Data Flow

```
finalize.tsx (local state)
  prices: Record<itemId, string>        ← already exists; tracks draft price per item
  mergeGroups: MergeGroup[]             ← new; component-local only

  type MergeGroup = {
    id: string;                          // synthetic, e.g. "merge_" + first item's id
    itemIds: string[];                   // underlying items in this group
  }

displayRows = derive(items, mergeGroups)
  - For each item: if it belongs to a merge group, contribute it ONLY as part of
    the merged row keyed by the group. If not in a group, render as a normal row.
  - A merged row is rendered once per group at the position of the first itemId
    in the group.

handlePriceChange(rowKey, value)
  - If rowKey is a single item: prices[itemId] = value  (existing behaviour)
  - If rowKey is a merge group: for each itemId in group.itemIds, prices[itemId] = value

handleFinalize() — unchanged
  - Iterates items, reads prices[itemId], writes to DB. Merge groups are
    transparent to this path because each underlying item already has the
    correct draft price.
```

No schema migration. No new tables. No backend changes. No calc-engine touches.

---

## Files touched

| File | Change |
|------|--------|
| `app/(tabs)/groups/[groupId]/orders/[orderId]/finalize.tsx` | Add `mergeMode` toggle, `selectedForMerge: Set<string>`, `mergeGroups: MergeGroup[]` state. Add `[ Combine items ]` toggle button, per-row checkbox affordance, bottom selection toolbar, merged-row renderer with chevron/unmerge. Update `handlePriceChange` to fan out to underlying items when a merge-group row is edited. |
| `__tests__/unit/utils/...` | Optional pure-helper tests if I extract the `displayRows` derivation into a util — see Testing section. |

No other files. No `src/hooks/*`, no `src/utils/*` calculator code, no DB migrations.

---

## Testing

The trickiest piece is the **derive(items, mergeGroups) → displayRows** function and the **fan-out price update**. Both are pure transformations and easy to unit test if extracted.

I'll extract them into `src/utils/finalizeMerge.ts` with two exports:

```ts
type MergeGroup = { id: string; itemIds: string[] };
type DisplayRow =
  | { kind: "item"; itemId: string }
  | { kind: "group"; id: string; itemIds: string[]; displayNameSourceId: string };

export function deriveDisplayRows(items: Item[], groups: MergeGroup[]): DisplayRow[];
export function applyPriceToRow(
  row: DisplayRow,
  value: string,
  prices: Record<string, string>
): Record<string, string>;
```

Unit tests (new file `__tests__/unit/utils/finalizeMerge.test.ts`):

1. No groups → display rows are 1-to-1 with items, in order.
2. One group of 3 → 3 items collapse into 1 group row at the first item's position, rest unchanged.
3. Two non-overlapping groups → both appear in correct positions.
4. Group of 1 item is invalid (filtered out / never created — UI prevents this).
5. Applying a price to a group row sets the same value for every itemId in the group.
6. Applying a price to a non-group row sets only that item.
7. Item order is preserved (the merged row sits where the first selected item used to be).

UI bits (button visibility, selection state) are inside React component state — tested manually by running Expo Go.

### Manual smoke test (Expo Go)

1. Create an order with 5+ items, several with similar names. Tap Finalize.
2. Tap `[ Combine items ]`, select 2 rows, tap `[ Merge selected ]`. Verify they collapse into one row with `Name ×2`.
3. Type a price in the merged row. Verify items sum reflects `price × 2`.
4. Tap the chevron on the merged row. Verify the rows reappear with the entered price each.
5. Re-merge a different combination. Tap `[ Done ]`. Verify checkboxes disappear, merged group stays merged.
6. Type prices for everything else, tap Finalize. Verify the DB has each underlying item's price written individually.

---

## Rollout

Purely additive UI + non-breaking state. No migration. Can ship via OTA (`npm run ota -- "..."`) to existing build-14 users. No new App Store build needed unless this is bundled with native changes.

---

## Out of scope (might revisit later)

- Auto-suggestion of duplicates ("looks similar?") via Levenshtein or LLM — costs vs benefit explored, not worth it now.
- Persisting merge groups across sessions (would need a small new table or local-storage key).
- Renaming the underlying items when merging — handy but adds DB write + UX questions.
- Showing merged groups in the order summary view post-finalize.
