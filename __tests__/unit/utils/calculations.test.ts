import {
  calculateSplit,
  CalcInput,
  CalcItem,
  CalcParticipant,
  CalcPayment,
} from "@/src/utils/calculations";

function makeInput(overrides: Partial<CalcInput> = {}): CalcInput {
  return {
    items: [],
    payments: [],
    participants: [],
    actualTotal: 0,
    tax: 0,
    vat: 0,
    delivery: 0,
    discount: 0,
    ...overrides,
  };
}

function makeParticipant(
  id: string,
  userId: string | null = null,
  guestId: string | null = null,
  hostUserId?: string
): CalcParticipant {
  return { id, userId: userId ?? id, guestId, hostUserId, isIncluded: true };
}

function makeGuest(
  id: string,
  guestId: string,
  hostUserId: string
): CalcParticipant {
  return { id, userId: null, guestId, hostUserId, isIncluded: true };
}

function makeItem(
  id: string,
  price: number,
  participantId: string,
  quantity = 1
): CalcItem {
  return {
    id,
    price,
    quantity,
    shares: [{ participantId, fraction: 1 }],
  };
}

function makeSharedItem(
  id: string,
  price: number,
  participantIds: string[],
  quantity = 1
): CalcItem {
  const fraction = 1 / participantIds.length;
  return {
    id,
    price,
    quantity,
    shares: participantIds.map((pid) => ({ participantId: pid, fraction })),
  };
}

// Helper to verify total owed sums to actualTotal
function expectTotalOwedEquals(result: any, expected: number) {
  const total = result.breakdowns.reduce(
    (s: number, b: any) => s + b.totalOwed,
    0
  );
  expect(Math.abs(total - expected)).toBeLessThan(0.02);
}

