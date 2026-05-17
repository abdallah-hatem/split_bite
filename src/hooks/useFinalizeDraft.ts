import { useEffect, useRef, useState } from "react";
import {
  FinalizeDraftState,
  clearDraft,
  loadDraft,
  purgeStaleDrafts,
  saveDraft,
} from "@/src/utils/finalizeDraftStore";

const DEBOUNCE_MS = 500;

type UseFinalizeDraft = {
  /** True once we've checked AsyncStorage at least once. */
  hydrated: boolean;
  /**
   * Raw loaded draft state for this order (or `null` if there's none).
   * The caller filters this against the order's current items / participants
   * before seeding its useStates.
   */
  initialState: FinalizeDraftState | null;
  /** Save the current state. Debounced internally; safe to call on every change. */
  save: (state: FinalizeDraftState) => void;
  /** Clear the persisted draft for this order. Awaitable. */
  clear: () => Promise<void>;
};

/**
 * Loads the finalize draft for `orderId` on mount and exposes a debounced
 * `save` for the caller to fire on every state change. The hook does not own
 * the form state — the screen continues to hold its own useStates and uses
 * `initialState` as their seed (after filtering against the live items /
 * participants).
 */
export function useFinalizeDraft(orderId: string | undefined): UseFinalizeDraft {
  const [hydrated, setHydrated] = useState(false);
  const [initialState, setInitialState] = useState<FinalizeDraftState | null>(null);
  const pendingSave = useRef<FinalizeDraftState | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load — runs once per orderId.
  useEffect(() => {
    let cancelled = false;
    if (!orderId) return;

    (async () => {
      // Best-effort housekeeping; ignore failures.
      purgeStaleDrafts().catch(() => {});

      const draft = await loadDraft(orderId);
      if (cancelled) return;

      setInitialState(draft?.state ?? null);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // Flush any pending save when the component unmounts.
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        if (orderId && pendingSave.current) {
          saveDraft(orderId, pendingSave.current).catch(() => {});
        }
      }
    };
  }, [orderId]);

  const save = (state: FinalizeDraftState) => {
    if (!orderId) return;
    pendingSave.current = state;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const toSave = pendingSave.current;
      pendingSave.current = null;
      debounceTimer.current = null;
      if (toSave) {
        saveDraft(orderId, toSave).catch(() => {});
      }
    }, DEBOUNCE_MS);
  };

  const clear = async () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    pendingSave.current = null;
    if (!orderId) return;
    await clearDraft(orderId);
  };

  return { hydrated, initialState, save, clear };
}
