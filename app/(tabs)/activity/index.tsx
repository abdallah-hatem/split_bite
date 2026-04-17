import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/src/providers/AuthProvider";
import { useActivityFeed, LedgerEntry } from "@/src/hooks/useLedger";
import { formatCurrency } from "@/src/utils/currency";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

function EntryRow({ entry, userId }: { entry: LedgerEntry; userId: string }) {
  const isFrom = entry.from_user_id === userId;
  const otherName = isFrom
    ? entry.to_profile?.display_name ?? "Unknown"
    : entry.from_profile?.display_name ?? "Unknown";

  const typeLabel =
    entry.type === "settlement"
      ? "Settlement"
      : entry.type === "guest_transfer"
      ? "Guest transfer"
      : "Order split";

  const description =
    entry.type === "order_debt" && entry.order
      ? entry.order.title
      : entry.description ?? typeLabel;

  const date = new Date(entry.created_at);
  const dateStr = date.toLocaleDateString();

  return (
    <View style={styles.entryCard}>
      <View style={styles.entryTop}>
        <Text style={styles.entryGroup}>{entry.group?.name ?? "Group"}</Text>
        <Text style={styles.entryDate}>{dateStr}</Text>
      </View>
      <Text style={styles.entryDesc}>{description}</Text>
      <View style={styles.entryBottom}>
        {isFrom ? (
          <Text style={styles.entryOwes}>
            You → {otherName}
          </Text>
        ) : (
          <Text style={styles.entryOwed}>
            {otherName} → You
          </Text>
        )}
        <Text
          style={[
            styles.entryAmount,
            { color: isFrom ? Colors.error : Colors.success },
          ]}
        >
          {isFrom ? "-" : "+"}
          {formatCurrency(entry.amount)}
        </Text>
      </View>
      <Text style={styles.entryType}>{typeLabel}</Text>
    </View>
  );
}

export default function ActivityScreen() {
  const { user } = useAuth();
  const {
    data: entriesData,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useActivityFeed();
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const entries = entriesData?.pages.flat() ?? [];

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [])
  );

  const onPullRefresh = async () => {
    setPullRefreshing(true);
    await refetch();
    setPullRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(item) => item.id}
      onEndReached={() => hasNextPage && fetchNextPage()}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl refreshing={pullRefreshing} onRefresh={onPullRefresh} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptySubtitle}>
            Your order splits and settlements will appear here
          </Text>
        </View>
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator
            size="small"
            color={Colors.primary}
            style={{ paddingVertical: Spacing.md }}
          />
        ) : null
      }
      renderItem={({ item }) =>
        user ? <EntryRow entry={item} userId={user.id} /> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.sm },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 100 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: "700", color: Colors.text, marginBottom: Spacing.sm },
  emptySubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: "center" },
  entryCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  entryTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.xs },
  entryGroup: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: "600" },
  entryDate: { fontSize: FontSize.xs, color: Colors.textTertiary },
  entryDesc: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text, marginBottom: Spacing.xs },
  entryBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  entryOwes: { fontSize: FontSize.sm, color: Colors.error },
  entryOwed: { fontSize: FontSize.sm, color: Colors.success },
  entryAmount: { fontSize: FontSize.md, fontWeight: "700" },
  entryType: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.xs },
});