describe("Calculation Engine", () => {
  // ===========================================
  // BASIC SPLITS
  // ===========================================
  describe("Basic splits", () => {
    it("single participant, single item → owes full amount", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1")],
          items: [makeItem("i1", 50, "p1")],
          payments: [{ participantId: "p1", amount: 50 }],
          actualTotal: 50,
        })
      );
      expect(result.breakdowns[0].totalOwed).toBe(50);
      expect(result.breakdowns[0].net).toBe(0);
      expect(result.debts).toHaveLength(0);
    });

    it("two participants, one item each → each owes their item", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1"), makeParticipant("p2")],
          items: [makeItem("i1", 30, "p1"), makeItem("i2", 20, "p2")],
          payments: [{ participantId: "p1", amount: 50 }],
          actualTotal: 50,
        })
      );
      expect(result.breakdowns.find((b) => b.participantId === "p1")!.totalOwed).toBe(30);
      expect(result.breakdowns.find((b) => b.participantId === "p2")!.totalOwed).toBe(20);
    });

    it("three participants, equal items → equal split", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1"),
            makeParticipant("p2"),
            makeParticipant("p3"),
          ],
          items: [
            makeItem("i1", 30, "p1"),
            makeItem("i2", 30, "p2"),
            makeItem("i3", 30, "p3"),
          ],
          payments: [{ participantId: "p1", amount: 90 }],
          actualTotal: 90,
        })
      );
      for (const b of result.breakdowns) {
        expect(b.totalOwed).toBe(30);
      }
    });
  });

  // ===========================================
  // SHARED ITEMS
  // ===========================================
  describe("Shared items", () => {
    it("one shared item among 3 → equal thirds", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1"),
            makeParticipant("p2"),
            makeParticipant("p3"),
          ],
          items: [makeSharedItem("i1", 30, ["p1", "p2", "p3"])],
          payments: [{ participantId: "p1", amount: 30 }],
          actualTotal: 30,
        })
      );
      for (const b of result.breakdowns) {
        expect(b.totalOwed).toBe(10);
      }
    });

    it("mix of personal + shared items", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1"), makeParticipant("p2")],
          items: [
            makeItem("i1", 20, "p1"),
            makeSharedItem("i2", 10, ["p1", "p2"]),
          ],
          payments: [{ participantId: "p1", amount: 30 }],
          actualTotal: 30,
        })
      );
      expect(result.breakdowns.find((b) => b.participantId === "p1")!.totalOwed).toBe(25);
      expect(result.breakdowns.find((b) => b.participantId === "p2")!.totalOwed).toBe(5);
    });

    it("shared item with only 2 of 5 participants", () => {
      const pids = ["p1", "p2", "p3", "p4", "p5"];
      const result = calculateSplit(
        makeInput({
          participants: pids.map((id) => makeParticipant(id)),
          items: [makeSharedItem("i1", 100, ["p1", "p2"])],
          payments: [{ participantId: "p1", amount: 100 }],
          actualTotal: 100,
        })
      );
      expect(result.breakdowns.find((b) => b.participantId === "p1")!.totalOwed).toBe(50);
      expect(result.breakdowns.find((b) => b.participantId === "p2")!.totalOwed).toBe(50);
      expect(result.breakdowns.find((b) => b.participantId === "p3")!.totalOwed).toBe(0);
    });
  });

  // ===========================================
  // DELIVERY / TAX / VAT / DISCOUNT
  // ===========================================
  describe("Delivery, Tax, VAT, Discount", () => {
    it("delivery distributed proportionally", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1"), makeParticipant("p2")],
          items: [makeItem("i1", 60, "p1"), makeItem("i2", 40, "p2")],
          payments: [{ participantId: "p1", amount: 150 }],
          actualTotal: 150,
          delivery: 50,
        })
      );
      // p1: 60/100 * 50 = 30 delivery, p2: 40/100 * 50 = 20 delivery
      expect(result.breakdowns.find((b) => b.participantId === "p1")!.deliveryShare).toBe(30);
      expect(result.breakdowns.find((b) => b.participantId === "p2")!.deliveryShare).toBe(20);
      expectTotalOwedEquals(result, 150);
    });

    it("tax distributed proportionally", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1"), makeParticipant("p2")],
          items: [makeItem("i1", 60, "p1"), makeItem("i2", 40, "p2")],
          payments: [{ participantId: "p1", amount: 110 }],
          actualTotal: 110,
          tax: 10,
        })
      );
      expect(result.breakdowns.find((b) => b.participantId === "p1")!.taxShare).toBe(6);
      expect(result.breakdowns.find((b) => b.participantId === "p2")!.taxShare).toBe(4);
    });

    it("discount reduces proportionally", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1"), makeParticipant("p2")],
          items: [makeItem("i1", 60, "p1"), makeItem("i2", 40, "p2")],
          payments: [{ participantId: "p1", amount: 90 }],
          actualTotal: 90,
          discount: 10,
        })
      );
      expect(result.breakdowns.find((b) => b.participantId === "p1")!.discountShare).toBe(6);
      expect(result.breakdowns.find((b) => b.participantId === "p2")!.discountShare).toBe(4);
    });

    it("combined tax + vat + delivery + discount", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1"), makeParticipant("p2")],
          items: [makeItem("i1", 50, "p1"), makeItem("i2", 50, "p2")],
          payments: [{ participantId: "p1", amount: 125 }],
          actualTotal: 125,
          tax: 10,
          vat: 5,
          delivery: 20,
          discount: 10,
        })
      );
      const total = result.breakdowns.reduce((s, b) => s + b.totalOwed, 0);
      expect(total).toBeCloseTo(125, 1);
    });

    it("real scenario: 2 people, pizza order with delivery", () => {
      // Pizza Sea Ranch Large 300 (shared), Medium Pizza Burger 150 (bodz only)
      // Delivery 50, Actual total 500
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1", "u1"), // bodz
            makeParticipant("p2", "u2"), // Ahmed
          ],
          items: [
            makeSharedItem("i1", 300, ["p1", "p2"]),
            makeItem("i2", 150, "p1"),
          ],
          payments: [
            { participantId: "p1", amount: 350 },
            { participantId: "p2", amount: 150 },
          ],
          actualTotal: 500,
          delivery: 50,
        })
      );

      const bodz = result.breakdowns.find((b) => b.participantId === "p1")!;
      const ahmed = result.breakdowns.find((b) => b.participantId === "p2")!;

      // bodz items: 150 (half pizza) + 150 (burger) = 300
      // ahmed items: 150 (half pizza) = 150
      expect(bodz.itemsTotal).toBe(300);
      expect(ahmed.itemsTotal).toBe(150);

      // Delivery: bodz 300/450 * 50 = 33.33 → rounded to 33.5
      // ahmed 150/450 * 50 = 16.67 → rounded to 16.5
      expect(bodz.deliveryShare).toBeCloseTo(33.5, 1);
      expect(ahmed.deliveryShare).toBeCloseTo(16.5, 1);

      // Total owed: bodz ~333.5, ahmed ~166.5
      expect(bodz.totalOwed).toBeCloseTo(333.5, 0);
      expect(ahmed.totalOwed).toBeCloseTo(166.5, 0);

      expectTotalOwedEquals(result, 500);

      // bodz paid 350, owes 333.5 → gets back 16.5
      // ahmed paid 150, owes 166.5 → owes 16.5
      expect(bodz.net).toBeCloseTo(16.5, 0);
      expect(ahmed.net).toBeCloseTo(-16.5, 0);

      // One debt: ahmed → bodz 16.5
      expect(result.debts).toHaveLength(1);
      expect(result.debts[0].fromUserId).toBe("u2");
      expect(result.debts[0].toUserId).toBe("u1");
      expect(result.debts[0].amount).toBeCloseTo(16.5, 0);
    });

    it("real scenario: 3 people, shawarma with delivery and VAT", () => {
      // Chicken Shawarma 85 (Ahmed), Meat Shawarma 95 (bodz), Fries 45 (shared all)
      // Delivery 30, VAT 14%, Actual total = 225 + 31.5 + 30 = 286.50
      const items = 225; // 85 + 95 + 45
      const vatAmount = 31.5;
      const deliveryAmount = 30;
      const actualTotal = items + vatAmount + deliveryAmount;

      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1", "u1"), // bodz
            makeParticipant("p2", "u2"), // Ahmed
            makeParticipant("p3", "u3"), // Sara
          ],
          items: [
            makeItem("i1", 85, "p2"),  // Ahmed's shawarma
            makeItem("i2", 95, "p1"),  // bodz's shawarma
            makeSharedItem("i3", 45, ["p1", "p2", "p3"]), // shared fries
          ],
          payments: [{ participantId: "p1", amount: actualTotal }],
          actualTotal,
          vat: vatAmount,
          delivery: deliveryAmount,
        })
      );

      // bodz items: 95 + 15 = 110
      // Ahmed items: 85 + 15 = 100
      // Sara items: 15
      expect(result.breakdowns.find((b) => b.participantId === "p1")!.itemsTotal).toBe(110);
      expect(result.breakdowns.find((b) => b.participantId === "p2")!.itemsTotal).toBe(100);
      expect(result.breakdowns.find((b) => b.participantId === "p3")!.itemsTotal).toBe(15);

      expectTotalOwedEquals(result, actualTotal);

      // bodz paid everything → two debts pointing to bodz
      expect(result.debts.every((d) => d.toUserId === "u1")).toBe(true);
      expect(result.debts.length).toBe(2);
    });
  });

  // ===========================================
  // MULTI-PAYER
  // ===========================================
  describe("Multi-payer", () => {
    it("one payer, multiple owers → correct debts", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1"),
            makeParticipant("p2"),
            makeParticipant("p3"),
          ],
          items: [
            makeItem("i1", 30, "p1"),
            makeItem("i2", 30, "p2"),
            makeItem("i3", 30, "p3"),
          ],
          payments: [{ participantId: "p1", amount: 90 }],
          actualTotal: 90,
        })
      );
      expect(result.debts).toHaveLength(2);
      expect(result.debts.every((d) => d.toUserId === "p1")).toBe(true);
    });

    it("two payers each paying their share → no debts", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1"), makeParticipant("p2")],
          items: [makeItem("i1", 50, "p1"), makeItem("i2", 50, "p2")],
          payments: [
            { participantId: "p1", amount: 50 },
            { participantId: "p2", amount: 50 },
          ],
          actualTotal: 100,
        })
      );
      expect(result.debts).toHaveLength(0);
    });

    it("payer who also ordered → net offset", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1"), makeParticipant("p2")],
          items: [makeItem("i1", 70, "p1"), makeItem("i2", 30, "p2")],
          payments: [{ participantId: "p1", amount: 100 }],
          actualTotal: 100,
        })
      );
      expect(result.debts).toHaveLength(1);
      expect(result.debts[0].fromUserId).toBe("p2");
      expect(result.debts[0].toUserId).toBe("p1");
      expect(result.debts[0].amount).toBe(30);
    });

    it("all pay equally → zero net", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1"),
            makeParticipant("p2"),
            makeParticipant("p3"),
          ],
          items: [
            makeItem("i1", 30, "p1"),
            makeItem("i2", 30, "p2"),
            makeItem("i3", 30, "p3"),
          ],
          payments: [
            { participantId: "p1", amount: 30 },
            { participantId: "p2", amount: 30 },
            { participantId: "p3", amount: 30 },
          ],
          actualTotal: 90,
        })
      );
      expect(result.debts).toHaveLength(0);
    });

    it("one person paid 80% of bill", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1", "u1"), makeParticipant("p2", "u2")],
          items: [makeItem("i1", 100, "p1"), makeItem("i2", 100, "p2")],
          payments: [
            { participantId: "p1", amount: 160 }, // 80%
            { participantId: "p2", amount: 40 },   // 20%
          ],
          actualTotal: 200,
        })
      );
      // p1 owes 100, paid 160 → net +60
      // p2 owes 100, paid 40 → net -60
      expect(result.debts).toHaveLength(1);
      expect(result.debts[0].fromUserId).toBe("u2");
      expect(result.debts[0].toUserId).toBe("u1");
      expect(result.debts[0].amount).toBe(60);
    });
  });

  // ===========================================
  // GUEST HANDLING
  // ===========================================
  describe("Guest handling", () => {
    it("guest debt transfers to host", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1", "u1"), // host
            makeGuest("p2", "g1", "u1"), // guest of u1
          ],
          items: [makeItem("i1", 50, "p1"), makeItem("i2", 50, "p2")],
          payments: [{ participantId: "p1", amount: 100 }],
          actualTotal: 100,
        })
      );
      const host = result.breakdowns.find((b) => b.userId === "u1")!;
      const guest = result.breakdowns.find((b) => b.guestId === "g1")!;
      expect(host.net).toBe(0);
      expect(guest.net).toBe(0);
      // Inter-user debts: none (host paid everything)
      const userDebts = result.debts.filter((d) => !d.fromUserId.startsWith("guest:") && !d.toUserId.startsWith("guest:"));
      expect(userDebts).toHaveLength(0);
      // Guest settlement: guest owes host 50
      const guestDebts = result.debts.filter((d) => d.fromUserId.startsWith("guest:") || d.toUserId.startsWith("guest:"));
      expect(guestDebts).toHaveLength(1);
      expect(guestDebts[0].fromUserId).toBe("guest:g1");
      expect(guestDebts[0].amount).toBe(50);
    });

    it("guest debt transfers to host who didnt pay → host owes payer + guest owes host", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1", "u1"), // host (didn't pay)
            makeParticipant("p2", "u2"), // payer
            makeGuest("p3", "g1", "u1"), // guest of u1
          ],
          items: [
            makeItem("i1", 30, "p1"),
            makeItem("i2", 40, "p2"),
            makeItem("i3", 30, "p3"),
          ],
          payments: [{ participantId: "p2", amount: 100 }],
          actualTotal: 100,
        })
      );
      // Inter-user: u1 → u2 = 60
      const userDebts = result.debts.filter((d) => !d.fromUserId.startsWith("guest:") && !d.toUserId.startsWith("guest:"));
      expect(userDebts).toHaveLength(1);
      expect(userDebts[0].fromUserId).toBe("u1");
      expect(userDebts[0].toUserId).toBe("u2");
      expect(userDebts[0].amount).toBe(60);
    });

    it("multiple guests on same host → host owes payer, guests owe host", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1", "u1"),
            makeParticipant("p2", "u2"),
            makeGuest("g1", "guest1", "u1"),
            makeGuest("g2", "guest2", "u1"),
          ],
          items: [
            makeItem("i1", 25, "p1"),
            makeItem("i2", 25, "p2"),
            makeItem("i3", 25, "g1"),
            makeItem("i4", 25, "g2"),
          ],
          payments: [{ participantId: "p2", amount: 100 }],
          actualTotal: 100,
        })
      );
      const userDebts = result.debts.filter((d) => !d.fromUserId.startsWith("guest:") && !d.toUserId.startsWith("guest:"));
      expect(userDebts).toHaveLength(1);
      expect(userDebts[0].fromUserId).toBe("u1");
      expect(userDebts[0].amount).toBe(75);
    });

    it("guest with shared items → host responsible for guest share", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1", "u1"),
            makeParticipant("p2", "u2"),
            makeGuest("g1", "guest1", "u1"),
          ],
          items: [
            makeSharedItem("i1", 90, ["p1", "p2", "g1"]),
          ],
          payments: [{ participantId: "p2", amount: 90 }],
          actualTotal: 90,
        })
      );
      const userDebts = result.debts.filter((d) => !d.fromUserId.startsWith("guest:") && !d.toUserId.startsWith("guest:"));
      expect(userDebts).toHaveLength(1);
      expect(userDebts[0].fromUserId).toBe("u1");
      expect(userDebts[0].toUserId).toBe("u2");
      expect(userDebts[0].amount).toBe(60);
    });

    it("guest + delivery → guest's delivery share goes to host", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1", "u1"),
            makeGuest("g1", "guest1", "u1"),
            makeParticipant("p2", "u2"),
          ],
          items: [
            makeItem("i1", 100, "p1"),
            makeItem("i2", 100, "g1"),
            makeItem("i3", 100, "p2"),
          ],
          payments: [{ participantId: "p2", amount: 330 }],
          actualTotal: 330,
          delivery: 30,
        })
      );
      const userDebts = result.debts.filter((d) => !d.fromUserId.startsWith("guest:") && !d.toUserId.startsWith("guest:"));
      expect(userDebts).toHaveLength(1);
      expect(userDebts[0].fromUserId).toBe("u1");
      expect(userDebts[0].toUserId).toBe("u2");
      expect(userDebts[0].amount).toBe(220);
      expectTotalOwedEquals(result, 330);
    });

    it("two hosts with guests", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1", "u1"),
            makeGuest("g1", "guest1", "u1"),
            makeParticipant("p2", "u2"),
            makeGuest("g2", "guest2", "u2"),
          ],
          items: [
            makeItem("i1", 50, "p1"),
            makeItem("i2", 50, "g1"),
            makeItem("i3", 50, "p2"),
            makeItem("i4", 50, "g2"),
          ],
          payments: [{ participantId: "p1", amount: 200 }],
          actualTotal: 200,
        })
      );
      const userDebts = result.debts.filter((d) => !d.fromUserId.startsWith("guest:") && !d.toUserId.startsWith("guest:"));
      expect(userDebts).toHaveLength(1);
      expect(userDebts[0].fromUserId).toBe("u2");
      expect(userDebts[0].toUserId).toBe("u1");
      expect(userDebts[0].amount).toBe(100);
    });

    it("guest who overpaid → host owes guest back", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1", "u1"),
            makeGuest("g1", "guest1", "u1"),
          ],
          items: [
            makeItem("i1", 400, "p1"),
            makeItem("i2", 100, "g1"),
          ],
          payments: [
            { participantId: "p1", amount: 200 },
            { participantId: "g1", amount: 320 },
          ],
          actualTotal: 520,
          delivery: 20,
        })
      );
      // guest owes 104, paid 320 → overpaid 216
      // host owes 416, paid 200 → underpaid 216
      // Settlement: host owes guest 216
      const guestDebts = result.debts.filter((d) => d.toUserId.startsWith("guest:"));
      expect(guestDebts).toHaveLength(1);
      expect(guestDebts[0].fromUserId).toBe("u1");
      expect(guestDebts[0].toUserId).toBe("guest:guest1");
      expect(guestDebts[0].amount).toBeCloseTo(216, 0);
    });

    it("guest who is assigned no items → zero debt to host", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1", "u1"),
            makeParticipant("p2", "u2"),
            makeGuest("g1", "guest1", "u1"),
          ],
          items: [
            makeItem("i1", 50, "p1"),
            makeItem("i2", 50, "p2"),
          ],
          payments: [{ participantId: "p1", amount: 100 }],
          actualTotal: 100,
        })
      );
      const guest = result.breakdowns.find((b) => b.guestId === "guest1")!;
      expect(guest.totalOwed).toBe(0);
      expect(result.debts).toHaveLength(1);
      expect(result.debts[0].fromUserId).toBe("u2");
      expect(result.debts[0].amount).toBe(50);
    });
  });

  // ===========================================
  // ROUNDING
  // ===========================================
  describe("Rounding", () => {
    it("3-way split of 10.00 → totals match exactly", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1"),
            makeParticipant("p2"),
            makeParticipant("p3"),
          ],
          items: [makeSharedItem("i1", 10, ["p1", "p2", "p3"])],
          payments: [{ participantId: "p1", amount: 10 }],
          actualTotal: 10,
        })
      );
      expectTotalOwedEquals(result, 10);
    });

    it("7-way split of 100 → no penny lost", () => {
      const pids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
      const result = calculateSplit(
        makeInput({
          participants: pids.map((id) => makeParticipant(id)),
          items: [makeSharedItem("i1", 100, pids)],
          payments: [{ participantId: "p1", amount: 100 }],
          actualTotal: 100,
        })
      );
      expectTotalOwedEquals(result, 100);
    });

    it("3-way split of 100 with delivery 10 → 110 total exact", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1"),
            makeParticipant("p2"),
            makeParticipant("p3"),
          ],
          items: [makeSharedItem("i1", 100, ["p1", "p2", "p3"])],
          payments: [{ participantId: "p1", amount: 110 }],
          actualTotal: 110,
          delivery: 10,
        })
      );
      expectTotalOwedEquals(result, 110);
    });
  });

  // ===========================================
  // REAL-WORLD SCENARIOS
  // ===========================================
  describe("Real-world scenarios", () => {
    it("office lunch: 4 people, mixed items, one pays with delivery", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1", "u1"),
            makeParticipant("p2", "u2"),
            makeParticipant("p3", "u3"),
            makeParticipant("p4", "u4"),
          ],
          items: [
            makeItem("i1", 120, "p1"),  // u1's meal
            makeItem("i2", 85, "p2"),   // u2's meal
            makeItem("i3", 95, "p3"),   // u3's meal
            makeItem("i4", 75, "p4"),   // u4's meal
            makeSharedItem("i5", 40, ["p1", "p2", "p3", "p4"]), // shared appetizer
          ],
          payments: [{ participantId: "p1", amount: 465 }],
          actualTotal: 465,
          delivery: 50,
        })
      );

      expectTotalOwedEquals(result, 465);
      // u1 paid everything → 3 debts pointing to u1
      expect(result.debts.every((d) => d.toUserId === "u1")).toBe(true);
      expect(result.debts.length).toBe(3);
      // All debt amounts should be positive
      expect(result.debts.every((d) => d.amount > 0)).toBe(true);
    });

    it("roommate delivery: host + 2 guests, one guest shared item", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1", "u1"),    // host
            makeParticipant("p2", "u2"),    // roommate
            makeGuest("g1", "guest1", "u1"), // u1's friend
          ],
          items: [
            makeItem("i1", 80, "p1"),
            makeItem("i2", 60, "p2"),
            makeItem("i3", 70, "g1"),  // guest's item
            makeSharedItem("i4", 30, ["p1", "g1"]), // shared between host and guest
          ],
          payments: [{ participantId: "p2", amount: 280 }],
          actualTotal: 280,
          delivery: 40,
        })
      );

      expectTotalOwedEquals(result, 280);
      // u1 responsible for: own items + guest items
      // u2 paid everything
      const userDebts = result.debts.filter((d) => !d.fromUserId.startsWith("guest:") && !d.toUserId.startsWith("guest:"));
      expect(userDebts.length).toBe(1);
      expect(userDebts[0].fromUserId).toBe("u1");
      expect(userDebts[0].toUserId).toBe("u2");
    });

    it("discount applied: 10% off total", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1", "u1"), makeParticipant("p2", "u2")],
          items: [makeItem("i1", 100, "p1"), makeItem("i2", 100, "p2")],
          payments: [{ participantId: "p1", amount: 180 }],
          actualTotal: 180,
          discount: 20,
        })
      );

      // Each gets 10 off their 100
      expect(result.breakdowns.find((b) => b.participantId === "p1")!.totalOwed).toBe(90);
      expect(result.breakdowns.find((b) => b.participantId === "p2")!.totalOwed).toBe(90);
      expectTotalOwedEquals(result, 180);
    });
  });

  // ===========================================
  // EDGE CASES
  // ===========================================
  describe("Edge cases", () => {
    it("no items (empty order) → zero owed", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1")],
          items: [],
          payments: [],
          actualTotal: 0,
        })
      );
      expect(result.breakdowns[0]?.totalOwed ?? 0).toBe(0);
    });

    it("single participant pays everything → net zero", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1")],
          items: [makeItem("i1", 100, "p1")],
          payments: [{ participantId: "p1", amount: 100 }],
          actualTotal: 100,
        })
      );
      expect(result.breakdowns[0].net).toBe(0);
      expect(result.debts).toHaveLength(0);
    });

    it("participant with no items but included → owes nothing from items", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1"), makeParticipant("p2")],
          items: [makeItem("i1", 100, "p1")],
          payments: [{ participantId: "p1", amount: 100 }],
          actualTotal: 100,
        })
      );
      expect(result.breakdowns.find((b) => b.participantId === "p2")!.totalOwed).toBe(0);
    });

    it("excluded participant → not in breakdowns", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1"),
            { id: "p2", userId: "p2", guestId: null, isIncluded: false },
          ],
          items: [makeItem("i1", 100, "p1")],
          payments: [{ participantId: "p1", amount: 100 }],
          actualTotal: 100,
        })
      );
      expect(result.breakdowns).toHaveLength(1);
      expect(result.breakdowns[0].participantId).toBe("p1");
    });

    it("large amount with many participants → totals still exact", () => {
      const pids = Array.from({ length: 15 }, (_, i) => `p${i + 1}`);
      const result = calculateSplit(
        makeInput({
          participants: pids.map((id) => makeParticipant(id)),
          items: [makeSharedItem("i1", 9999.99, pids)],
          payments: [{ participantId: "p1", amount: 10499.99 }],
          actualTotal: 10499.99,
          delivery: 500,
        })
      );
      expectTotalOwedEquals(result, 10499.99);
    });
  });
});
