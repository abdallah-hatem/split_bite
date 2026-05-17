import {
  aggregateSpendingStats,
  StatsOrder,
} from "@/src/utils/spendingStats";

const ME = "user-me";
const OTHER = "user-other";

function makeOrder(overrides: Partial<StatsOrder>): StatsOrder {
  return {
    id: overrides.id ?? "o1",
    title: overrides.title ?? "Test order",
    finalized_at: overrides.finalized_at ?? "2026-05-17T12:00:00Z",
    actual_total: overrides.actual_total ?? 100,
    tax: overrides.tax ?? 0,
    vat: overrides.vat ?? 0,
    delivery: overrides.delivery ?? 0,
    discount: overrides.discount ?? 0,
    group: overrides.group ?? { id: "g1", name: "Friends" },
    items: overrides.items ?? [],
    order_participants: overrides.order_participants ?? [],
    payments: overrides.payments ?? [],
  };
}

describe("aggregateSpendingStats", () => {
  it("returns zeros when there are no orders", () => {
    expect(aggregateSpendingStats([], ME)).toEqual({
      totalSpent: 0,
      orderCount: 0,
      itemCount: 0,
      byOrder: [],
      byItem: [],
    });
  });

  it("skips orders where the user is not a participant", () => {
    const o = makeOrder({
      order_participants: [
        { id: "p1", user_id: OTHER, guest_id: null },
      ],
      items: [
        {
          id: "i1",
          name: "Pizza",
          price: 100,
          quantity: 1,
          added_by_participant_id: "p1",
          item_shares: [{ participant_id: "p1", share_fraction: 1 }],
        },
      ],
      payments: [{ participant_id: "p1", amount: 100 }],
    });
    const stats = aggregateSpendingStats([o], ME);
    expect(stats.totalSpent).toBe(0);
    expect(stats.byOrder).toHaveLength(0);
  });

  it("totals my share of a solo item", () => {
    const o = makeOrder({
      order_participants: [
        { id: "pme", user_id: ME, guest_id: null },
      ],
      items: [
        {
          id: "i1",
          name: "Burger",
          price: 100,
          quantity: 1,
          added_by_participant_id: "pme",
          item_shares: [{ participant_id: "pme", share_fraction: 1 }],
        },
      ],
      payments: [{ participant_id: "pme", amount: 100 }],
    });
    const stats = aggregateSpendingStats([o], ME);
    expect(stats.totalSpent).toBe(100);
    expect(stats.orderCount).toBe(1);
    expect(stats.itemCount).toBe(1);
    expect(stats.byOrder[0]).toMatchObject({ amount: 100, title: "Test order" });
    expect(stats.byItem[0]).toEqual({ name: "Burger", amount: 100, count: 1 });
  });

  it("splits a shared item fairly", () => {
    const o = makeOrder({
      order_participants: [
        { id: "pme", user_id: ME, guest_id: null },
        { id: "pother", user_id: OTHER, guest_id: null },
      ],
      items: [
        {
          id: "i1",
          name: "Pizza",
          price: 100,
          quantity: 1,
          added_by_participant_id: "pme",
          item_shares: [
            { participant_id: "pme", share_fraction: 0.5 },
            { participant_id: "pother", share_fraction: 0.5 },
          ],
        },
      ],
      payments: [{ participant_id: "pme", amount: 100 }],
    });
    const stats = aggregateSpendingStats([o], ME);
    expect(stats.totalSpent).toBe(50);
    expect(stats.byItem[0]).toEqual({ name: "Pizza", amount: 50, count: 1 });
  });

  it("includes tax and delivery in totalSpent (via calc engine adjustment)", () => {
    const o = makeOrder({
      actual_total: 130,
      delivery: 30,
      order_participants: [
        { id: "pme", user_id: ME, guest_id: null },
      ],
      items: [
        {
          id: "i1",
          name: "Burger",
          price: 100,
          quantity: 1,
          added_by_participant_id: "pme",
          item_shares: [{ participant_id: "pme", share_fraction: 1 }],
        },
      ],
      payments: [{ participant_id: "pme", amount: 130 }],
    });
    const stats = aggregateSpendingStats([o], ME);
    // 100 item + 30 delivery — full bill assigned to me.
    expect(stats.totalSpent).toBe(130);
    // byItem only shows raw item share (no delivery).
    expect(stats.byItem[0]).toEqual({ name: "Burger", amount: 100, count: 1 });
  });

  it("aggregates the same item name across orders (case-insensitive trim)", () => {
    const mkOrder = (id: string, name: string): StatsOrder =>
      makeOrder({
        id,
        actual_total: 50,
        order_participants: [{ id: "pme", user_id: ME, guest_id: null }],
        items: [
          {
            id: `${id}-item`,
            name,
            price: 50,
            quantity: 1,
            added_by_participant_id: "pme",
            item_shares: [{ participant_id: "pme", share_fraction: 1 }],
          },
        ],
        payments: [{ participant_id: "pme", amount: 50 }],
      });
    const stats = aggregateSpendingStats(
      [mkOrder("a", "Pizza"), mkOrder("b", " pizza "), mkOrder("c", "PIZZA")],
      ME
    );
    expect(stats.byItem).toHaveLength(1);
    expect(stats.byItem[0]).toEqual({ name: "Pizza", amount: 150, count: 3 });
  });

  it("sorts byOrder and byItem descending by amount", () => {
    const o1 = makeOrder({
      id: "o1",
      title: "Small",
      actual_total: 40,
      order_participants: [{ id: "p1", user_id: ME, guest_id: null }],
      items: [
        {
          id: "i1",
          name: "Coffee",
          price: 40,
          quantity: 1,
          added_by_participant_id: "p1",
          item_shares: [{ participant_id: "p1", share_fraction: 1 }],
        },
      ],
      payments: [{ participant_id: "p1", amount: 40 }],
    });
    const o2 = makeOrder({
      id: "o2",
      title: "Big",
      actual_total: 200,
      order_participants: [{ id: "p2", user_id: ME, guest_id: null }],
      items: [
        {
          id: "i2",
          name: "Steak",
          price: 200,
          quantity: 1,
          added_by_participant_id: "p2",
          item_shares: [{ participant_id: "p2", share_fraction: 1 }],
        },
      ],
      payments: [{ participant_id: "p2", amount: 200 }],
    });
    const stats = aggregateSpendingStats([o1, o2], ME);
    expect(stats.byOrder.map((r) => r.title)).toEqual(["Big", "Small"]);
    expect(stats.byItem.map((r) => r.name)).toEqual(["Steak", "Coffee"]);
  });

  it("excludes items the user has no share in", () => {
    const o = makeOrder({
      order_participants: [
        { id: "pme", user_id: ME, guest_id: null },
        { id: "pother", user_id: OTHER, guest_id: null },
      ],
      items: [
        {
          id: "i1",
          name: "Mine",
          price: 50,
          quantity: 1,
          added_by_participant_id: "pme",
          item_shares: [{ participant_id: "pme", share_fraction: 1 }],
        },
        {
          id: "i2",
          name: "Theirs",
          price: 50,
          quantity: 1,
          added_by_participant_id: "pother",
          item_shares: [{ participant_id: "pother", share_fraction: 1 }],
        },
      ],
      payments: [{ participant_id: "pme", amount: 100 }],
    });
    const stats = aggregateSpendingStats([o], ME);
    expect(stats.byItem.map((r) => r.name)).toEqual(["Mine"]);
    // totalSpent is the calc-engine breakdown for me, which is just my items + my share of overhead.
    expect(stats.totalSpent).toBe(50);
  });
});
