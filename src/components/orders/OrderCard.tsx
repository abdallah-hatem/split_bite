import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { Order } from "@/src/hooks/useOrders";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

type Props = {
  order: Order;
  groupId: string;
};

const statusColor = (status: string) => {
  switch (status) {
    case "open": return Colors.success;
    case "locked": return Colors.warning;
    case "finalized": return Colors.primary;
    case "settled": return Colors.textTertiary;
    default: return Colors.textSecondary;
  }
};

export function OrderCard({ order, groupId }: Props) {
  const isFinalized = order.status === "finalized" || order.status === "settled";
  const href = isFinalized
    ? `/(tabs)/groups/${groupId}/orders/${order.id}/summary`
    : `/(tabs)/groups/${groupId}/orders/${order.id}`;

  return (
    <Link href={href as any} asChild>
      <TouchableOpacity style={styles.card}>
        <View style={styles.top}>
          <Text style={styles.title}>{order.title}</Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: statusColor(order.status) + "20" },
            ]}
          >
            <Text
              style={[styles.badgeText, { color: statusColor(order.status) }]}
            >
              {order.status}
            </Text>
          </View>
        </View>
        <Text style={styles.date}>
          {new Date(order.created_at).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.text,
    flex: 1,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  date: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
});
