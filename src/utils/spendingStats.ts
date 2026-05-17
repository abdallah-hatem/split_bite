/**
 * Pure aggregation for the Activity-tab spending stats.
 *
 * Given a list of finalized orders the user is a participant in (with their
 * items, item_shares, payments, and the order_participants set), compute:
 *   - total spent for the user (sum of their `totalOwed` per order, from the
 *     calc engine — full bill share including tax/vat/delivery/discount)
 *   - per-order breakdown sorted descending by amount
 *   - per-item-name breakdown sorted descending by amount (raw item-share
 *     amounts; does NOT include tax/delivery)
 *
 * Kept as a pure function so it's unit-testable without supabase mocks.
 */

import {
  calculateSplit,
  CalcItem,
  CalcParticipant,
  CalcPayment,
} from "./calculations";

export type StatsOrder = {
  id: string;
  title: string | null;
  finalized_at: string | null;
  actual_total: number | null;
  tax: number | null;
  vat: number | null;
  delivery: number | null;
  discount: number | null;
  group: { id: string; name: string } | null;
  items: {
    id: string;
    name: string;
    price: number | null;
    quantity: number;
    added_by_participant_id: string;
    item_shares: { participant_id: string; share_fraction: number }[];
  }[];
  order_participants: {
    id: string;
    user_id: string | null;
    guest_id: string | null;
  }[];
  payments: { participant_id: string; amount: number }[];
};

export type ByOrderRow = {
  orderId: string;
  title: string;
  groupId: string | null;
  groupName: string;
  finalizedAt: string | null;
  amount: number;
};

export type ByItemRow = {
  name: string;
  amount: number;
  count: number;
};

export type SpendingStats = {
  totalSpent: number;
  orderCount: number;
  itemCount: number;
  byOrder: ByOrderRow[];
  byItem: ByItemRow[];
};

export function aggregateSpendingStats(
  orders: StatsOrder[],
  userId: string
): SpendingStats {
  let totalSpent = 0;
  let itemCount = 0;
  const byOrder: ByOrderRow[] = [];
  const itemMap = new Map<string, ByItemRow>();

  for (const o of orders) {
    const myParticipant = o.order_participants.find(
      (p) => p.user_id === userId
    );
    if (!myParticipant) continue;

    const calcItems: CalcItem[] = o.items.map((i) => ({
      id: i.id,
      price: i.price ?? 0,
      quantity: i.quantity,
      shares:
        i.item_shares.length > 0
          ? i.item_shares.map((s) => ({
              participantId: s.participant_id,
              fraction: s.share_fraction,
            }))
          : [{ participantId: i.added_by_participant_id, fraction: 1 }],
    }));

    const calcParticipants: CalcParticipant[] = o.order_participants.map(
      (p) => ({
        id: p.id,
        userId: p.user_id,
        guestId: p.guest_id,
        isIncluded: true,
      })
    );

    const calcPayments: CalcPayment[] = o.payments.map((p) => ({
      participantId: p.participant_id,
      amount: p.amount,
    }));

    const result = calculateSplit({
      items: calcItems,
      payments: calcPayments,
      participants: calcParticipants,
      actualTotal: o.actual_total ?? 0,
      tax: o.tax ?? 0,
      vat: o.vat ?? 0,
      delivery: o.delivery ?? 0,
      discount: o.discount ?? 0,
    });

    const mine = result.breakdowns.find(
      (b) => b.participantId === myParticipant.id
    );
    if (!mine) continue;

    if (mine.totalOwed > 0) {
      totalSpent += mine.totalOwed;
      byOrder.push({
        orderId: o.id,
        title: o.title ?? "(untitled)",
        groupId: o.group?.id ?? null,
        groupName: o.group?.name ?? "",
        finalizedAt: o.finalized_at,
        amount: mine.totalOwed,
      });
    }

    // Per-item: only items the user has a share in, raw price × share fraction.
    for (const item of o.items) {
      const myShare = item.item_shares.find(
        (s) => s.participant_id === myParticipant.id
      );
      if (!myShare) continue;
      const myItemAmount =
        (item.price ?? 0) * item.quantity * myShare.share_fraction;
      if (myItemAmount <= 0) continue;
      const key = item.name.trim().toLowerCase();
      const existing = itemMap.get(key);
      if (existing) {
        existing.amount += myItemAmount;
        existing.count += 1;
      } else {
        itemMap.set(key, {
          name: item.name.trim(),
          amount: myItemAmount,
          count: 1,
        });
      }
      itemCount += 1;
    }
  }

  byOrder.sort((a, b) => b.amount - a.amount);
  const byItem = Array.from(itemMap.values()).sort(
    (a, b) => b.amount - a.amount
  );

  return {
    totalSpent: Math.round(totalSpent * 100) / 100,
    orderCount: byOrder.length,
    itemCount,
    byOrder,
    byItem,
  };
}
