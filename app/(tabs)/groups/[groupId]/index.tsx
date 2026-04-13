import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useLocalSearchParams, Link, useFocusEffect, Stack } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/AuthProvider";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

type Group = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  currency: string;
  created_by: string;
};

type Member = {
  id: string;
  role: string;
  user_id: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  };
};

type Order = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  created_by: string;
};

export default function GroupDetail() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    const [groupRes, membersRes, ordersRes] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase
        .from("group_members")
        .select("id, role, user_id, profiles(display_name, avatar_url)")
        .eq("group_id", groupId),
      supabase
        .from("orders")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }),
    ]);

    if (groupRes.data) setGroup(groupRes.data);
    if (membersRes.data) setMembers(membersRes.data as any);
    if (ordersRes.data) setOrders(ordersRes.data);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [groupId])
  );

  const copyInviteCode = async () => {
    if (group) {
      await Clipboard.setStringAsync(group.invite_code);
      Alert.alert("Copied!", `Invite code: ${group.invite_code}`);
    }
  };

  if (loading || !group) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "open": return Colors.success;
      case "locked": return Colors.warning;
      case "finalized": return Colors.primary;
      case "settled": return Colors.textTertiary;
      default: return Colors.textSecondary;
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: group.name }} />

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
        }
        ListHeaderComponent={
          <View>
            {/* Group Info */}
            <View style={styles.header}>
              <Text style={styles.groupName}>{group.name}</Text>
              {group.description && (
                <Text style={styles.groupDesc}>{group.description}</Text>
              )}
            </View>

            {/* Invite Code */}
            <TouchableOpacity style={styles.inviteRow} onPress={copyInviteCode}>
              <Text style={styles.inviteLabel}>Invite Code</Text>
              <Text style={styles.inviteCode}>{group.invite_code}</Text>
              <Text style={styles.copyHint}>Tap to copy</Text>
            </TouchableOpacity>

            {/* Members */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Members ({members.length})
              </Text>
              {members.map((m) => (
                <View key={m.id} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {m.profiles.display_name?.[0]?.toUpperCase() ?? "?"}
                    </Text>
                  </View>
                  <Text style={styles.memberName}>
                    {m.profiles.display_name}
                  </Text>
                  {m.role === "admin" && (
                    <Text style={styles.adminBadge}>Admin</Text>
                  )}
                </View>
              ))}
            </View>

            {/* Orders Header */}
            <View style={styles.ordersHeader}>
              <Text style={styles.sectionTitle}>Orders</Text>
              <Link
                href={`/(tabs)/groups/${groupId}/orders/create` as any}
                asChild
              >
                <TouchableOpacity style={styles.newOrderButton}>
                  <Text style={styles.newOrderText}>+ New Order</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyOrders}>
            <Text style={styles.emptyText}>No orders yet</Text>
            <Text style={styles.emptySubtext}>
              Start an order to split a bill
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Link
            href={`/(tabs)/groups/${groupId}/orders/${item.id}` as any}
            asChild
          >
            <TouchableOpacity style={styles.orderCard}>
              <View style={styles.orderCardTop}>
                <Text style={styles.orderTitle}>{item.title}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColor(item.status) + "20" },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: statusColor(item.status) },
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.orderDate}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          </Link>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  header: {
    marginBottom: Spacing.md,
  },
  groupName: {
    fontSize: FontSize.xxl,
    fontWeight: "800",
    color: Colors.text,
  },
  groupDesc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  inviteRow: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  inviteLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  inviteCode: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: 3,
    marginTop: Spacing.xs,
  },
  copyHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvatarText: {
    color: "#FFFFFF",
    fontSize: FontSize.sm,
    fontWeight: "700",
  },
  memberName: {
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
  },
  adminBadge: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: "600",
    backgroundColor: Colors.primary + "15",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  ordersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  newOrderButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  newOrderText: {
    color: "#FFFFFF",
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  emptyOrders: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderTitle: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  orderDate: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
});
