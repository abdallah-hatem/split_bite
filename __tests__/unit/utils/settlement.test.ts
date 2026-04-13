import {
  computeNetBalances,
  optimizeSettlements,
  Balance,
} from "@/src/utils/settlement";

describe("Settlement Optimization", () => {
  describe("computeNetBalances", () => {
    it("computes correct net from ledger entries", () => {
      const balances = computeNetBalances([
        { fromUserId: "A", toUserId: "B", amount: 30 },
        { fromUserId: "A", toUserId: "C", amount: 20 },
      ]);
      expect(balances.find((b) => b.userId === "A")!.amount).toBe(-50);
      expect(balances.find((b) => b.userId === "B")!.amount).toBe(30);
      expect(balances.find((b) => b.userId === "C")!.amount).toBe(20);
    });

    it("nets out opposing debts", () => {
      const balances = computeNetBalances([
        { fromUserId: "A", toUserId: "B", amount: 50 },
        { fromUserId: "B", toUserId: "A", amount: 30 },
      ]);
      expect(balances.find((b) => b.userId === "A")!.amount).toBe(-20);
      expect(balances.find((b) => b.userId === "B")!.amount).toBe(20);
    });

    it("filters out zero balances", () => {
      const balances = computeNetBalances([
        { fromUserId: "A", toUserId: "B", amount: 50 },
        { fromUserId: "B", toUserId: "A", amount: 50 },
      ]);
      expect(balances).toHaveLength(0);
    });
  });

  describe("optimizeSettlements", () => {
    it("two people, one debt → single transaction", () => {
      const settlements = optimizeSettlements([
        { userId: "A", amount: -30 },
        { userId: "B", amount: 30 },
      ]);
      expect(settlements).toHaveLength(1);
      expect(settlements[0]).toEqual({
        fromUserId: "A",
        toUserId: "B",
        amount: 30,
      });
    });

    it("three people, circular debt → optimized to 2 transactions", () => {
      const settlements = optimizeSettlements([
        { userId: "A", amount: -30 },
        { userId: "B", amount: -20 },
        { userId: "C", amount: 50 },
      ]);
      expect(settlements.length).toBeLessThanOrEqual(2);
      const totalSettled = settlements.reduce((s, t) => s + t.amount, 0);
      expect(totalSettled).toBe(50);
    });

    it("already balanced (all zero) → no transactions", () => {
      const settlements = optimizeSettlements([]);
      expect(settlements).toHaveLength(0);
    });

    it("one creditor, many debtors → correct amounts", () => {
      const settlements = optimizeSettlements([
        { userId: "A", amount: -10 },
        { userId: "B", amount: -20 },
        { userId: "C", amount: -30 },
        { userId: "D", amount: 60 },
      ]);
      const totalToD = settlements
        .filter((s) => s.toUserId === "D")
        .reduce((s, t) => s + t.amount, 0);
      expect(totalToD).toBe(60);
    });

    it("many creditors, one debtor", () => {
      const settlements = optimizeSettlements([
        { userId: "A", amount: 10 },
        { userId: "B", amount: 20 },
        { userId: "C", amount: 30 },
        { userId: "D", amount: -60 },
      ]);
      const totalFromD = settlements
        .filter((s) => s.fromUserId === "D")
        .reduce((s, t) => s + t.amount, 0);
      expect(totalFromD).toBe(60);
    });

    it("large group (10 members) → transaction count ≤ n-1", () => {
      const balances: Balance[] = [
        { userId: "u1", amount: -50 },
        { userId: "u2", amount: -30 },
        { userId: "u3", amount: -20 },
        { userId: "u4", amount: -10 },
        { userId: "u5", amount: -5 },
        { userId: "u6", amount: 25 },
        { userId: "u7", amount: 30 },
        { userId: "u8", amount: 20 },
        { userId: "u9", amount: 15 },
        { userId: "u10", amount: 25 },
      ];
      const settlements = optimizeSettlements(balances);
      expect(settlements.length).toBeLessThanOrEqual(9);
    });

    it("floating point precision → amounts sum correctly", () => {
      const settlements = optimizeSettlements([
        { userId: "A", amount: -33.33 },
        { userId: "B", amount: -33.33 },
        { userId: "C", amount: 66.66 },
      ]);
      const totalSettled = settlements.reduce((s, t) => s + t.amount, 0);
      expect(totalSettled).toBeCloseTo(66.66, 1);
    });

    it("single person paid for everyone", () => {
      const settlements = optimizeSettlements([
        { userId: "A", amount: -25 },
        { userId: "B", amount: -25 },
        { userId: "C", amount: -25 },
        { userId: "D", amount: 75 },
      ]);
      expect(settlements.every((s) => s.toUserId === "D")).toBe(true);
      expect(settlements.length).toBe(3);
    });
  });
});
