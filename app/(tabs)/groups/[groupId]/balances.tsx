import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useAuth } from "@/src/providers/AuthProvider";
import { useGroupBalances, useSettleUp } from "@/src/hooks/useBalances";
import { formatCurrency } from "@/src/utils/currency";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

export default function BalancesScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();
  const { data, isLoading, refetch, isRefetching } = useGroupBalances(groupId);
  const settleUp = useSettleUp();

  const handleSettle = (
    toUserId: string,
    toName: string,
    amount: number
  ) => {
    Alert.alert(
      "Settle Up",
      `Confirm you've paid ${formatCurrency(amount)} to ${toName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Payment",
          onPress: async () => {
            try {
              await settleUp.mutateAsync({
                groupId,
                toUserId,
                amount,
              });
              Alert.alert("Done!", `Settlement with ${toName} recorded.`);
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const myBalances = data?.myBalances ?? [];
  const allSettlements = data?.allSettlements ?? [];
  const totalOwed = myBalances
    .filter((b) => b.net < 0)
    .reduce((s, b) => s + Math.abs(b.net), 0);
  const totalOwedToMe = myBalances
    .filter((b) => b.net > 0)
    .reduce((s, b) => s + b.net, 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <Stack.Screen options={{ title: "Balances" }} />

      {/* Summary */}
      <View style={styles.summaryCard}>
        {totalOwed > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>You owe</Text>
            <Text style={[styles.summaryAmount, { color: Colors.error }]}>
              {formatCurrency(totalOwed)}
            </Text>
          </View>
        )}
        {totalOwedToMe > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Owed to you</Text>
            <Text style={[styles.summaryAmount, { color: Colors.success }]}>
              {formatCurrency(totalOwedToMe)}
            </Text>
          </View>
        )}
        {totalOwed === 0 && totalOwedToMe === 0 && (
          <Text style={styles.settledText}>All settled up!</Text>
        )}
      </View>

      {/* My Balances */}
      {myBalances.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Your Balances</Text>
          {myBalances.map((b) => (
            <View key={b.userId} style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <View style={styles.balanceInfo}>
                  <Text style={styles.balanceName}>{b.displayName}</Text>
                  <Text
                    style={[
                      styles.balanceAmount,
                      { color: b.net > 0 ? Colors.success : Colors.error },
                    ]}
                  >
                    {b.net > 0
                      ? `Owes you ${formatCurrency(b.net)}`
                      : `You owe ${formatCurrency(Math.abs(b.net))}`}
                  </Text>
                </View>
                {b.net < 0 && (
                  <TouchableOpacity
                    style={styles.settleButton}
                    onPress={() =>
                      handleSettle(b.userId, b.displayName, Math.abs(b.net))
                    }
                  >
                    <Text style={styles.settleButtonText}>Settle Up</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Order breakdown */}
              {b.orders.length > 0 && (
                <View style={styles.orderBreakdown}>
                  {b.orders.map((o, i) => (
                    <View key={`${o.orderId}-${i}`} style={styles.orderRow}>
                      <View style={styles.orderInfo}>
                        <Text style={styles.orderTitle}>{o.orderTitle}</Text>
                        <Text style={styles.orderDate}>
                          {new Date(o.date).toLocaleDateString()}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.orderAmount,
                          { color: o.amount > 0 ? Colors.success : Colors.error },
                        ]}
                      >
                        {o.amount > 0 ? "+" : ""}
                        {formatCurrency(o.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </>
      )}

      {/* All Settlements Needed */}
      {allSettlements.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>
            All Settlements
          </Text>
          <View style={styles.card}>
            {allSettlements.map((s, i) => (
              <View key={i} style={styles.settlementRow}>
                <View style={styles.settlementArrow}>
                  <Text style={styles.settlementFrom}>{s.fromName}</Text>
                  <Text style={styles.arrowText}>→</Text>
                  <Text style={styles.settlementTo}>{s.toName}</Text>
                </View>
                <Text style={styles.settlementAmount}>
                  {formatCurrency(s.amount)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  summaryCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg, alignItems: "center" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingVertical: Spacing.xs },
  summaryLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  summaryAmount: { fontSize: FontSize.xl, fontWeight: "700" },
  settledText: { fontSize: FontSize.lg, fontWeight: "600", color: Colors.success },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.text, marginBottom: Spacing.sm },
  balanceCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  balanceHeader: { flexDirection: "row", alignItems: "center" },
  balanceInfo: { flex: 1 },
  balanceName: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text },
  balanceAmount: { fontSize: FontSize.sm, fontWeight: "500", marginTop: 2 },
  settleButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  settleButtonText: { color: "#FFFFFF", fontSize: FontSize.sm, fontWeight: "600" },
  orderBreakdown: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  orderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.xs },
  orderInfo: { flex: 1 },
  orderTitle: { fontSize: FontSize.sm, color: Colors.text },
  orderDate: { fontSize: FontSize.xs, color: Colors.textTertiary },
  orderAmount: { fontSize: FontSize.sm, fontWeight: "600" },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  settlementRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  settlementArrow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1 },
  settlementFrom: { fontSize: FontSize.md, color: Colors.error, fontWeight: "500" },
  arrowText: { fontSize: FontSize.lg, color: Colors.textTertiary },
  settlementTo: { fontSize: FontSize.md, color: Colors.success, fontWeight: "500" },
  settlementAmount: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text },
});
