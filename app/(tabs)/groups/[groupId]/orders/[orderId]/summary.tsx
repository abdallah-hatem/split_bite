import { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import {
  useOrder,
  useOrderParticipants,
  useOrderItems,
} from "@/src/hooks/useOrders";
import { usePayments } from "@/src/hooks/usePayments";
import {
  calculateSplit,
  CalcItem,
  CalcParticipant,
  CalcPayment,
} from "@/src/utils/calculations";
import { formatCurrency } from "@/src/utils/currency";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

export default function OrderSummary() {
  const { groupId, orderId } = useLocalSearchParams<{
    groupId: string;
    orderId: string;
  }>();
  const { data: order } = useOrder(orderId);
  const { data: participants } = useOrderParticipants(orderId);
  const { data: items } = useOrderItems(orderId);
  const { data: payments } = usePayments(orderId);

  const result = useMemo(() => {
    if (!order?.actual_total || !items?.length || !participants?.length) return null;

    const calcItems: CalcItem[] = items.map((item: any) => {
      const shares = (item.item_shares ?? []).length > 0
        ? item.item_shares.map((s: any) => ({
            participantId: s.participant_id,
            fraction: s.share_fraction,
          }))
        : [{ participantId: item.added_by_participant_id, fraction: 1 }];

      return {
        id: item.id,
        price: item.price ?? 0,
        quantity: item.quantity,
        shares,
      };
    });

    const calcParticipants: CalcParticipant[] = participants.map((p) => ({
      id: p.id,
      userId: p.user_id,
      guestId: p.guest_id,
      isIncluded: true,
    }));

    const calcPayments: CalcPayment[] = (payments ?? []).map((p: any) => ({
      participantId: p.participant_id,
      amount: p.amount,
    }));

    return calculateSplit({
      items: calcItems,
      payments: calcPayments,
      participants: calcParticipants,
      actualTotal: order.actual_total,
      tax: order.tax,
      vat: order.vat,
      delivery: order.delivery,
      discount: order.discount,
    });
  }, [order, items, participants, payments]);

  if (!order) return null;

  const itemsTotal =
    items?.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0) ?? 0;

  const getParticipantName = (participantId: string) => {
    const p = participants?.find((p) => p.id === participantId);
    return p?.profiles?.display_name ?? p?.guests?.name ?? "Unknown";
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Order Summary" }} />

      <View style={styles.header}>
        <Text style={styles.title}>{order.title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Finalized</Text>
        </View>
      </View>

      {order.finalized_at && (
        <Text style={styles.date}>
          {new Date(order.finalized_at).toLocaleDateString()} at{" "}
          {new Date(order.finalized_at).toLocaleTimeString()}
        </Text>
      )}

      {/* Bill Breakdown */}
      <Text style={styles.sectionTitle}>Bill Breakdown</Text>
      <View style={styles.card}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Items</Text>
          <Text style={styles.totalValue}>{formatCurrency(itemsTotal)}</Text>
        </View>
        {order.tax > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.tax)}</Text>
          </View>
        )}
        {order.vat > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.vat)}</Text>
          </View>
        )}
        {order.delivery > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Delivery</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.delivery)}</Text>
          </View>
        )}
        {order.discount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount</Text>
            <Text style={[styles.totalValue, { color: Colors.success }]}>
              -{formatCurrency(order.discount)}
            </Text>
          </View>
        )}
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>
            {formatCurrency(order.actual_total ?? 0)}
          </Text>
        </View>
      </View>

      {/* Items */}
      <Text style={styles.sectionTitle}>Items</Text>
      <View style={styles.card}>
        {items?.map((item: any) => {
          const shareNames = (item.item_shares ?? [])
            .map((s: any) => {
              const p = participants?.find((p: any) => p.id === s.participant_id);
              return p?.profiles?.display_name ?? p?.guests?.name ?? null;
            })
            .filter(Boolean);
          const addedByName =
            item.added_by?.profiles?.display_name ??
            item.added_by?.guests?.name ??
            null;
          const isSharedItem = shareNames.length > 1;

          return (
            <View key={item.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                {isSharedItem ? (
                  <Text style={styles.sharedTag}>
                    Split: {shareNames.join(", ")}
                  </Text>
                ) : addedByName ? (
                  <Text style={styles.addedByTag}>{addedByName}</Text>
                ) : null}
              </View>
              <Text style={styles.itemPrice}>
                {formatCurrency((item.price ?? 0) * item.quantity)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Who Paid */}
      {payments && payments.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Who Paid</Text>
          <View style={styles.card}>
            {payments.map((p: any) => {
              const name =
                p.participant?.profiles?.display_name ??
                p.participant?.guests?.name ??
                "Unknown";
              return (
                <View key={p.id} style={styles.paymentRow}>
                  <Text style={styles.paymentName}>{name}</Text>
                  <Text style={styles.paymentAmount}>
                    {formatCurrency(p.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Per-Person Breakdown */}
      {result && (
        <>
          <Text style={styles.sectionTitle}>Per-Person Breakdown</Text>
          <View style={styles.card}>
            {result.breakdowns
              .filter((b) => b.userId)
              .map((b) => {
                const name = getParticipantName(b.participantId);
                return (
                  <View key={b.participantId} style={styles.breakdownRow}>
                    <Text style={styles.breakdownName}>{name}</Text>
                    <View style={styles.breakdownDetails}>
                      <View style={styles.breakdownLine}>
                        <Text style={styles.breakdownLabel}>Items</Text>
                        <Text style={styles.breakdownValue}>
                          {formatCurrency(b.itemsTotal)}
                        </Text>
                      </View>
                      {b.deliveryShare > 0 && (
                        <View style={styles.breakdownLine}>
                          <Text style={styles.breakdownLabel}>Delivery</Text>
                          <Text style={styles.breakdownValue}>
                            {formatCurrency(b.deliveryShare)}
                          </Text>
                        </View>
                      )}
                      {b.taxShare > 0 && (
                        <View style={styles.breakdownLine}>
                          <Text style={styles.breakdownLabel}>Tax</Text>
                          <Text style={styles.breakdownValue}>
                            {formatCurrency(b.taxShare)}
                          </Text>
                        </View>
                      )}
                      {b.vatShare > 0 && (
                        <View style={styles.breakdownLine}>
                          <Text style={styles.breakdownLabel}>VAT</Text>
                          <Text style={styles.breakdownValue}>
                            {formatCurrency(b.vatShare)}
                          </Text>
                        </View>
                      )}
                      {b.discountShare > 0 && (
                        <View style={styles.breakdownLine}>
                          <Text style={styles.breakdownLabel}>Discount</Text>
                          <Text style={[styles.breakdownValue, { color: Colors.success }]}>
                            -{formatCurrency(b.discountShare)}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.breakdownLine, styles.breakdownTotal]}>
                        <Text style={styles.breakdownTotalLabel}>Owes</Text>
                        <Text style={styles.breakdownTotalValue}>
                          {formatCurrency(b.totalOwed)}
                        </Text>
                      </View>
                      {b.totalPaid > 0 && (
                        <View style={styles.breakdownLine}>
                          <Text style={styles.breakdownLabel}>Paid</Text>
                          <Text style={[styles.breakdownValue, { color: Colors.success }]}>
                            {formatCurrency(b.totalPaid)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.netRow}>
                      <Text
                        style={[
                          styles.netText,
                          { color: b.net >= 0 ? Colors.success : Colors.error },
                        ]}
                      >
                        {b.net >= 0
                          ? `Gets back ${formatCurrency(b.net)}`
                          : `Owes ${formatCurrency(Math.abs(b.net))}`}
                      </Text>
                    </View>
                  </View>
                );
              })}
          </View>
        </>
      )}

      {/* Settlements */}
      {result && result.debts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Settlements</Text>
          <View style={styles.card}>
            {result.debts.map((d, i) => {
              const fromName = result.breakdowns.find(
                (b) => b.userId === d.fromUserId
              );
              const toName = result.breakdowns.find(
                (b) => b.userId === d.toUserId
              );
              return (
                <View key={i} style={styles.settlementRow}>
                  <View style={styles.settlementArrow}>
                    <Text style={styles.settlementFrom}>
                      {fromName
                        ? getParticipantName(fromName.participantId)
                        : "Unknown"}
                    </Text>
                    <Text style={styles.settlementArrowText}>→</Text>
                    <Text style={styles.settlementTo}>
                      {toName
                        ? getParticipantName(toName.participantId)
                        : "Unknown"}
                    </Text>
                  </View>
                  <Text style={styles.settlementAmount}>
                    {formatCurrency(d.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => router.replace(`/(tabs)/groups/${groupId}` as any)}
      >
        <Text style={styles.doneButtonText}>Back to Group</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.xxl, fontWeight: "800", color: Colors.text, flex: 1 },
  badge: { backgroundColor: Colors.primary + "20", paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
  badgeText: { fontSize: FontSize.xs, fontWeight: "600", color: Colors.primary },
  date: { fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.text, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.xs },
  totalLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.md, color: Colors.text },
  grandTotal: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.xs, paddingTop: Spacing.sm },
  grandTotalLabel: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text },
  grandTotalValue: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.primary },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemName: { fontSize: FontSize.md, color: Colors.text },
  sharedTag: { fontSize: FontSize.xs, color: Colors.primary },
  addedByTag: { fontSize: FontSize.xs, color: Colors.textTertiary },
  itemPrice: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  paymentName: { fontSize: FontSize.md, color: Colors.text },
  paymentAmount: { fontSize: FontSize.md, fontWeight: "600", color: Colors.success },
  breakdownRow: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  breakdownName: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text, marginBottom: Spacing.xs },
  breakdownDetails: { gap: 2 },
  breakdownLine: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  breakdownValue: { fontSize: FontSize.sm, color: Colors.text },
  breakdownTotal: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.xs, paddingTop: Spacing.xs },
  breakdownTotalLabel: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.text },
  breakdownTotalValue: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.text },
  netRow: { marginTop: Spacing.xs },
  netText: { fontSize: FontSize.sm, fontWeight: "600" },
  settlementRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  settlementArrow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1 },
  settlementFrom: { fontSize: FontSize.md, color: Colors.error, fontWeight: "500" },
  settlementArrowText: { fontSize: FontSize.lg, color: Colors.textTertiary },
  settlementTo: { fontSize: FontSize.md, color: Colors.success, fontWeight: "500" },
  settlementAmount: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text },
  doneButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center", marginTop: Spacing.md },
  doneButtonText: { color: "#FFFFFF", fontSize: FontSize.md, fontWeight: "600" },
});
