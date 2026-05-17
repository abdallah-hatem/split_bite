import {
  deriveDisplayRows,
  applyPriceToRow,
  mergeIntoGroup,
  unmergeGroup,
  MergeGroup,
} from "@/src/utils/finalizeMerge";

const items = [
  { id: "a", name: "Pizza" },
  { id: "b", name: "pizza" },
  { id: "c", name: "Margherita" },
  { id: "d", name: "Cheese pizza" },
  { id: "e", name: "Salad" },
];

describe("deriveDisplayRows", () => {
  it("no groups → 1:1 with items, order preserved", () => {
    const rows = deriveDisplayRows(items, []);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.kind === "item")).toBe(true);
    expect(rows.map((r: any) => r.itemId)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("one group → group row at the first member's position, others removed", () => {
    const groups: MergeGroup[] = [{ id: "g1", itemIds: ["b", "c", "d"] }];
    const rows = deriveDisplayRows(items, groups);
    expect(rows).toHaveLength(3); // a, group (at b's position), e
    expect(rows[0]).toEqual({ kind: "item", itemId: "a" });
    expect(rows[1]).toEqual({
      kind: "group",
      groupId: "g1",
      itemIds: ["b", "c", "d"],
      displayNameSourceId: "b",
    });
    expect(rows[2]).toEqual({ kind: "item", itemId: "e" });
  });

  it("two non-overlapping groups → each at its first member's position", () => {
    const groups: MergeGroup[] = [
      { id: "g1", itemIds: ["a", "b"] },
      { id: "g2", itemIds: ["c", "d"] },
    ];
    const rows = deriveDisplayRows(items, groups);
    expect(rows).toHaveLength(3); // g1 (at a), g2 (at c), e
    expect(rows[0]).toMatchObject({ kind: "group", groupId: "g1" });
    expect(rows[1]).toMatchObject({ kind: "group", groupId: "g2" });
    expect(rows[2]).toMatchObject({ kind: "item", itemId: "e" });
  });

  it("group with fewer than 2 items is ignored (defensive)", () => {
    const groups: MergeGroup[] = [{ id: "g1", itemIds: ["a"] }];
    const rows = deriveDisplayRows(items, groups);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.kind === "item")).toBe(true);
  });
});

describe("applyPriceToRow", () => {
  it("applies a price to a single item only", () => {
    const prices = { a: "10", b: "20" };
    const next = applyPriceToRow(
      { kind: "item", itemId: "a" },
      "50",
      prices
    );
    expect(next).toEqual({ a: "50", b: "20" });
  });

  it("applies a price to every item in a group", () => {
    const prices = { a: "10", b: "20", c: "30" };
    const next = applyPriceToRow(
      {
        kind: "group",
        groupId: "g1",
        itemIds: ["a", "b", "c"],
        displayNameSourceId: "a",
      },
      "75",
      prices
    );
    expect(next).toEqual({ a: "75", b: "75", c: "75" });
  });

  it("does not mutate the input prices map", () => {
    const prices = { a: "10" };
    applyPriceToRow({ kind: "item", itemId: "a" }, "50", prices);
    expect(prices).toEqual({ a: "10" });
  });
});

describe("mergeIntoGroup", () => {
  it("creates a new group from 2+ items", () => {
    const next = mergeIntoGroup([], ["a", "b"], "g1");
    expect(next).toEqual([{ id: "g1", itemIds: ["a", "b"] }]);
  });

  it("ignores attempts to merge fewer than 2 items", () => {
    const next = mergeIntoGroup([], ["a"], "g1");
    expect(next).toEqual([]);
  });

  it("flattens overlapping existing groups into the new group", () => {
    const existing: MergeGroup[] = [{ id: "g1", itemIds: ["a", "b"] }];
    const next = mergeIntoGroup(existing, ["b", "c"], "g2");
    // b overlaps with g1 → g1's items (a, b) merge with new (b, c) into one group
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("g2");
    // Order: the new merge starts with b, c (user-selected order), then anything
    // pulled in from existing groups.
    expect(next[0].itemIds).toEqual(["b", "c", "a"]);
  });

  it("leaves non-overlapping existing groups untouched", () => {
    const existing: MergeGroup[] = [{ id: "g1", itemIds: ["a", "b"] }];
    const next = mergeIntoGroup(existing, ["c", "d"], "g2");
    expect(next).toHaveLength(2);
    expect(next.find((g) => g.id === "g1")!.itemIds).toEqual(["a", "b"]);
    expect(next.find((g) => g.id === "g2")!.itemIds).toEqual(["c", "d"]);
  });
});

describe("unmergeGroup", () => {
  it("removes the named group", () => {
    const existing: MergeGroup[] = [
      { id: "g1", itemIds: ["a", "b"] },
      { id: "g2", itemIds: ["c", "d"] },
    ];
    const next = unmergeGroup(existing, "g1");
    expect(next).toEqual([{ id: "g2", itemIds: ["c", "d"] }]);
  });

  it("is a no-op for an unknown group id", () => {
    const existing: MergeGroup[] = [{ id: "g1", itemIds: ["a", "b"] }];
    const next = unmergeGroup(existing, "g999");
    expect(next).toEqual(existing);
  });
});
