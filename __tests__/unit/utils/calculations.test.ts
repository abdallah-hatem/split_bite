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

describe("Calculation Engine", () => {
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

  describe("Shared items", () => {
    it("one shared item among 3 → equal thirds", () => {
      const participants = [
        makeParticipant("p1"),
        makeParticipant("p2"),
        makeParticipant("p3"),
      ];
      const result = calculateSplit(
        makeInput({
          participants,
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
            makeItem("i1", 20, "p1"), // personal
            makeSharedItem("i2", 10, ["p1", "p2"]), // shared
          ],
          payments: [{ participantId: "p1", amount: 30 }],
          actualTotal: 30,
        })
      );
      // p1: 20 + 5 = 25, p2: 5
      expect(result.breakdowns.find((b) => b.participantId === "p1")!.totalOwed).toBe(25);
      expect(result.breakdowns.find((b) => b.participantId === "p2")!.totalOwed).toBe(5);
    });

    it("shared item with only 2 of 5 participants", () => {
      const participants = ["p1", "p2", "p3", "p4", "p5"].map((id) =>
        makeParticipant(id)
      );
      const result = calculateSplit(
        makeInput({
          participants,
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

  describe("Bill discrepancy (adjustment_ratio)", () => {
    it("actual_total > sum(items) → proportional increase", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1"), makeParticipant("p2")],
          items: [makeItem("i1", 40, "p1"), makeItem("i2", 60, "p2")],
          payments: [{ participantId: "p1", amount: 120 }],
          actualTotal: 120, // items sum to 100
        })
      );
      // 40/100 * 120 = 48, 60/100 * 120 = 72
      expect(result.breakdowns.find((b) => b.participantId === "p1")!.totalOwed).toBe(48);
      expect(result.breakdowns.find((b) => b.participantId === "p2")!.totalOwed).toBe(72);
    });

    it("actual_total < sum(items) → proportional decrease", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1"), makeParticipant("p2")],
          items: [makeItem("i1", 50, "p1"), makeItem("i2", 50, "p2")],
          payments: [{ participantId: "p1", amount: 80 }],
          actualTotal: 80, // items sum to 100
        })
      );
      expect(result.breakdowns.find((b) => b.participantId === "p1")!.totalOwed).toBe(40);
      expect(result.breakdowns.find((b) => b.participantId === "p2")!.totalOwed).toBe(40);
    });

    it("actual_total == sum(items) → no adjustment", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1")],
          items: [makeItem("i1", 100, "p1")],
          payments: [{ participantId: "p1", amount: 100 }],
          actualTotal: 100,
        })
      );
      expect(result.adjustmentRatio).toBe(1);
      expect(result.breakdowns[0].totalOwed).toBe(100);
    });
  });

  describe("Tax/tip/discount", () => {
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

    it("delivery distributed proportionally", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1"), makeParticipant("p2")],
          items: [makeItem("i1", 50, "p1"), makeItem("i2", 50, "p2")],
          payments: [{ participantId: "p1", amount: 120 }],
          actualTotal: 120,
          delivery: 20,
        })
      );
      expect(result.breakdowns.find((b) => b.participantId === "p1")!.deliveryShare).toBe(10);
      expect(result.breakdowns.find((b) => b.participantId === "p2")!.deliveryShare).toBe(10);
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
  });

  describe("Multi-payer", () => {
    it("one payer, multiple owers → correct net balances", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1"), makeParticipant("p2"), makeParticipant("p3")],
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

    it("two payers splitting payment → correct credits", () => {
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
      expect(result.debts).toHaveLength(0); // everyone paid their share
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
      // p1 owes 70, paid 100 → net +30
      // p2 owes 30, paid 0 → net -30
      expect(result.debts).toHaveLength(1);
      expect(result.debts[0].fromUserId).toBe("p2");
      expect(result.debts[0].toUserId).toBe("p1");
      expect(result.debts[0].amount).toBe(30);
    });

    it("all participants pay equally → zero net", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1"), makeParticipant("p2"), makeParticipant("p3")],
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
  });

  describe("Guest handling", () => {
    it("guest debt transfers to host", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1", "u1"), // host
            { id: "p2", userId: null, guestId: "g1", hostUserId: "u1", isIncluded: true },
          ],
          items: [makeItem("i1", 50, "p1"), makeItem("i2", 50, "p2")],
          payments: [{ participantId: "p1", amount: 100 }],
          actualTotal: 100,
        })
      );
      // Guest's net transferred to host, so host's net = 0 (paid 100, owes 50 + guest's 50)
      const hostBreakdown = result.breakdowns.find((b) => b.userId === "u1");
      expect(hostBreakdown!.net).toBe(0);
    });

    it("multiple guests on same host → debts aggregate", () => {
      const result = calculateSplit(
        makeInput({
          participants: [
            makeParticipant("p1", "u1"),
            makeParticipant("p2", "u2"),
            { id: "g1", userId: null, guestId: "guest1", hostUserId: "u1", isIncluded: true },
            { id: "g2", userId: null, guestId: "guest2", hostUserId: "u1", isIncluded: true },
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
      // u1 owes 25 + guest1's 25 + guest2's 25 = 75
      // u2 owes 25, paid 100 → net +75
      expect(result.debts).toHaveLength(1);
      expect(result.debts[0].fromUserId).toBe("u1");
      expect(result.debts[0].amount).toBe(75);
    });
  });

  describe("Rounding", () => {
    it("3-way split of $10.00 → totals match exactly", () => {
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
      const total = result.breakdowns.reduce((s, b) => s + b.totalOwed, 0);
      expect(total).toBeCloseTo(10, 2);
    });

    it("7-way split of $100 → no penny lost", () => {
      const pids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
      const result = calculateSplit(
        makeInput({
          participants: pids.map((id) => makeParticipant(id)),
          items: [makeSharedItem("i1", 100, pids)],
          payments: [{ participantId: "p1", amount: 100 }],
          actualTotal: 100,
        })
      );
      const total = result.breakdowns.reduce((s, b) => s + b.totalOwed, 0);
      expect(total).toBeCloseTo(100, 2);
    });
  });

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

    it("items sum matches actual total → adjustment ratio 1", () => {
      const result = calculateSplit(
        makeInput({
          participants: [makeParticipant("p1")],
          items: [makeItem("i1", 55.5, "p1")],
          payments: [{ participantId: "p1", amount: 55.5 }],
          actualTotal: 55.5,
        })
      );
      expect(result.adjustmentRatio).toBe(1);
    });
  });
});
