import { PickFromMenuSheet } from "@/src/components/orders/PickFromMenuSheet";
import {
  useAddGuest,
  useAddItem,
  useDeleteItem,
  useDeleteOrder,
  useLeaveOrder,
  useOrder,
  useOrderItems,
  useOrderParticipants,
  useRemoveParticipant,
  useUpdateItem,
  useUpdateOrderStatus,
} from "@/src/hooks/useOrders";
import {
  useRealtimeItems,
  useRealtimeOrder,
} from "@/src/hooks/useRealtimeOrder";
import { BorderRadius, Colors, FontSize, Spacing } from "@/src/lib/constants";
import { useAuth } from "@/src/providers/AuthProvider";
import { formatShareLabels } from "@/src/utils/itemShares";
import { Link, Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

function AddItemModal({
  visible,
  onClose,
  orderId,
  participantId,
  participants,
  isOwner,
  restaurantId,
}: {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  participantId: string;
  participants: any[];
  isOwner: boolean;
  restaurantId: string | null;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  // Selected participants for this item (who it's assigned to / split with)
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(
    new Set([participantId]),
  );
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  // Per-participant weights (string state to allow blank/decimal entry)
  const [weights, setWeights] = useState<Record<string, string>>({});
  const addItem = useAddItem();

  const toggleParticipant = (pid: string) => {
    setSelectedParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        // Don't allow deselecting everyone
        if (next.size > 1) next.delete(pid);
      } else {
        next.add(pid);
        // In custom mode, default new selections to weight 1
        if (splitMode === "custom") {
          setWeights((w) => ({ ...w, [pid]: w[pid] ?? "1" }));
        }
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedParticipants(new Set(participants.map((p) => p.id)));
    setSplitMode("equal");
  };

  const selectOnlyMe = () => {
    setSelectedParticipants(new Set([participantId]));
    setSplitMode("equal");
  };

  const enterCustomMode = () => {
    setSplitMode("custom");
    // Seed weights = 1 for everyone currently selected
    setWeights((w) => {
      const next = { ...w };
      for (const pid of selectedParticipants) {
        if (next[pid] === undefined) next[pid] = "1";
      }
      return next;
    });
  };

  // Sum of weights for currently selected participants (custom mode)
  const totalWeight = Array.from(selectedParticipants).reduce(
    (s, pid) => s + (parseFloat(weights[pid] ?? "0") || 0),
    0,
  );

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter an item name");
      return;
    }

    try {
      const selected = Array.from(selectedParticipants);
      const isShared = selected.length > 1;
      // The "added_by" is the first selected person (or self)
      const ownerId = selected.includes(participantId)
        ? participantId
        : selected[0];

      if (splitMode === "custom" && isShared) {
        if (totalWeight <= 0) {
          Alert.alert("Error", "Set at least one weight above 0");
          return;
        }
        const customWeights = selected.map((pid) => ({
          participantId: pid,
          weight: parseFloat(weights[pid] ?? "0") || 0,
        }));
        await addItem.mutateAsync({
          orderId,
          name: name.trim(),
          price: price ? parseFloat(price) : null,
          quantity: 1,
          isShared,
          participantId: ownerId,
          customWeights,
        });
      } else {
        await addItem.mutateAsync({
          orderId,
          name: name.trim(),
          price: price ? parseFloat(price) : null,
          quantity: 1,
          isShared,
          participantId: ownerId,
          sharedWith: isShared ? selected : undefined,
        });
      }

      setName("");
      setPrice("");
      setSelectedParticipants(new Set([participantId]));
      setSplitMode("equal");
      setWeights({});
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
          <TouchableOpacity onPress={handleAdd} disabled={addItem.isPending}>
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

        <ScrollView
          style={modalStyles.body}
          keyboardShouldPersistTaps="handled"
        >
          {restaurantId ? (
            // Restaurant-tied order: menu picker is the only way to add items.
            // The picker pre-fills name + price; user may edit before saving.
            <>
              <TouchableOpacity
                style={modalStyles.pickFromMenuButton}
                onPress={() => setShowPicker(true)}
              >
                <Text style={modalStyles.pickFromMenuText}>
                  {name ? "Change item" : "+ Pick from menu"}
                </Text>
              </TouchableOpacity>

              {name ? (
                <>
                  <Text style={modalStyles.label}>Item</Text>
                  <TextInput
                    style={modalStyles.input}
                    value={name}
                    onChangeText={setName}
                  />
                  <Text style={modalStyles.label}>Price</Text>
                  <TextInput
                    style={modalStyles.input}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                  />
                </>
              ) : (
                <Text style={modalStyles.helpText}>
                  Pick an item from the menu to continue.
                </Text>
              )}
            </>
          ) : (
            <>
              <TouchableOpacity
                style={modalStyles.pickFromMenuButton}
                onPress={() => setShowPicker(true)}
              >
                <Text style={modalStyles.pickFromMenuText}>
                  + Pick from menu
                </Text>
              </TouchableOpacity>

              <Text style={modalStyles.label}>Item Name</Text>
              <TextInput
                style={modalStyles.input}
                placeholder="e.g. Margherita Pizza"
                placeholderTextColor={Colors.textTertiary}
                value={name}
                onChangeText={setName}
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
            </>
          )}

          {participants.length > 1 && (
            <>
              <Text style={modalStyles.label}>This item is for</Text>

              {/* Quick actions */}
              <View style={modalStyles.quickActions}>
                <TouchableOpacity
                  style={[
                    modalStyles.quickAction,
                    splitMode === "equal" &&
                      selectedParticipants.size === 1 &&
                      selectedParticipants.has(participantId) &&
                      modalStyles.quickActionActive,
                  ]}
                  onPress={selectOnlyMe}
                >
                  <Text
                    style={[
                      modalStyles.quickActionText,
                      splitMode === "equal" &&
                        selectedParticipants.size === 1 &&
                        selectedParticipants.has(participantId) &&
                        modalStyles.quickActionTextActive,
                    ]}
                  >
                    Just me
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    modalStyles.quickAction,
                    splitMode === "equal" &&
                      selectedParticipants.size === participants.length &&
                      modalStyles.quickActionActive,
                  ]}
                  onPress={selectAll}
                >
                  <Text
                    style={[
                      modalStyles.quickActionText,
                      splitMode === "equal" &&
                        selectedParticipants.size === participants.length &&
                        modalStyles.quickActionTextActive,
                    ]}
                  >
                    Everyone
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    modalStyles.quickAction,
                    splitMode === "custom" && modalStyles.quickActionActive,
                  ]}
                  onPress={enterCustomMode}
                >
                  <Text
                    style={[
                      modalStyles.quickActionText,
                      splitMode === "custom" &&
                        modalStyles.quickActionTextActive,
                    ]}
                  >
                    Custom split
                  </Text>
                </TouchableOpacity>
              </View>

              {splitMode === "custom" && (
                <Text style={modalStyles.helpText}>
                  Pick people and set a weight per person. Higher weight =
                  larger share.
                </Text>
              )}

              {/* Participant list */}
              <View style={modalStyles.participantList}>
                {participants.map((p) => {
                  const pName =
                    p.profiles?.display_name ?? p.guests?.name ?? "Unknown";
                  const isMe = p.id === participantId;
                  const selected = selectedParticipants.has(p.id);
                  const weight = parseFloat(weights[p.id] ?? "0") || 0;
                  const pct =
                    splitMode === "custom" && selected && totalWeight > 0
                      ? Math.round((weight / totalWeight) * 1000) / 10
                      : null;
                  return (
                    <View
                      key={p.id}
                      style={[
                        modalStyles.participantRow,
                        selected && modalStyles.participantRowSelected,
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => toggleParticipant(p.id)}
                        style={modalStyles.participantTapTarget}
                      >
                        <View
                          style={[
                            modalStyles.checkbox,
                            selected && modalStyles.checkboxChecked,
                          ]}
                        />
                        <Text style={modalStyles.participantName}>
                          {pName}
                          {isMe ? " (you)" : ""}
                        </Text>
                      </TouchableOpacity>
                      {splitMode === "custom" && selected && (
                        <View style={modalStyles.weightWrap}>
                          <TextInput
                            style={modalStyles.weightInput}
                            keyboardType="decimal-pad"
                            value={weights[p.id] ?? ""}
                            onChangeText={(v) =>
                              setWeights((w) => ({ ...w, [p.id]: v }))
                            }
                            placeholder="1"
                            placeholderTextColor={Colors.textTertiary}
                          />
                          <Text style={modalStyles.weightPct}>
                            {pct !== null ? `${pct}%` : "—"}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {splitMode === "custom" && (
                <Text
                  style={[
                    modalStyles.totalWeight,
                    totalWeight <= 0 && { color: Colors.error },
                  ]}
                >
                  {totalWeight > 0
                    ? `Total weight ${totalWeight} — covers 100%`
                    : "Set at least one weight above 0"}
                </Text>
              )}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickFromMenuSheet
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        restaurantId={restaurantId ?? undefined}
        onPickItem={(picked) => {
          setName(picked.name);
          // Price on Selection: leave the field empty so the user types it.
          setPrice(picked.price === null ? "" : picked.price.toFixed(2));
          setShowPicker(false);
        }}
      />
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
          <TouchableOpacity onPress={handleAdd} disabled={addGuest.isPending}>
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
  const deleteItem = useDeleteItem();
  const updateItem = useUpdateItem();
  const leaveOrder = useLeaveOrder();
  const removeParticipant = useRemoveParticipant();

  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showMineOnly, setShowMineOnly] = useState(false);

  // Realtime subscriptions
  useRealtimeOrder(orderId);
  useRealtimeItems(orderId);

  const isOwner = order?.created_by === user?.id;
  const isOpen = order?.status === "open";
  const isLocked = order?.status === "locked";
  const myParticipant = participants?.find((p) => p.user_id === user?.id);

  const handleItemPress = (item: any) => {
    if (!isOpen) return;
    // Only allow editing if you're the owner or you added the item
    const canEdit =
      isOwner || item.added_by_participant_id === myParticipant?.id;
    if (!canEdit) return;

    Alert.alert(item.name, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Edit",
        onPress: () => setEditingItem(item),
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Alert.alert("Delete Item", `Remove "${item.name}"?`, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => deleteItem.mutate({ itemId: item.id, orderId }),
            },
          ]);
        },
      },
    ]);
  };

  const handleLock = () => {
    if (!items?.length) {
      Alert.alert(
        "No Items",
        "Add at least one item before locking the order.",
      );
      return;
    }

    Alert.alert("Lock Order", "No more items can be added after locking.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Lock",
        onPress: () => updateStatus.mutate({ orderId, status: "locked" }),
      },
    ]);
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
      ],
    );
  };

  const refetchAll = () => {
    refetchParticipants();
    refetchItems();
  };

  const handleLeaveOrder = () => {
    if (!myParticipant) return;
    Alert.alert(
      "Leave Order",
      "You'll no longer be part of this bill. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              await leaveOrder.mutateAsync({
                orderId,
                participantId: myParticipant.id,
              });
              router.back();
            } catch (error: any) {
              Alert.alert("Cannot leave", error.message);
            }
          },
        },
      ],
    );
  };

  const handleRemoveParticipant = (p: any) => {
    const targetName =
      p.profiles?.display_name ?? p.guests?.name ?? "this person";
    Alert.alert("Remove from order", `Remove ${targetName} from this order?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeParticipant.mutateAsync({
              orderId,
              participantId: p.id,
              targetName,
            });
          } catch (error: any) {
            Alert.alert("Cannot remove", error.message);
          }
        },
      },
    ]);
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

  const itemsTotal =
    items?.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0) ??
    0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: order.title }} />

      <FlatList
        data={
          showMineOnly && myParticipant
            ? (items ?? []).filter((it: any) =>
                (it.item_shares ?? []).some(
                  (s: any) => s.participant_id === myParticipant.id,
                ),
              )
            : (items ?? [])
        }
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

            {/* Restaurant context (only if order is restaurant-tied) */}
            {order.restaurant && (
              <View style={styles.restaurantBanner}>
                {order.restaurant.logo_url ? (
                  <Image
                    source={{ uri: order.restaurant.logo_url }}
                    style={styles.restaurantBannerLogo}
                  />
                ) : (
                  <View
                    style={[
                      styles.restaurantBannerLogo,
                      { backgroundColor: Colors.primaryLight },
                    ]}
                  >
                    <Text style={styles.restaurantBannerLogoText}>
                      {order.restaurant.name[0]?.toUpperCase() ?? "?"}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.restaurantBannerLabel}>
                    Ordering from
                  </Text>
                  <Text style={styles.restaurantBannerName}>
                    {order.restaurant.name}
                  </Text>
                  {order.restaurant.cuisine && (
                    <Text style={styles.restaurantBannerCuisine}>
                      {order.restaurant.cuisine}
                    </Text>
                  )}
                </View>
              </View>
            )}

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
              <View style={styles.participantsList}>
                {participants?.map((p) => {
                  const name =
                    p.profiles?.display_name ?? p.guests?.name ?? "?";
                  const isGuest = !!p.guest_id;
                  const isCreatorRow = p.user_id === order.created_by;
                  const canRemove = isOwner && isOpen && !isCreatorRow;
                  return (
                    <View key={p.id} style={styles.participantItem}>
                      <View
                        style={[
                          styles.participantAvatar,
                          isGuest && styles.participantAvatarGuest,
                        ]}
                      >
                        <Text style={styles.participantAvatarText}>
                          {name[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.participantInfo}>
                        <Text style={styles.participantName} numberOfLines={1}>
                          {name}
                        </Text>
                        {isGuest && (
                          <Text style={styles.participantGuestTag}>Guest</Text>
                        )}
                      </View>
                      {canRemove && (
                        <TouchableOpacity
                          style={styles.removeParticipantBtn}
                          onPress={() => handleRemoveParticipant(p)}
                          accessibilityLabel={`Remove ${name}`}
                        >
                          <Text style={styles.removeParticipantBtnText}>×</Text>
                        </TouchableOpacity>
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
              <View style={styles.itemsHeaderActions}>
                {myParticipant && (items?.length ?? 0) > 0 && (
                  <TouchableOpacity
                    onPress={() => setShowMineOnly((v) => !v)}
                    style={[
                      styles.filterToggle,
                      showMineOnly && styles.filterToggleActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterToggleText,
                        showMineOnly && styles.filterToggleTextActive,
                      ]}
                    >
                      {showMineOnly ? "My items only" : "All items"}
                    </Text>
                  </TouchableOpacity>
                )}
                {isOpen && myParticipant && (
                  <TouchableOpacity
                    onPress={() => {
                      refetchParticipants();
                      setShowAddItem(true);
                    }}
                  >
                    <Text style={styles.addLink}>+ Add Item</Text>
                  </TouchableOpacity>
                )}
              </View>
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

          const shareLabels = formatShareLabels(
            item.item_shares ?? [],
            (pid) => {
              const p = participants?.find((p) => p.id === pid);
              return p?.profiles?.display_name ?? p?.guests?.name ?? null;
            },
          );

          const isSharedItem = shareLabels.length > 1;

          return (
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => handleItemPress(item)}
              disabled={!isOpen}
            >
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                {isSharedItem ? (
                  <Text style={styles.sharedLabel}>
                    Split: {shareLabels.join(", ")}
                  </Text>
                ) : addedByName ? (
                  <Text style={styles.addedByLabel}>{addedByName}</Text>
                ) : null}
              </View>
              <Text style={styles.itemPrice}>
                {item.price != null ? `${item.price.toFixed(2)}` : "No price"}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            {(items?.length ?? 0) > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Items Total</Text>
                <Text style={styles.totalAmount}>{itemsTotal.toFixed(2)}</Text>
              </View>
            )}

            {/* Actions */}
            {isOwner && isOpen && (
              <TouchableOpacity style={styles.lockButton} onPress={handleLock}>
                <Text style={styles.lockButtonText}>Lock Order</Text>
              </TouchableOpacity>
            )}

            {isOwner && isLocked && (
              <>
                <Link
                  href={
                    `/(tabs)/groups/${groupId}/orders/${orderId}/finalize` as any
                  }
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
              <JoinOrderButton
                orderId={orderId}
                userId={user.id}
                onJoined={refetchParticipants}
              />
            )}

            {myParticipant && !isOwner && isOpen && (
              <TouchableOpacity
                style={styles.leaveOrderButton}
                onPress={handleLeaveOrder}
                disabled={leaveOrder.isPending}
              >
                <Text style={styles.leaveOrderButtonText}>
                  {leaveOrder.isPending ? "Leaving…" : "Leave Order"}
                </Text>
              </TouchableOpacity>
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
          isOwner={isOwner}
          restaurantId={order.restaurant_id ?? null}
        />
      )}

      <AddGuestModal
        visible={showAddGuest}
        onClose={() => setShowAddGuest(false)}
        orderId={orderId}
        groupId={groupId}
      />

      {/* Edit Item Modal */}
      {editingItem && (
        <Modal visible={true} animationType="slide">
          <KeyboardAvoidingView
            style={modalStyles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={modalStyles.header}>
              <TouchableOpacity onPress={() => setEditingItem(null)}>
                <Text style={modalStyles.headerCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={modalStyles.headerTitle}>Edit Item</Text>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await updateItem.mutateAsync({
                      itemId: editingItem.id,
                      orderId,
                      name: editingItem._editName ?? editingItem.name,
                      price:
                        editingItem._editPrice !== undefined
                          ? parseFloat(editingItem._editPrice) || null
                          : editingItem.price,
                    });
                    setEditingItem(null);
                  } catch (error: any) {
                    Alert.alert("Error", error.message);
                  }
                }}
              >
                <Text style={modalStyles.headerAction}>Save</Text>
              </TouchableOpacity>
            </View>
            <View style={modalStyles.body}>
              <Text style={modalStyles.label}>Item Name</Text>
              <TextInput
                style={modalStyles.input}
                value={editingItem._editName ?? editingItem.name}
                onChangeText={(v) =>
                  setEditingItem({ ...editingItem, _editName: v })
                }
                autoFocus
              />
              <Text style={modalStyles.label}>Price</Text>
              <TextInput
                style={modalStyles.input}
                value={
                  editingItem._editPrice !== undefined
                    ? editingItem._editPrice
                    : (editingItem.price?.toString() ?? "")
                }
                onChangeText={(v) =>
                  setEditingItem({ ...editingItem, _editPrice: v })
                }
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    paddingTop: Platform.OS === "ios" ? 60 : Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerCancel: { fontSize: FontSize.md, color: Colors.textSecondary },
  headerTitle: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text },
  headerAction: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: "600",
  },
  body: { padding: Spacing.lg },
  label: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  pickFromMenuButton: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "10",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  pickFromMenuText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: "700",
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  quickAction: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  quickActionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "15",
  },
  quickActionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  quickActionTextActive: { color: Colors.primary, fontWeight: "600" },
  helpText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  participantList: { marginTop: Spacing.sm, gap: Spacing.xs },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  participantRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "10",
  },
  participantTapTarget: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  participantName: { fontSize: FontSize.md, color: Colors.text },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  weightWrap: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  weightInput: {
    width: 56,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    fontSize: FontSize.md,
    color: Colors.text,
    textAlign: "center",
  },
  weightPct: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    minWidth: 38,
    textAlign: "right",
  },
  totalWeight: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    fontStyle: "italic",
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  listContent: { padding: Spacing.lg },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: { fontSize: FontSize.xs, fontWeight: "700", letterSpacing: 1 },
  ownerTag: { fontSize: FontSize.xs, color: Colors.textSecondary },
  restaurantBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.primary + "10",
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  restaurantBannerLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantBannerLogoText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: FontSize.md,
  },
  restaurantBannerLabel: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  restaurantBannerName: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 2,
  },
  restaurantBannerCuisine: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  section: { marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.text,
  },
  addLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },
  participantsList: { gap: Spacing.xs },
  participantItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  participantAvatarGuest: { backgroundColor: Colors.secondaryLight },
  participantAvatarText: {
    color: "#FFFFFF",
    fontSize: FontSize.xs,
    fontWeight: "700",
  },
  participantInfo: { flex: 1 },
  participantName: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: "500",
  },
  participantGuestTag: { fontSize: FontSize.xs, color: Colors.textTertiary },
  emptyItems: { alignItems: "center", paddingVertical: Spacing.xl },
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
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: FontSize.md, color: Colors.text, fontWeight: "500" },
  sharedLabel: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: "500",
  },
  addedByLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
  itemPrice: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text },
  footer: { marginTop: Spacing.md, gap: Spacing.sm },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text },
  totalAmount: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text },
  lockButton: {
    backgroundColor: Colors.warning,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
  },
  lockButtonText: {
    color: "#FFFFFF",
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  finalizeButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
  },
  finalizeButtonText: {
    color: "#FFFFFF",
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  reopenButton: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reopenButtonText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
  },
  deleteButtonText: {
    color: Colors.error,
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  joinButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
  },
  joinButtonText: {
    color: "#FFFFFF",
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  leaveOrderButton: {
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
  },
  leaveOrderButtonText: {
    color: Colors.error,
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  removeParticipantBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceSecondary,
  },
  removeParticipantBtnText: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    lineHeight: FontSize.lg,
  },
  itemsHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  filterToggle: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterToggleActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "15",
  },
  filterToggleText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  filterToggleTextActive: { color: Colors.primary, fontWeight: "600" },
});
