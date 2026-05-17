/**
 * Persist the host's in-progress finalize state to AsyncStorage so navigating
 * away from the finalize screen doesn't wipe everything. Local-only, no sync.
 *
 * See split_bite_docs/01-requirements/2026-05-17-finalize-draft-persistence-design.md
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MergeGroup } from "./finalizeMerge";

const KEY_PREFIX = "finalize-draft:";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const CURRENT_DRAFT_VERSION = 1 as const;

export type FinalizeDraftState = {
  itemPrices: Record<string, string>;
  actualTotal: string;
  tax: string;
  vat: string;
  delivery: string;
  discount: string;
  payerAmounts: Record<string, string>;
  mergeGroups: MergeGroup[];
};

export type FinalizeDraft = {
  version: typeof CURRENT_DRAFT_VERSION;
  savedAt: number;
  state: FinalizeDraftState;
};

function keyFor(orderId: string): string {
  return `${KEY_PREFIX}${orderId}`;
}

/**
 * Read the draft for `orderId`. Returns `null` if absent, stale (>30 days), or
 * schema-mismatched (and deletes the bad key in those cases).
 *
 * `now` is injectable for tests.
 */
export async function loadDraft(
  orderId: string,
  now: number = Date.now()
): Promise<FinalizeDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(orderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FinalizeDraft>;
    if (parsed.version !== CURRENT_DRAFT_VERSION || typeof parsed.savedAt !== "number" || !parsed.state) {
      await AsyncStorage.removeItem(keyFor(orderId));
      return null;
    }
    if (now - parsed.savedAt > MAX_AGE_MS) {
      await AsyncStorage.removeItem(keyFor(orderId));
      return null;
    }
    return parsed as FinalizeDraft;
  } catch (err) {
    console.warn("[finalizeDraft] loadDraft failed:", err);
    return null;
  }
}

/**
 * Persist `state` for `orderId`. Swallows errors — draft persistence is
 * best-effort and never blocks the user.
 */
export async function saveDraft(
  orderId: string,
  state: FinalizeDraftState,
  now: number = Date.now()
): Promise<void> {
  const draft: FinalizeDraft = {
    version: CURRENT_DRAFT_VERSION,
    savedAt: now,
    state,
  };
  try {
    await AsyncStorage.setItem(keyFor(orderId), JSON.stringify(draft));
  } catch (err) {
    console.warn("[finalizeDraft] saveDraft failed:", err);
  }
}

/**
 * Delete the draft for `orderId`. No-op if absent.
 */
export async function clearDraft(orderId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(orderId));
  } catch (err) {
    console.warn("[finalizeDraft] clearDraft failed:", err);
  }
}

/**
 * One-pass scan of all `finalize-draft:*` keys; deletes anything older than
 * 30 days. Cheap to run on every finalize-screen mount.
 */
export async function purgeStaleDrafts(now: number = Date.now()): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const draftKeys = allKeys.filter((k) => k.startsWith(KEY_PREFIX));
    if (draftKeys.length === 0) return;
    const entries = await AsyncStorage.multiGet(draftKeys);
    const stale: string[] = [];
    for (const [key, raw] of entries) {
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as Partial<FinalizeDraft>;
        const savedAt = parsed?.savedAt;
        if (typeof savedAt !== "number" || now - savedAt > MAX_AGE_MS) {
          stale.push(key);
        }
      } catch {
        stale.push(key);
      }
    }
    if (stale.length > 0) {
      await AsyncStorage.multiRemove(stale);
    }
  } catch (err) {
    console.warn("[finalizeDraft] purgeStaleDrafts failed:", err);
  }
}

/**
 * Drop draft entries that reference itemIds / participantIds that no longer
 * exist on the order. Used right after `loadDraft` so the form never tries to
 * render data tied to deleted rows.
 */
export function filterDraftToCurrentOrder(
  state: FinalizeDraftState,
  currentItemIds: ReadonlySet<string>,
  currentParticipantIds: ReadonlySet<string>
): FinalizeDraftState {
  const itemPrices: Record<string, string> = {};
  for (const [id, value] of Object.entries(state.itemPrices)) {
    if (currentItemIds.has(id)) itemPrices[id] = value;
  }

  const payerAmounts: Record<string, string> = {};
  for (const [id, value] of Object.entries(state.payerAmounts)) {
    if (currentParticipantIds.has(id)) payerAmounts[id] = value;
  }

  const mergeGroups: MergeGroup[] = [];
  for (const g of state.mergeGroups) {
    const survivingIds = g.itemIds.filter((id) => currentItemIds.has(id));
    if (survivingIds.length >= 2) {
      mergeGroups.push({ id: g.id, itemIds: survivingIds });
    }
  }

  return {
    itemPrices,
    actualTotal: state.actualTotal,
    tax: state.tax,
    vat: state.vat,
    delivery: state.delivery,
    discount: state.discount,
    payerAmounts,
    mergeGroups,
  };
}
