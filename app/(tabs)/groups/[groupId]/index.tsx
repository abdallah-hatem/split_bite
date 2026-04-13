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
import { useLocalSearchParams, Link, Stack, router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useGroup, useGroupMembers } from "@/src/hooks/useGroup";
import { useOrders } from "@/src/hooks/useOrders";
import { useAuth } from "@/src/providers/AuthProvider";
import { supabase } from "@/src/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { groupKeys } from "@/src/hooks/useGroups";
import { MemberRow } from "@/src/components/groups/MemberRow";
import { OrderCard } from "@/src/components/orders/OrderCard";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

export default function GroupDetail() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: group, isLoading: groupLoading, refetch: refetchGroup } = useGroup(groupId);
  const { data: members, refetch: refetchMembers } = useGroupMembers(groupId);
  const { data: orders, refetch: refetchOrders, isRefetching } = useOrders(groupId);

  const refetchAll = () => {
    refetchGroup();
    refetchMembers();
    refetchOrders();
  };

  const isOwner = group?.created_by === user?.id;

  const handleLeaveGroup = () => {
    Alert.alert(
      "Leave Group",
      "Are you sure you want to leave this group?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("group_members")
                .delete()
                .eq("group_id", groupId)
                .eq("user_id", user!.id);
              if (error) throw error;
              await queryClient.invalidateQueries({ queryKey: groupKeys.all });
              await queryClient.refetchQueries({ queryKey: groupKeys.all });
              router.replace("/(tabs)/groups");
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  const copyInviteCode = async () => {
    if (group) {
      await Clipboard.setStringAsync(group.invite_code);
      Alert.alert("Copied!", `Invite code: ${group.invite_code}`);
    }
  };

  if (groupLoading || !group) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: group.name }} />

      <FlatList
        data={orders ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetchAll} />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.groupName}>{group.name}</Text>
              {group.description && (
                <Text style={styles.groupDesc}>{group.description}</Text>
              )}
            </View>

            <TouchableOpacity style={styles.inviteRow} onPress={copyInviteCode}>
              <Text style={styles.inviteLabel}>INVITE CODE</Text>
              <Text style={styles.inviteCode}>{group.invite_code}</Text>
              <Text style={styles.copyHint}>Tap to copy</Text>
            </TouchableOpacity>

            <Link
              href={`/(tabs)/groups/${groupId}/balances` as any}
              asChild
            >
              <TouchableOpacity style={styles.balancesButton}>
                <Text style={styles.balancesButtonText}>View Balances</Text>
              </TouchableOpacity>
            </Link>

            {!isOwner && (
              <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
                <Text style={styles.leaveButtonText}>Leave Group</Text>
              </TouchableOpacity>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Members ({members?.length ?? 0})
              </Text>
              {members?.map((m) => <MemberRow key={m.id} member={m} />)}
            </View>

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
            <Text style={styles.emptySubtext}>Start an order to split a bill</Text>
          </View>
        }
        renderItem={({ item }) => (
          <OrderCard order={item} groupId={groupId} />
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  listContent: { padding: Spacing.lg, gap: Spacing.sm },
  header: { marginBottom: Spacing.md },
  groupName: { fontSize: FontSize.xxl, fontWeight: "800", color: Colors.text },
  groupDesc: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.xs },
  inviteRow: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, alignItems: "center", marginBottom: Spacing.lg },
  balancesButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.sm, alignItems: "center", marginBottom: Spacing.sm },
  balancesButtonText: { color: "#FFFFFF", fontSize: FontSize.sm, fontWeight: "600" },
  leaveButton: { backgroundColor: Colors.errorLight, borderRadius: BorderRadius.md, padding: Spacing.sm, alignItems: "center", marginBottom: Spacing.lg },
  leaveButtonText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: "600" },
  inviteLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, letterSpacing: 1 },
  inviteCode: { fontSize: FontSize.xl, fontWeight: "700", color: Colors.primary, letterSpacing: 3, marginTop: Spacing.xs },
  copyHint: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.xs },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.text, marginBottom: Spacing.sm },
  ordersHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  newOrderButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  newOrderText: { color: "#FFFFFF", fontSize: FontSize.sm, fontWeight: "600" },
  emptyOrders: { alignItems: "center", paddingVertical: Spacing.xl },
  emptyText: { fontSize: FontSize.md, fontWeight: "600", color: Colors.textSecondary },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: Spacing.xs },
});
