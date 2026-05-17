import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { useSpendingStats } from "@/src/hooks/useSpendingStats";
import { formatCurrency } from "@/src/utils/currency";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

type Range = { days: number; label: string };

const RANGES: Range[] = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: Number.POSITIVE_INFINITY, label: "All time" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ActivityScreen() {
  const [range, setRange] = useState<Range>(RANGES[0]);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const { data, isLoading, refetch } = useSpendingStats(range.days);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [])
  );

  const onPullRefresh = async () => {
    setPullRefreshing(true);
    try {
      await refetch();
    } finally {
      setPullRefreshing(false);
    }
  };

  const totalSpent = data?.totalSpent ?? 0;
  const orderCount = data?.orderCount ?? 0;
  const byOrder = data?.byOrder ?? [];
  const byItem = data?.byItem ?? [];
  const topItems = byItem.slice(0, 8);
  const maxItemAmount = topItems[0]?.amount ?? 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={pullRefreshing} onRefresh={onPullRefresh} />
      }
    >
      {/* Range pills */}
      <View style={styles.rangeRow}>
        {RANGES.map((r) => {
          const active = r.days === range.days;
          return (
            <TouchableOpacity
              key={r.label}
              style={[styles.rangeChip, active && styles.rangeChipActive]}
              onPress={() => setRange(r)}
            >
              <Text
                style={[
                  styles.rangeChipText,
                  active && styles.rangeChipTextActive,
                ]}
              >
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Loading / empty */}
      {isLoading && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : orderCount === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing yet</Text>
          <Text style={styles.emptySubtitle}>
            Once finalized orders show up in this range, your spending
            breakdown will appear here.
          </Text>
        </View>
      ) : (
        <>
          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total spent</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalSpent)}</Text>
            <Text style={styles.summaryMeta}>
              {orderCount} {orderCount === 1 ? "order" : "orders"} ·{" "}
              {byItem.length} unique {byItem.length === 1 ? "item" : "items"}
            </Text>
          </View>

          {/* From where (per order) */}
          <Text style={styles.sectionTitle}>From where</Text>
          <View style={styles.card}>
            {byOrder.map((o, i) => (
              <Link
                key={o.orderId}
                href={
                  o.groupId
                    ? (`/(tabs)/groups/${o.groupId}/orders/${o.orderId}/summary` as any)
                    : (`/(tabs)/activity` as any)
                }
                asChild
              >
                <TouchableOpacity
                  style={[
                    styles.orderRow,
                    i === byOrder.length - 1 && styles.lastRow,
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderTitle} numberOfLines={1}>
                      {o.title}
                    </Text>
                    <Text style={styles.orderMeta} numberOfLines={1}>
                      {o.groupName}
                      {o.finalizedAt ? ` · ${formatDate(o.finalizedAt)}` : ""}
                    </Text>
                  </View>
                  <Text style={styles.orderAmount}>
                    {formatCurrency(o.amount)}
                  </Text>
                </TouchableOpacity>
              </Link>
            ))}
          </View>

          {/* On what (top items) */}
          {topItems.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>On what</Text>
              <View style={styles.card}>
                {topItems.map((item, i) => {
                  const widthPct =
                    maxItemAmount > 0
                      ? Math.max(
                          4,
                          Math.round((item.amount / maxItemAmount) * 100)
                        )
                      : 0;
                  return (
                    <View
                      key={item.name + i}
                      style={[
                        styles.itemRow,
                        i === topItems.length - 1 && styles.lastRow,
                      ]}
                    >
                      <View style={styles.itemRowHeader}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.itemAmount}>
                          {formatCurrency(item.amount)}
                        </Text>
                      </View>
                      <View style={styles.itemMetaRow}>
                        <View style={styles.barTrack}>
                          <View
                            style={[styles.barFill, { width: `${widthPct}%` }]}
                          />
                        </View>
                        <Text style={styles.itemCount}>{item.count}x</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
  },

  rangeRow: { flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.sm },
  rangeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  rangeChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "15",
  },
  rangeChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  rangeChipTextActive: { color: Colors.primary, fontWeight: "700" },

  summaryCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryLabel: {
    fontSize: FontSize.sm,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 36,
    color: "#FFFFFF",
    fontWeight: "800",
    letterSpacing: -1,
    marginTop: 2,
  },
  summaryMeta: {
    fontSize: FontSize.sm,
    color: "rgba(255,255,255,0.85)",
    marginTop: Spacing.xs,
  },

  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.text,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },

  orderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  lastRow: { borderBottomWidth: 0, paddingBottom: 0 },
  orderInfo: { flex: 1 },
  orderTitle: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text },
  orderMeta: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  orderAmount: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text },

  itemRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  itemRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },
  itemName: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: "500",
    flexShrink: 1,
  },
  itemAmount: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.text },
  itemMetaRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: Colors.primary, borderRadius: 3 },
  itemCount: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    minWidth: 28,
    textAlign: "right",
  },

  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
