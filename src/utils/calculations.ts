/**
 * SplitBite Calculation Engine
 *
 * Computes how much each participant owes/is owed based on:
 * - Items and their shares
 * - Tax, tip, discount
 * - Actual total (receipt) vs item sum
 * - Payments made
 * - Guest-to-host debt transfer
 */

export type CalcItem = {
  id: string;
  price: number;
  quantity: number;
  shares: { participantId: string; fraction: number }[];
};

export type CalcPayment = {
  participantId: string;
  amount: number;
};

export type CalcParticipant = {
  id: string;
  userId: string | null;
  guestId: string | null;
  hostUserId?: string; // for guests: the host's user_id
  isIncluded: boolean;
};

export type CalcInput = {
  items: CalcItem[];
  payments: CalcPayment[];
  participants: CalcParticipant[];
  actualTotal: number;
  tax: number;
  vat: number;
  delivery: number;
  discount: number;
};

export type ParticipantBreakdown = {
  participantId: string;
  userId: string | null;
  guestId: string | null;
  itemsTotal: number;
  adjustedTotal: number;
  taxShare: number;
  vatShare: number;
  deliveryShare: number;
  discountShare: number;
  totalOwed: number;
  totalPaid: number;
  net: number; // positive = owed money, negative = owes money
};

export type CalcResult = {
  breakdowns: ParticipantBreakdown[];
  itemsSum: number;
  adjustmentRatio: number;
  totalOwed: number;
  totalPaid: number;
  debts: { fromUserId: string; toUserId: string; amount: number }[];
};

/**
 * Round to 2 decimal places
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Distribute rounding error across breakdowns so totals match exactly.
 * Adds/subtracts the residual cent(s) to the largest share(s).
 */
function fixRounding(
  breakdowns: ParticipantBreakdown[],
  targetTotal: number
): void {
  const sum = breakdowns.reduce((s, b) => s + b.totalOwed, 0);
  let diff = round2(targetTotal - sum);

  if (diff === 0) return;

  // Sort by totalOwed descending so we adjust the largest shares
  const sorted = [...breakdowns].sort((a, b) => b.totalOwed - a.totalOwed);
  const step = diff > 0 ? 0.01 : -0.01;

  for (const b of sorted) {
    if (round2(diff) === 0) break;
    b.totalOwed = round2(b.totalOwed + step);
    b.net = round2(b.totalPaid - b.totalOwed);
    diff = round2(diff - step);
  }
}

/**
 * Main calculation function
 */
