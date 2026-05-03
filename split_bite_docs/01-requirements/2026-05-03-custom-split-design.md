# Custom (Non-Equal) Item Split — Design

**Status:** Approved (brainstorm 2026-05-03)
**Author:** Abdallah / pair-design with Claude
**Implements:** New 4th item-assignment mode that lets users split a single item among multiple people in a non-equal ratio.

---

## Problem

Today, when an item is assigned to multiple people in an order, the cost is split **equally** among them (1/N each). This doesn't match real life — sometimes one person had a bigger portion, ordered an extra side, or three friends shared a starter where one ate twice as much. Users want to capture that.

## Goal

Let the item creator pick a custom ratio (e.g. `1 : 1 : 2`) when assigning an item to multiple people, while keeping the existing equal-split UX completely unchanged.

## Non-Goals

- No fixed-amount splits ("Person A pays exactly 5 EGP, the rest is split"). Only ratios for now.
- No per-item percentage that *doesn't* sum to 100% (we always normalise so all shares cover 100% of the item price).
- No retroactive changes to ledger entries from past finalised orders.
- No new DB migration — schema already supports fractional shares.

---

## User Experience

### Entry Point

The existing assignment selector for an item currently shows three options:

> **Just me** | **Everyone** | **Pick specific people**

Add a fourth option:

> **Just me** | **Everyone** | **Pick specific people** | **Custom split**

Tapping **Custom split** opens a sheet that lets the user (a) pick people *and* (b) set a weight per person, in the same flow.

### Custom-Split Sheet

```
┌─────────────────────────────────────┐
│  Custom split                       │
│                                     │
│  ☑ Yara         [   1   ] (25%)     │
│  ☑ Omar         [   1   ] (25%)     │
│  ☑ Ahmed        [   2   ] (50%)     │
│  ☐ Sara                             │
│  ☐ Khaled                           │
│                                     │
│  Total weights: 4 — covers 100%     │
│                                     │
│            [ Cancel ]   [ Save ]    │
└─────────────────────────────────────┘
```

- Each group member (and any guest already added to the order) appears in the list with a checkbox.
- Checking a person reveals a numeric weight input next to their name. The weight defaults to `1`.
- Below the weight, the **live percentage** of the item allocated to that person is shown — recomputed every keystroke.
- A summary line at the bottom confirms "covers 100%" once at least one weight is positive.
- **Save** is disabled while the total of all weights is `0` (or no one is checked).

### Editing an Existing Item

**Out of scope for this iteration.** The current Edit Item modal (today, before this change) only edits `name` and `price` — it does not let the user change who is on an item. Adding assignment-editing AND custom-split editing in one go would bloat this change.

Path forward: ship Custom split in the **add-item** flow now. A follow-up task can introduce assignment-editing (and at the same time bring Custom-split-on-edit). Tracked separately.

---

## Data Model

The schema already supports this — no migration needed.

```sql
create table public.item_shares (
  id uuid primary key,
  item_id uuid not null,
  participant_id uuid not null,
  share_fraction numeric(5,4) not null default 1.0,
  unique(item_id, participant_id)
);
```

`share_fraction` is stored as a **normalised fraction** (sum of fractions per item == 1.0). Custom split simply stops hard-coding `1/N` and computes the fractions from user-entered weights.

### Normalisation Rule

Given user-entered weights `[w1, w2, … wn]` for `n` selected people:

```
total = w1 + w2 + … + wn   (must be > 0)
fraction_i = w_i / total
```

`numeric(5,4)` precision (4 decimal places) is sufficient for our use case. The calc engine in `src/utils/calculations.ts` already multiplies `price * quantity * share.fraction` per share, so as long as fractions sum to 1.0, no calc-engine change is needed.

---

## Components & Data Flow

```
addItem(... mode: 'custom', sharedWith: { participantId, weight }[]) ──┐
editItem(...                                                          ├─► useOrders mutation
                                                                       │
                                                                       ▼
                                              normalise weights → fractions
                                                                       │
                                                                       ▼
                                          item_shares rows (one per participant)
                                                                       │
                                                                       ▼
                                                  calculations.ts (unchanged)
```

### File-by-file impact

| File | Change |
|------|--------|
| `src/hooks/useOrders.ts` | `addItem` / `editItem` mutations accept either `sharedWith: string[]` (equal, current shape) or `sharedWith: { participantId, weight }[]` (custom). Normalises weights → fractions before insert. |
| `app/(tabs)/groups/[groupId]/orders/[orderId]/index.tsx` (item add/edit modal) | Add **Custom split** chip alongside the existing 3. When selected, replace the people-picker body with the custom-split sheet UI described above. Preserve mode + weights when re-opening for edit. |
| `components/orders/CustomSplitSheet.tsx` (new) | Self-contained component: input is `{ participants, initialWeights }`, output is `{ participantId, weight }[]`. Owns input state, validation, live %. |
| `src/utils/calculations.ts` | **No change.** Already fraction-aware. |
| `__tests__/unit/utils/calculations.test.ts` | Add 2–3 tests covering an item split 25/25/50 and 33/33/33 to lock in fraction behaviour. |
| `supabase/migrations/*` | **No change.** |

---

## Validation & Edge Cases

| Case | Behaviour |
|------|-----------|
| User checks a person but leaves weight blank | Treat as `0`. Their fraction is `0` (they pay nothing). |
| All weights are `0` | Save disabled; show inline message "Set at least one weight above 0". |
| Single person checked with any positive weight | Treated as `share_fraction = 1.0` (same as Just me but for someone else). |
| User unchecks a person who had a weight | Their input is hidden; weight value is forgotten on save. |
| Decimal weight (e.g. `1.5`) | Allowed; normalised the same way. |
| Switching mode mid-edit | All `item_shares` rows for that item are deleted and re-inserted with the new shape. |
| Guest participant | Treated identically to user participants — they appear in the list with a checkbox + weight. |
| Item is later modified after order is finalised | Out of scope for this design — finalisation lock already prevents this. |

---

## Testing Plan

**Unit (Jest)** — added to `__tests__/unit/utils/calculations.test.ts`:
1. Item priced 100 EGP split 1/1/2 → 25 / 25 / 50 EGP.
2. Item priced 30 EGP split 1/2 → 10 / 20 EGP.
3. Order with mixed equal + custom items computes per-person totals correctly.

**Manual smoke test** before merging:
1. Create a new order, add an item, choose Custom split, set weights, save → finalize and verify per-person shares in summary.
2. Edit an existing Custom-split item, change weights → verify summary updates.
3. Switch a Custom item back to Equal → verify shares become 1/N again.

---

## Rollout

This is purely additive UI + non-breaking insert logic. No migration, no breaking change to existing orders. Can ship via OTA update (no new App Store build needed) once the iPad-only resubmission lands.
