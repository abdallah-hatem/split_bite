/**
 * Settlement Optimization
 *
 * Given a set of pairwise balances (from the ledger), compute the minimum
 * number of transactions to settle all debts.
 *
 * Uses a greedy algorithm: repeatedly match the largest creditor with the
 * largest debtor until all balances are zero.
 */

export type Balance = {
  userId: string;
  amount: number; // positive = owed money, negative = owes money
};

export type Settlement = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

/**
 * Compute net balances from ledger entries.
 * Each entry: fromUser owes toUser `amount`.
 */
export function computeNetBalances(
  entries: { fromUserId: string; toUserId: string; amount: number }[]
): Balance[] {
  const balanceMap = new Map<string, number>();

  for (const entry of entries) {
    // fromUser owes → their balance decreases
    balanceMap.set(
      entry.fromUserId,
      (balanceMap.get(entry.fromUserId) ?? 0) - entry.amount
    );
    // toUser is owed → their balance increases
    balanceMap.set(
      entry.toUserId,
      (balanceMap.get(entry.toUserId) ?? 0) + entry.amount
    );
  }

  return Array.from(balanceMap.entries())
    .map(([userId, amount]) => ({
      userId,
      amount: Math.round(amount * 2) / 2,
    }))
    .filter((b) => Math.abs(b.amount) > 0.25);
}

/**
 * Compute minimum settlements to zero out all balances.
 * Greedy approach: match largest creditor with largest debtor.
 */
export function optimizeSettlements(balances: Balance[]): Settlement[] {
  const creditors = balances
    .filter((b) => b.amount > 0.25)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter((b) => b.amount < -0.25)
    .map((b) => ({ ...b, amount: Math.abs(b.amount) }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const amount =
      Math.round(Math.min(creditors[ci].amount, debtors[di].amount) * 100) /
      100;

    if (amount > 0) {
      settlements.push({
        fromUserId: debtors[di].userId,
        toUserId: creditors[ci].userId,
        amount,
      });
    }

    creditors[ci].amount =
      Math.round((creditors[ci].amount - amount) * 2) / 2;
    debtors[di].amount =
      Math.round((debtors[di].amount - amount) * 2) / 2;

    if (creditors[ci].amount < 0.25) ci++;
    if (debtors[di].amount < 0.25) di++;
  }

  return settlements;
}
