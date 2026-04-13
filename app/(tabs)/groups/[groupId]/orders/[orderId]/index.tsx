import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, Stack, router, Link } from "expo-router";
import { useAuth } from "@/src/providers/AuthProvider";
import {
  useOrder,
  useOrderParticipants,
  useOrderItems,
  useAddItem,
  useAddGuest,
  useUpdateOrderStatus,
  useDeleteOrder,
} from "@/src/hooks/useOrders";
import { useRealtimeOrder, useRealtimeItems } from "@/src/hooks/useRealtimeOrder";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

function AddItemModal({
  visible,
  onClose,
  orderId,
  participantId,
  participants,
}: {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  participantId: string;
  participants: any[];
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [splitMode, setSplitMode] = useState<"mine" | "some" | "all">("mine");
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(
    new Set()
  );
  const addItem = useAddItem();

  const toggleParticipant = (pid: string) => {
    setSelectedParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter an item name");
      return;
    }

    if (splitMode === "some" && selectedParticipants.size === 0) {
      Alert.alert("Error", "Please select at least one person to split with");
      return;
    }

    try {
      let sharedWith: string[] | undefined;
      let isShared = false;

      if (splitMode === "all") {
        isShared = true;
        sharedWith = participants.map((p) => p.id);
      } else if (splitMode === "some") {
        isShared = true;
        // Include self + selected
        sharedWith = [participantId, ...Array.from(selectedParticipants)];
        // Deduplicate
        sharedWith = [...new Set(sharedWith)];
      }

      await addItem.mutateAsync({
        orderId,
        name: name.trim(),
        price: price ? parseFloat(price) : null,
        quantity: 1,
        isShared,
        participantId,
        sharedWith,
      });
      setName("");
      setPrice("");
      setSplitMode("mine");
      setSelectedParticipants(new Set());
      onClose();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <KeyboardAvoidingView
        style={modalStyles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={modalStyles.headerCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={modalStyles.headerTitle}>Add Item</Text>
          <TouchableOpacity
            onPress={handleAdd}
            disabled={addItem.isPending}
          >
            <Text
              style={[
                modalStyles.headerAction,
                addItem.isPending && { opacity: 0.5 },
              ]}
            >
              {addItem.isPending ? "Adding..." : "Add"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={modalStyles.body}>
          <Text style={modalStyles.label}>Item Name</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. Margherita Pizza"
            placeholderTextColor={Colors.textTertiary}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={modalStyles.label}>Price (optional)</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="0.00"
            placeholderTextColor={Colors.textTertiary}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />

          <Text style={modalStyles.label}>Who is this for?</Text>
          <View style={modalStyles.splitOptions}>
            {(
              [
                { key: "mine", label: "Just me" },
                { key: "some", label: "Split with..." },
                { key: "all", label: "Everyone" },
              ] as const
            ).map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  modalStyles.splitOption,
                  splitMode === opt.key && modalStyles.splitOptionActive,
                ]}
                onPress={() => setSplitMode(opt.key)}
              >
                <Text
                  style={[
                    modalStyles.splitOptionText,
                    splitMode === opt.key &&
                      modalStyles.splitOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {splitMode === "some" && (
            <View style={modalStyles.participantList}>
              {participants
                .filter((p) => p.id !== participantId)
                .map((p) => {
                  const pName =
                    p.profiles?.display_name ??
                    p.guests?.name ??
                    "Unknown";
                  const selected = selectedParticipants.has(p.id);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        modalStyles.participantRow,
                        selected && modalStyles.participantRowSelected,
                      ]}
                      onPress={() => toggleParticipant(p.id)}
                    >
                      <View
                        style={[
                          modalStyles.checkbox,
                          selected && modalStyles.checkboxChecked,
                        ]}
                      />
                      <Text style={modalStyles.participantName}>
                        {pName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AddGuestModal({
  visible,
  onClose,
  orderId,
  groupId,
}: {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  groupId: string;
}) {
  const [guestName, setGuestName] = useState("");
  const addGuest = useAddGuest();

  const handleAdd = async () => {
    if (!guestName.trim()) {
      Alert.alert("Error", "Please enter a guest name");
      return;
    }

    try {
      await addGuest.mutateAsync({
        orderId,
        groupId,
        guestName: guestName.trim(),
      });
      setGuestName("");
      onClose();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <KeyboardAvoidingView
        style={modalStyles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={modalStyles.headerCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={modalStyles.headerTitle}>Add Guest</Text>
          <TouchableOpacity
            onPress={handleAdd}
            disabled={addGuest.isPending}
          >
            <Text
              style={[
                modalStyles.headerAction,
                addGuest.isPending && { opacity: 0.5 },
              ]}
            >
              {addGuest.isPending ? "Adding..." : "Add"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={modalStyles.body}>
          <Text style={modalStyles.subtitle}>
            Guest's debt will be assigned to you
          </Text>

          <Text style={modalStyles.label}>Guest Name</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. Ahmed"
            placeholderTextColor={Colors.textTertiary}
            value={guestName}
            onChangeText={setGuestName}
            autoFocus
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function OrderDetail() {
  const { groupId, orderId } = useLocalSearchParams<{
    groupId: string;
    orderId: string;
  }>();
  const { user } = useAuth();
  const { data: order, isLoading } = useOrder(orderId);
  const { data: participants, refetch: refetchParticipants } =
    useOrderParticipants(orderId);
  const { data: items, refetch: refetchItems } = useOrderItems(orderId);
  const updateStatus = useUpdateOrderStatus();
  const deleteOrder = useDeleteOrder();

  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);

  // Realtime subscriptions
  useRealtimeOrder(orderId);
  useRealtimeItems(orderId);

  const isOwner = order?.created_by === user?.id;
  const isOpen = order?.status === "open";
  const isLocked = order?.status === "locked";
  const myParticipant = participants?.find((p) => p.user_id === user?.id);

  const handleLock = () => {
    if (!items?.length) {
      Alert.alert("No Items", "Add at least one item before locking the order.");
      return;
    }

    Alert.alert(
      "Lock Order",
      "No more items can be added after locking.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Lock",
          onPress: () =>
            updateStatus.mutate({ orderId, status: "locked" }),
        },
      ]
    );
  };

  const handleReopen = () => {
    updateStatus.mutate({ orderId, status: "open" });
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Order",
      "This will permanently delete this order and all its items.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteOrder.mutateAsync({ orderId, groupId });
              router.back();
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  const refetchAll = () => {
    refetchParticipants();
    refetchItems();
  };

  if (isLoading || !order) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const statusColor =
    order.status === "open"
      ? Colors.success
      : order.status === "locked"
      ? Colors.warning
      : order.status === "finalized"
      ? Colors.primary
      : Colors.textTertiary;

  const itemsTotal = items?.reduce(
    (sum, item) => sum + (item.price ?? 0) * item.quantity,
    0
  ) ?? 0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: order.title }} />

      <FlatList
        data={items ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetchAll} />
        }
        ListHeaderComponent={
          <View>
            {/* Status */}
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusColor + "20" },
                ]}
              >
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {order.status.toUpperCase()}
                </Text>
              </View>
              {isOwner && (
                <Text style={styles.ownerTag}>You're the bill manager</Text>
              )}
            </View>

            {/* Participants */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Participants ({participants?.length ?? 0})
                </Text>
                {isOwner && isOpen && (
                  <TouchableOpacity onPress={() => setShowAddGuest(true)}>
                    <Text style={styles.addLink}>+ Guest</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.chipRow}>
                {participants?.map((p) => {
                  const name = p.profiles?.display_name ?? p.guests?.name ?? "?";
                  const isGuest = !!p.guest_id;
                  return (
                    <View
                      key={p.id}
                      style={[styles.chip, isGuest && styles.guestChip]}
                    >
                      <Text style={styles.chipText}>{name}</Text>
                      {isGuest && (
                        <Text style={styles.guestLabel}>Guest</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Items Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Items ({items?.length ?? 0})
              </Text>
              {isOpen && myParticipant && (
                <TouchableOpacity onPress={() => setShowAddItem(true)}>
                  <Text style={styles.addLink}>+ Add Item</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyItems}>
            <Text style={styles.emptyText}>No items yet</Text>
            {isOpen && (
              <Text style={styles.emptySubtext}>
                Add items to start building the order
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const addedByName =
            (item.added_by as any)?.profiles?.display_name ??
            (item.added_by as any)?.guests?.name ??
            null;

          const shareNames = (item.item_shares ?? [])
            .map((s) => {
              const p = participants?.find(
                (p) => p.id === s.participant_id
              );
              return p?.profiles?.display_name ?? p?.guests?.name ?? null;
            })
            .filter(Boolean);

          const isSharedItem = shareNames.length > 1;

          return (
            <View style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                {isSharedItem ? (
                  <Text style={styles.sharedLabel}>
                    Split: {shareNames.join(", ")}
                  </Text>
                ) : addedByName ? (
                  <Text style={styles.addedByLabel}>{addedByName}</Text>
                ) : null}
              </View>
              <Text style={styles.itemPrice}>
                {item.price != null
                  ? `${item.price.toFixed(2)}`
                  : "No price"}
              </Text>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            {(items?.length ?? 0) > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Items Total</Text>
                <Text style={styles.totalAmount}>
                  {itemsTotal.toFixed(2)}
                </Text>
              </View>
            )}

            {/* Actions */}
            {isOwner && isOpen && (
              <TouchableOpacity
                style={styles.lockButton}
                onPress={handleLock}
              >
                <Text style={styles.lockButtonText}>Lock Order</Text>
              </TouchableOpacity>
            )}

            {isOwner && isLocked && (
              <>
                <Link
                  href={`/(tabs)/groups/${groupId}/orders/${orderId}/finalize` as any}
                  asChild
                >
                  <TouchableOpacity style={styles.finalizeButton}>
                    <Text style={styles.finalizeButtonText}>Finalize Bill</Text>
                  </TouchableOpacity>
                </Link>
                <TouchableOpacity
                  style={styles.reopenButton}
                  onPress={handleReopen}
                >
                  <Text style={styles.reopenButtonText}>Reopen</Text>
                </TouchableOpacity>
              </>
            )}

            {isOwner && (isOpen || isLocked) && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
              >
                <Text style={styles.deleteButtonText}>Delete Order</Text>
              </TouchableOpacity>
            )}

            {!myParticipant && isOpen && user && (
              <JoinOrderButton orderId={orderId} userId={user.id} onJoined={refetchParticipants} />
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {myParticipant && (
        <AddItemModal
          visible={showAddItem}
          onClose={() => setShowAddItem(false)}
          orderId={orderId}
          participantId={myParticipant.id}
          participants={participants ?? []}
        />
      )}

      <AddGuestModal
        visible={showAddGuest}
        onClose={() => setShowAddGuest(false)}
        orderId={orderId}
        groupId={groupId}
      />
    </View>
  );
}

function JoinOrderButton({
  orderId,
  userId,
  onJoined,
}: {
  orderId: string;
  userId: string;
  onJoined: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    setLoading(true);
    try {
      const { supabase } = await import("@/src/lib/supabase");
      const { error } = await supabase
        .from("order_participants")
        .insert({ order_id: orderId, user_id: userId });
      if (error) throw error;
      onJoined();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.joinButton, loading && { opacity: 0.6 }]}
      onPress={handleJoin}
      disabled={loading}
    >
      <Text style={styles.joinButtonText}>
        {loading ? "Joining..." : "Join Order"}
      </Text>
    </TouchableOpacity>
  );
}

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.md, paddingTop: Platform.OS === "ios" ? 60 : Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  headerCancel: { fontSize: FontSize.md, color: Colors.textSecondary },
  headerTitle: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text },
  headerAction: { fontSize: FontSize.md, color: Colors.primary, fontWeight: "600" },
  body: { padding: Spacing.lg },
  label: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.text, marginTop: Spacing.md, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.text },
  splitOptions: { flexDirection: "row", gap: Spacing.xs, marginTop: Spacing.xs },
  splitOption: { flex: 1, paddingVertical: Spacing.sm, alignItems: "center", borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  splitOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "15" },
  splitOptionText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: "500" },
  splitOptionTextActive: { color: Colors.primary, fontWeight: "600" },
  participantList: { marginTop: Spacing.sm, gap: Spacing.xs },
  participantRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  participantRowSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + "10" },
  participantName: { fontSize: FontSize.md, color: Colors.text },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: Colors.border },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  listContent: { padding: Spacing.lg },
  statusRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.lg },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
  statusText: { fontSize: FontSize.xs, fontWeight: "700", letterSpacing: 1 },
  ownerTag: { fontSize: FontSize.xs, color: Colors.textSecondary },
  section: { marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.text },
  addLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  chip: { backgroundColor: Colors.primaryLight + "30", paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  guestChip: { backgroundColor: Colors.secondaryLight + "50" },
  chipText: { fontSize: FontSize.sm, color: Colors.text, fontWeight: "500" },
  guestLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  emptyItems: { alignItems: "center", paddingVertical: Spacing.xl },
  emptyText: { fontSize: FontSize.md, fontWeight: "600", color: Colors.textSecondary },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: Spacing.xs },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: FontSize.md, color: Colors.text, fontWeight: "500" },
  sharedLabel: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: "500" },
  addedByLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
  itemPrice: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text },
  footer: { marginTop: Spacing.md, gap: Spacing.sm },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  totalLabel: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text },
  totalAmount: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text },
  lockButton: { backgroundColor: Colors.warning, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center" },
  lockButtonText: { color: "#FFFFFF", fontSize: FontSize.md, fontWeight: "600" },
  finalizeButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center" },
  finalizeButtonText: { color: "#FFFFFF", fontSize: FontSize.md, fontWeight: "600" },
  reopenButton: { backgroundColor: Colors.surfaceSecondary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  reopenButtonText: { color: Colors.text, fontSize: FontSize.md, fontWeight: "600" },
  deleteButton: { backgroundColor: Colors.errorLight, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center" },
  deleteButtonText: { color: Colors.error, fontSize: FontSize.md, fontWeight: "600" },
  joinButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center" },
  joinButtonText: { color: "#FFFFFF", fontSize: FontSize.md, fontWeight: "600" },
});