export function calculateSplit(input: CalcInput): CalcResult {
  const { items, payments, participants, actualTotal, tax, vat, delivery, discount } =
    input;

  // Step 1: Compute raw items sum
  const itemsSum = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Step 2: Compute adjustment ratio
  // The base amount (before tax/vat/delivery, after discount) that items should map to
  const baseTotal = actualTotal - tax - vat - delivery + discount;
  const adjustmentRatio = itemsSum > 0 ? baseTotal / itemsSum : 1;

  // Step 3: Compute per-participant item costs
  const breakdowns: ParticipantBreakdown[] = participants
    .filter((p) => p.isIncluded)
    .map((p) => {
      // Sum up this participant's share of all items
      let rawItemsTotal = 0;
      for (const item of items) {
        const share = item.shares.find(
          (s) => s.participantId === p.id
        );
        if (share) {
          rawItemsTotal += item.price * item.quantity * share.fraction;
        }
      }

      const adjustedTotal = round2(rawItemsTotal * adjustmentRatio);

      return {
        participantId: p.id,
        userId: p.userId,
        guestId: p.guestId,
        itemsTotal: round2(rawItemsTotal),
        adjustedTotal,
        taxShare: 0,
        vatShare: 0,
        deliveryShare: 0,
        discountShare: 0,
        totalOwed: adjustedTotal,
        totalPaid: 0,
        net: 0,
      };
    });

  // Step 4: Distribute tax, tip, discount proportionally
  const adjustedSum = breakdowns.reduce((s, b) => s + b.adjustedTotal, 0);

  if (adjustedSum > 0) {
    for (const b of breakdowns) {
      const proportion = b.adjustedTotal / adjustedSum;
      b.taxShare = round2(tax * proportion);
      b.vatShare = round2(vat * proportion);
      b.deliveryShare = round2(delivery * proportion);
      b.discountShare = round2(discount * proportion);
      b.totalOwed = round2(b.adjustedTotal + b.taxShare + b.vatShare + b.deliveryShare - b.discountShare);
    }
  }

  // Step 5: Fix rounding so totalOwed sums to actualTotal
  fixRounding(breakdowns, actualTotal);

  // Step 6: Apply payments
  for (const payment of payments) {
    const b = breakdowns.find((b) => b.participantId === payment.participantId);
    if (b) {
      b.totalPaid = round2(b.totalPaid + payment.amount);
    }
  }

  // Step 7: Compute net (positive = should receive, negative = owes)
  for (const b of breakdowns) {
    b.net = round2(b.totalPaid - b.totalOwed);
  }

  // Step 8: Transfer guest debts to hosts
  const guestParticipants = participants.filter(
    (p) => p.guestId && p.hostUserId
  );
  for (const guest of guestParticipants) {
    const guestBreakdown = breakdowns.find(
      (b) => b.participantId === guest.id
    );
    if (!guestBreakdown) continue;

    const hostBreakdown = breakdowns.find(
      (b) => b.userId === guest.hostUserId
    );
    if (!hostBreakdown) continue;

    // Transfer the guest's net to the host
    hostBreakdown.net = round2(hostBreakdown.net + guestBreakdown.net);
    guestBreakdown.net = 0;
  }

  // Step 9: Compute debts (who owes whom)
  const debts = computeDebts(breakdowns, participants);

  const totalOwed = round2(breakdowns.reduce((s, b) => s + b.totalOwed, 0));
  const totalPaid = round2(breakdowns.reduce((s, b) => s + b.totalPaid, 0));

  return {
    breakdowns,
    itemsSum: round2(itemsSum),
    adjustmentRatio: round2(adjustmentRatio * 100) / 100,
    totalOwed,
    totalPaid,
    debts,
  };
}

/**
 * Compute directed debts from net balances.
 * Only considers real users (guests already transferred to hosts).
 */
function computeDebts(
  breakdowns: ParticipantBreakdown[],
  participants: CalcParticipant[]
): { fromUserId: string; toUserId: string; amount: number }[] {
  // Only real users with non-zero nets
  const userNets: { userId: string; net: number }[] = [];

  for (const b of breakdowns) {
    if (!b.userId) continue; // skip guests
    const existing = userNets.find((u) => u.userId === b.userId);
    if (existing) {
      existing.net = round2(existing.net + b.net);
    } else {
      userNets.push({ userId: b.userId, net: b.net });
    }
  }

  // Separate into creditors (positive net) and debtors (negative net)
  const creditors = userNets
    .filter((u) => u.net > 0.005)
    .sort((a, b) => b.net - a.net);
  const debtors = userNets
    .filter((u) => u.net < -0.005)
    .map((u) => ({ ...u, net: Math.abs(u.net) }))
    .sort((a, b) => b.net - a.net);

  const debts: { fromUserId: string; toUserId: string; amount: number }[] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const amount = round2(Math.min(creditors[ci].net, debtors[di].net));
    if (amount > 0) {
      debts.push({
        fromUserId: debtors[di].userId,
        toUserId: creditors[ci].userId,
        amount,
      });
    }
    creditors[ci].net = round2(creditors[ci].net - amount);
    debtors[di].net = round2(debtors[di].net - amount);

    if (creditors[ci].net < 0.005) ci++;
    if (debtors[di].net < 0.005) di++;
  }

  return debts;
}
