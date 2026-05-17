/**
 * Pure helpers for the "Combine duplicate items" UX on the finalize screen.
 *
 * The merge is purely a *display* device for the Item Prices section — it
 * groups N underlying items into one row so the host can type a per-item
 * price once instead of N times. The grouping never touches the DB; price
 * values fan out to each underlying item's `prices` map.
 */

export type MergeItemRef = { id: string };

export type MergeGroup = {
  /** Synthetic id. Stable across renders. */
  id: string;
  /** Underlying item ids in display order (first = name source). */
  itemIds: string[];
};

export type DisplayRow =
  | { kind: "item"; itemId: string }
  | {
      kind: "group";
      groupId: string;
      itemIds: string[];
      /** The item whose `name` is shown for the group ("N2": first selected). */
      displayNameSourceId: string;
    };

/**
 * Render the Item Prices list as a sequence of rows: single items pass through
 * untouched; groups render once at the position of the first item in the group.
 */
export function deriveDisplayRows<T extends MergeItemRef>(
  items: T[],
  groups: MergeGroup[]
): DisplayRow[] {
  // Map of itemId → group it belongs to.
  const itemToGroup = new Map<string, MergeGroup>();
  for (const g of groups) {
    if (g.itemIds.length < 2) continue; // ignore singleton "groups" defensively
    for (const id of g.itemIds) itemToGroup.set(id, g);
  }

  const emittedGroups = new Set<string>();
  const rows: DisplayRow[] = [];

  for (const item of items) {
    const g = itemToGroup.get(item.id);
    if (!g) {
      rows.push({ kind: "item", itemId: item.id });
      continue;
    }
    if (emittedGroups.has(g.id)) continue;
    emittedGroups.add(g.id);
    rows.push({
      kind: "group",
      groupId: g.id,
      itemIds: g.itemIds,
      displayNameSourceId: g.itemIds[0],
    });
  }

  return rows;
}

/**
 * Apply the user's typed price to either a single item or every item in a
 * merge group. Returns a new prices map (immutable).
 *
 * `value` is the raw text input — empty string is fine; it falls through to
 * the existing parseFloat path that already handles empty/NaN as 0.
 */
export function applyPriceToRow(
  row: DisplayRow,
  value: string,
  prices: Record<string, string>
): Record<string, string> {
  const next = { ...prices };
  if (row.kind === "item") {
    next[row.itemId] = value;
  } else {
    for (const id of row.itemIds) {
      next[id] = value;
    }
  }
  return next;
}

/**
 * Build a new groups list by merging the given itemIds into a single group.
 * If any of the items are already in existing groups, those groups are
 * flattened into the new one — sequential merges accumulate.
 */
export function mergeIntoGroup(
  groups: MergeGroup[],
  itemIdsToMerge: string[],
  nextGroupId: string
): MergeGroup[] {
  if (itemIdsToMerge.length < 2) return groups;

  const idsToInclude = new Set<string>(itemIdsToMerge);

  // Pull in any existing group's items that overlap.
  const survivingGroups: MergeGroup[] = [];
  for (const g of groups) {
    const overlaps = g.itemIds.some((id) => idsToInclude.has(id));
    if (overlaps) {
      for (const id of g.itemIds) idsToInclude.add(id);
    } else {
      survivingGroups.push(g);
    }
  }

  // Preserve display order from `itemIdsToMerge`, then append any extras
  // pulled in from existing groups.
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of itemIdsToMerge) {
    if (!seen.has(id) && idsToInclude.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  for (const id of idsToInclude) {
    if (!seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }

  return [
    ...survivingGroups,
    { id: nextGroupId, itemIds: ordered },
  ];
}

/**
 * Remove a group, returning the underlying items to ungrouped state.
 */
export function unmergeGroup(
  groups: MergeGroup[],
  groupId: string
): MergeGroup[] {
  return groups.filter((g) => g.id !== groupId);
}
