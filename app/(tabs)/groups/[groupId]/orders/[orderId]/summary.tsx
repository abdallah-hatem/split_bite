import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useOrder, useOrderParticipants, useOrderItems } from "@/src/hooks/useOrders";
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

  if (!order) return null;

  const itemsTotal =
    items?.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0) ?? 0;

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

      {/* Totals */}
      <View style={styles.card}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Items Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(itemsTotal)}</Text>
        </View>
        {order.tax > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(order.tax)}
            </Text>
          </View>
        )}
        {order.tip > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tip</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(order.tip)}
            </Text>
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
          <Text style={styles.grandTotalLabel}>Bill Total</Text>
          <Text style={styles.grandTotalValue}>
            {formatCurrency(order.actual_total ?? 0)}
          </Text>
        </View>
      </View>

      {/* Items */}
      <Text style={styles.sectionTitle}>Items</Text>
      <View style={styles.card}>
        {items?.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.is_shared && (
                <Text style={styles.sharedTag}>Shared</Text>
              )}
            </View>
            <Text style={styles.itemPrice}>
              {formatCurrency((item.price ?? 0) * item.quantity)}
            </Text>
          </View>
        ))}
      </View>

      {/* Participants */}
      <Text style={styles.sectionTitle}>Participants</Text>
      <View style={styles.card}>
        {participants?.map((p) => {
          const name =
            p.profiles?.display_name ?? p.guests?.name ?? "Unknown";
          const isGuest = !!p.guest_id;
          return (
            <View key={p.id} style={styles.participantRow}>
              <Text style={styles.participantName}>
                {name}
                {isGuest && (
                  <Text style={styles.guestTag}> (Guest)</Text>
                )}
              </Text>
            </View>
          );
        })}
      </View>

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
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.text, marginBottom: Spacing.sm },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.xs },
  totalLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.md, color: Colors.text },
  grandTotal: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.xs, paddingTop: Spacing.sm },
  grandTotalLabel: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text },
  grandTotalValue: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.primary },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemName: { fontSize: FontSize.md, color: Colors.text },
  sharedTag: { fontSize: FontSize.xs, color: Colors.primary },
  itemPrice: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text },
  participantRow: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  participantName: { fontSize: FontSize.md, color: Colors.text },
  guestTag: { fontSize: FontSize.sm, color: Colors.textTertiary },
  doneButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center", marginTop: Spacing.md },
  doneButtonText: { color: "#FFFFFF", fontSize: FontSize.md, fontWeight: "600" },
});
