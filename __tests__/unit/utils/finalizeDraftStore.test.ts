import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadDraft,
  saveDraft,
  clearDraft,
  purgeStaleDrafts,
  filterDraftToCurrentOrder,
  FinalizeDraftState,
  CURRENT_DRAFT_VERSION,
} from "@/src/utils/finalizeDraftStore";

const ORDER = "order-123";
const KEY = `finalize-draft:${ORDER}`;
const DAY = 24 * 60 * 60 * 1000;

function baseState(): FinalizeDraftState {
  return {
    itemPrices: { a: "10", b: "20" },
    actualTotal: "30",
    tax: "",
    vat: "",
    delivery: "5",
    discount: "",
    payerAmounts: { p1: "30" },
    mergeGroups: [],
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("saveDraft + loadDraft round-trip", () => {
  it("persists then reads back the exact state", async () => {
    const now = Date.UTC(2026, 4, 17, 12, 0, 0);
    const state = baseState();
    await saveDraft(ORDER, state, now);

    const loaded = await loadDraft(ORDER, now);
    expect(loaded).not.toBeNull();
    expect(loaded!.savedAt).toBe(now);
    expect(loaded!.version).toBe(CURRENT_DRAFT_VERSION);
    expect(loaded!.state).toEqual(state);
  });
});

describe("loadDraft edge cases", () => {
  it("returns null when no draft exists", async () => {
    const loaded = await loadDraft(ORDER);
    expect(loaded).toBeNull();
  });

  it("returns null and deletes the key when version mismatches", async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ version: 999, savedAt: Date.now(), state: baseState() })
    );

    const loaded = await loadDraft(ORDER);
    expect(loaded).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it("returns null and deletes the key when draft is older than 30 days", async () => {
    const now = Date.UTC(2026, 4, 17);
    const stale = now - 31 * DAY;
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        version: CURRENT_DRAFT_VERSION,
        savedAt: stale,
        state: baseState(),
      })
    );

    const loaded = await loadDraft(ORDER, now);
    expect(loaded).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it("returns the draft when within 30 days", async () => {
    const now = Date.UTC(2026, 4, 17);
    const fresh = now - 29 * DAY;
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        version: CURRENT_DRAFT_VERSION,
        savedAt: fresh,
        state: baseState(),
      })
    );

    const loaded = await loadDraft(ORDER, now);
    expect(loaded).not.toBeNull();
    expect(loaded!.state).toEqual(baseState());
  });
});

describe("clearDraft", () => {
  it("removes the key", async () => {
    await saveDraft(ORDER, baseState());
    expect(await AsyncStorage.getItem(KEY)).not.toBeNull();

    await clearDraft(ORDER);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it("is a no-op when the key is absent", async () => {
    await expect(clearDraft(ORDER)).resolves.toBeUndefined();
  });
});

describe("purgeStaleDrafts", () => {
  it("deletes drafts older than 30 days, keeps fresh ones, ignores other keys", async () => {
    const now = Date.UTC(2026, 4, 17);

    await AsyncStorage.setItem(
      "finalize-draft:fresh",
      JSON.stringify({ version: CURRENT_DRAFT_VERSION, savedAt: now - 5 * DAY, state: baseState() })
    );
    await AsyncStorage.setItem(
      "finalize-draft:stale",
      JSON.stringify({ version: CURRENT_DRAFT_VERSION, savedAt: now - 40 * DAY, state: baseState() })
    );
    await AsyncStorage.setItem(
      "finalize-draft:malformed",
      "not json"
    );
    await AsyncStorage.setItem("unrelated", "should be kept");

    await purgeStaleDrafts(now);

    expect(await AsyncStorage.getItem("finalize-draft:fresh")).not.toBeNull();
    expect(await AsyncStorage.getItem("finalize-draft:stale")).toBeNull();
    expect(await AsyncStorage.getItem("finalize-draft:malformed")).toBeNull();
    expect(await AsyncStorage.getItem("unrelated")).toBe("should be kept");
  });

  it("is a no-op when there are no draft keys", async () => {
    await AsyncStorage.setItem("unrelated", "x");
    await purgeStaleDrafts();
    expect(await AsyncStorage.getItem("unrelated")).toBe("x");
  });
});

describe("filterDraftToCurrentOrder", () => {
  it("drops itemPrices for items that no longer exist", () => {
    const state: FinalizeDraftState = {
      ...baseState(),
      itemPrices: { a: "10", b: "20", ghost: "99" },
    };
    const filtered = filterDraftToCurrentOrder(
      state,
      new Set(["a", "b"]),
      new Set(["p1"])
    );
    expect(filtered.itemPrices).toEqual({ a: "10", b: "20" });
  });

  it("drops payerAmounts for participants who left", () => {
    const state: FinalizeDraftState = {
      ...baseState(),
      payerAmounts: { p1: "30", departed: "5" },
    };
    const filtered = filterDraftToCurrentOrder(
      state,
      new Set(["a", "b"]),
      new Set(["p1"])
    );
    expect(filtered.payerAmounts).toEqual({ p1: "30" });
  });

  it("filters merge group itemIds; keeps groups with >= 2 survivors", () => {
    const state: FinalizeDraftState = {
      ...baseState(),
      mergeGroups: [
        { id: "g1", itemIds: ["a", "b", "ghost1", "ghost2"] },
        { id: "g2", itemIds: ["a", "ghost"] },
        { id: "g3", itemIds: ["ghost1", "ghost2"] },
      ],
    };
    const filtered = filterDraftToCurrentOrder(
      state,
      new Set(["a", "b"]),
      new Set(["p1"])
    );
    expect(filtered.mergeGroups).toEqual([
      { id: "g1", itemIds: ["a", "b"] },
      // g2 had only 'a' surviving → dropped
      // g3 had nothing surviving → dropped
    ]);
  });

  it("preserves untouched scalar fields", () => {
    const state: FinalizeDraftState = {
      ...baseState(),
      actualTotal: "123.45",
      delivery: "10",
      tax: "2",
    };
    const filtered = filterDraftToCurrentOrder(
      state,
      new Set(["a", "b"]),
      new Set(["p1"])
    );
    expect(filtered.actualTotal).toBe("123.45");
    expect(filtered.delivery).toBe("10");
    expect(filtered.tax).toBe("2");
  });
});
