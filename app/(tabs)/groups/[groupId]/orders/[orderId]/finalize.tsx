import { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import {
  useOrder,
  useOrderParticipants,
  useOrderItems,
  useUpdateOrderStatus,
} from "@/src/hooks/useOrders";
import { useAuth } from "@/src/providers/AuthProvider";
import { supabase } from "@/src/lib/supabase";
import {
  calculateSplit,
  CalcItem,
  CalcParticipant,
  CalcPayment,
} from "@/src/utils/calculations";
import { formatCurrency } from "@/src/utils/currency";
import { formatShareLabels } from "@/src/utils/itemShares";
import {
  MergeGroup,
  DisplayRow,
  deriveDisplayRows,
  applyPriceToRow,
  mergeIntoGroup,
  unmergeGroup,
} from "@/src/utils/finalizeMerge";
import { notifyOrderFinalized } from "@/src/utils/notifications";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function FinalizeScreen() {
  const { groupId, orderId } = useLocalSearchParams<{
    groupId: string;
    orderId: string;
  }>();
  const { user } = useAuth();
  const { data: order } = useOrder(orderId);
  const { data: participants } = useOrderParticipants(orderId);
  const { data: items, refetch: refetchItems } = useOrderItems(orderId);
  const updateStatus = useUpdateOrderStatus();

  const [actualTotal, setActualTotal] = useState(
    order?.actual_total?.toString() ?? ""
  );
  const [tax, setTax] = useState(order?.tax ? order.tax.toString() : "");
  const [vat, setVat] = useState(order?.vat ? order.vat.toString() : "");
  const [delivery, setDelivery] = useState(order?.delivery ? order.delivery.toString() : "");
  const [discount, setDiscount] = useState(order?.discount ? order.discount.toString() : "");
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({});
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // "Combine items" merge state — display-only, ephemeral, no DB writes.
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>([]);

  const displayRows = useMemo<DisplayRow[]>(
    () => deriveDisplayRows((items ?? []).map((i: any) => ({ id: i.id })), mergeGroups),
    [items, mergeGroups]
  );

  const toggleSelectForMerge = (itemId: string) => {
    setSelectedForMerge((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleMergeSelected = () => {
    const ids = Array.from(selectedForMerge);
    if (ids.length < 2) return;
    const groupId = `merge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setMergeGroups((prev) => mergeIntoGroup(prev, ids, groupId));
    // Blank the prices for newly-merged items so the user types a fresh
    // per-item value (avoids stale individual prices "stuck" behind the
    // group's single input).
    setItemPrices((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = "";
      return next;
    });
    setSelectedForMerge(new Set());
  };

  const handleUnmerge = (groupId: string) => {
    setMergeGroups((prev) => unmergeGroup(prev, groupId));
  };

  // Merge edited prices with existing
  const effectiveItems = useMemo(() => {
    return (items ?? []).map((item) => ({
      ...item,
      price:
        itemPrices[item.id] !== undefined
          ? parseFloat(itemPrices[item.id]) || 0
          : item.price ?? 0,
    }));
  }, [items, itemPrices]);

  const itemsSum = effectiveItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const missingPrices = effectiveItems.filter(
    (item) => item.price === 0 || item.price === null
  );

  const totalNum = parseFloat(actualTotal) || 0;
  const taxNum = parseFloat(tax) || 0;
  const vatNum = parseFloat(vat) || 0;
  const deliveryNum = parseFloat(delivery) || 0;
  const discountNum = parseFloat(discount) || 0;


  const paymentsTotal = Object.values(payerAmounts).reduce(
    (sum, amt) => sum + (parseFloat(amt) || 0),
    0
  );
  const hasPayments = paymentsTotal > 0;
  const paymentsDiff = hasPayments ? round2(paymentsTotal - totalNum) : 0;

  // Preview calculation
  const preview = useMemo(() => {
    if (!participants?.length || !totalNum) return null;

    const calcItems: CalcItem[] = effectiveItems.map((item) => {
      // Use actual item_shares from DB
      const origItem = items?.find((i) => i.id === item.id) as any;
      const dbShares = origItem?.item_shares ?? [];

      const shares = dbShares.length > 0
        ? dbShares.map((s: any) => ({
            participantId: s.participant_id,
            fraction: s.share_fraction,
          }))
        : [{ participantId: item.added_by_participant_id, fraction: 1 }];

      return {
        id: item.id,
        price: item.price,
        quantity: item.quantity,
        shares,
      };
    });

    const calcParticipants: CalcParticipant[] = (participants ?? []).map(
      (p) => ({
        id: p.id,
        userId: p.user_id,
        guestId: p.guest_id,
        hostUserId: (p as any).guests?.host_user_id ?? undefined,
        isIncluded: true,
      })
    );

    const calcPayments: CalcPayment[] = Object.entries(payerAmounts)
      .filter(([_, amt]) => parseFloat(amt) > 0)
      .map(([pid, amt]) => ({
        participantId: pid,
        amount: parseFloat(amt),
      }));

    // If no payments entered, assume owner paid everything
    if (calcPayments.length === 0) {
      const ownerParticipant = participants?.find(
        (p) => p.user_id === user?.id
      );
      if (ownerParticipant) {
        calcPayments.push({
          participantId: ownerParticipant.id,
          amount: totalNum,
        });
      }
    }

    try {
      return calculateSplit({
        items: calcItems,
        payments: calcPayments,
        participants: calcParticipants,
        actualTotal: totalNum,
        tax: taxNum,
        vat: vatNum,
        delivery: deliveryNum,
        discount: discountNum,
      });
    } catch {
      return null;
    }
  }, [
    effectiveItems,
    participants,
    payerAmounts,
    totalNum,
    taxNum,
    vatNum,
    deliveryNum,
    discountNum,
    user,
  ]);

  const handleFinalize = async () => {
    if (missingPrices.length > 0) {
      Alert.alert("Missing Prices", "Please fill in all item prices first.");
      return;
    }
    if (!totalNum) {
      Alert.alert("Missing Total", "Please enter the actual bill total.");
      return;
    }

    const expectedTotal = round2(itemsSum + taxNum + vatNum + deliveryNum - discountNum);
    const totalDiff = round2(totalNum - expectedTotal);
    if (Math.abs(totalDiff) > 0.01) {
      Alert.alert(
        "Total Mismatch",
        `Items (${formatCurrency(itemsSum)}) + Tax (${formatCurrency(taxNum)}) + VAT (${formatCurrency(vatNum)}) + Delivery (${formatCurrency(deliveryNum)}) - Discount (${formatCurrency(discountNum)}) = ${formatCurrency(expectedTotal)}\n\nBut bill total is ${formatCurrency(totalNum)}.\n\nDifference: ${formatCurrency(Math.abs(totalDiff))}\n\nPlease adjust item prices or fees to match the bill total.`
      );
      return;
    }

    if (hasPayments && Math.abs(paymentsDiff) > 0.01) {
      Alert.alert(
        "Payments Don't Match",
        `Payments total (${formatCurrency(paymentsTotal)}) doesn't match the bill total (${formatCurrency(totalNum)}). Difference: ${formatCurrency(paymentsDiff)}`
      );
      return;
    }

    Alert.alert("Finalize Order", "This will lock the order and update group balances.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Finalize",
        onPress: async () => {
          setLoading(true);
          try {
            // Update item prices that were edited
            for (const [itemId, priceStr] of Object.entries(itemPrices)) {
              const price = parseFloat(priceStr);
              if (!isNaN(price)) {
                await supabase
                  .from("items")
                  .update({ price })
                  .eq("id", itemId);
              }
            }

            // Update order with totals
            await supabase
              .from("orders")
              .update({
                actual_total: totalNum,
                tax: taxNum,
                vat: vatNum,
                delivery: deliveryNum,
                discount: discountNum,
              })
              .eq("id", orderId);

            // Save payments
            for (const [pid, amtStr] of Object.entries(payerAmounts)) {
              const amount = parseFloat(amtStr);
              if (amount > 0) {
                await supabase.from("payments").insert({
                  order_id: orderId,
                  participant_id: pid,
                  amount,
                });
              }
            }

            // If no explicit payments, save owner as sole payer
            if (Object.keys(payerAmounts).length === 0 && preview?.debts) {
              const ownerParticipant = participants?.find(
                (p) => p.user_id === user?.id
              );
              if (ownerParticipant) {
                await supabase.from("payments").insert({
                  order_id: orderId,
                  participant_id: ownerParticipant.id,
                  amount: totalNum,
                });
              }
            }

            // Write ledger entries
            if (preview?.debts) {
              // Only insert debts between real users (not guest: prefixed)
              const ledgerEntries = preview.debts
                .filter((d) => !d.fromUserId.startsWith("guest:") && !d.toUserId.startsWith("guest:"))
                .map((d) => ({
                  group_id: groupId,
                  from_user_id: d.fromUserId,
                  to_user_id: d.toUserId,
                  amount: d.amount,
                  type: "order_debt" as const,
                  order_id: orderId,
                }));

              if (ledgerEntries.length > 0) {
                // Use service role via RPC or direct insert
                // For now, we'll need to adjust RLS to allow order_debt inserts by the order owner
                const { error } = await supabase
                  .from("ledger_entries")
                  .insert(ledgerEntries);
                if (error) {
                  console.error("Ledger insert failed:", error.message);
                  Alert.alert("Warning", "Failed to update group balances: " + error.message);
                }
              }
            }

            // Update order status
            await updateStatus.mutateAsync({
              orderId,
              status: "finalized",
            });

            // Send notification
            const { data: profile } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", user!.id)
              .single();

            notifyOrderFinalized(
              groupId,
              orderId,
              order?.title ?? "Order",
              profile?.display_name ?? "Someone",
              user!.id
            );

            router.replace(
              `/(tabs)/groups/${groupId}/orders/${orderId}/summary` as any
            );
          } catch (error: any) {
            Alert.alert("Error", error.message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: "Finalize Bill" }} />

        {/* Item Prices */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Item Prices</Text>
          {(items ?? []).length > 1 && (
            <TouchableOpacity
              onPress={() => {
                setMergeMode((m) => !m);
                setSelectedForMerge(new Set());
              }}
              style={styles.combineToggle}
            >
              <Text style={styles.combineToggleText}>
                {mergeMode ? "Done" : "Combine items"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {displayRows.map((row) => {
          if (row.kind === "item") {
            const item = effectiveItems.find((i) => i.id === row.itemId);
            if (!item) return null;
            const origItem = items?.find((i) => i.id === item.id) as any;
            const itemShares = origItem?.item_shares ?? [];
            const shareLabels = formatShareLabels(itemShares, (pid) => {
              const p = participants?.find((p: any) => p.id === pid);
              return p?.profiles?.display_name ?? p?.guests?.name ?? null;
            });
            const addedByName =
              origItem?.added_by?.profiles?.display_name ??
              origItem?.added_by?.guests?.name ??
              null;
            const isSharedItem = shareLabels.length > 1;
            const selected = selectedForMerge.has(item.id);

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.itemRow,
                  mergeMode && selected && styles.itemRowSelected,
                ]}
                activeOpacity={mergeMode ? 0.6 : 1}
                disabled={!mergeMode}
                onPress={() => toggleSelectForMerge(item.id)}
              >
                {mergeMode && (
                  <View
                    style={[
                      styles.mergeCheckbox,
                      selected && styles.mergeCheckboxChecked,
                    ]}
                  />
                )}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {isSharedItem ? (
                    <Text style={styles.sharedTag}>
                      Split: {shareLabels.join(", ")}
                    </Text>
                  ) : addedByName ? (
                    <Text style={styles.addedByTag}>{addedByName}</Text>
                  ) : null}
                </View>
                {!mergeMode && (
                  <TextInput
                    style={[
                      styles.priceInput,
                      !item.price && styles.priceInputMissing,
                    ]}
                    value={
                      itemPrices[item.id] !== undefined
                        ? itemPrices[item.id]
                        : item.price ? item.price.toString() : ""
                    }
                    onChangeText={(v) =>
                      setItemPrices((prev) =>
                        applyPriceToRow(row, v, prev)
                      )
                    }
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.textTertiary}
                  />
                )}
              </TouchableOpacity>
            );
          }

          // Group row
          const groupItems = row.itemIds
            .map((id) => items?.find((i) => i.id === id))
            .filter(Boolean) as any[];
          if (groupItems.length === 0) return null;
          const nameSource =
            groupItems.find((i) => i.id === row.displayNameSourceId) ??
            groupItems[0];
          const groupName = `${nameSource.name} ×${row.itemIds.length}`;

          // Union of unique participant names across all items in the group.
          const pidSet = new Set<string>();
          for (const gi of groupItems) {
            for (const s of gi.item_shares ?? []) {
              if (s.participant_id) pidSet.add(s.participant_id);
            }
          }
          const groupShareNames: string[] = [];
          for (const pid of pidSet) {
            const p = participants?.find((pp: any) => pp.id === pid);
            const name = p?.profiles?.display_name ?? p?.guests?.name;
            if (name) groupShareNames.push(name);
          }

          // All underlying items share the same price after applyPriceToRow.
          // Read from the first item.
          const firstId = row.itemIds[0];
          const firstItem = effectiveItems.find((i) => i.id === firstId);
          const priceValue =
            itemPrices[firstId] !== undefined
              ? itemPrices[firstId]
              : firstItem?.price ? firstItem.price.toString() : "";

          const groupSelectedItemId = row.itemIds.find((id) =>
            selectedForMerge.has(id)
          );

          return (
            <TouchableOpacity
              key={row.groupId}
              style={[
                styles.itemRow,
                styles.groupRow,
                mergeMode && groupSelectedItemId && styles.itemRowSelected,
              ]}
              activeOpacity={mergeMode ? 0.6 : 1}
              disabled={!mergeMode}
              onPress={() => {
                // Tapping a group in merge mode toggles selection of the
                // primary item id, which then flattens with the group when
                // user hits "Merge" (via mergeIntoGroup's overlap handling).
                toggleSelectForMerge(row.itemIds[0]);
              }}
            >
              {mergeMode && (
                <View
                  style={[
                    styles.mergeCheckbox,
                    groupSelectedItemId && styles.mergeCheckboxChecked,
                  ]}
                />
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{groupName}</Text>
                {groupShareNames.length > 0 && (
                  <Text style={styles.sharedTag}>
                    Split: {groupShareNames.join(", ")}
                  </Text>
                )}
              </View>
              {!mergeMode && (
                <>
                  <TextInput
                    style={[
                      styles.priceInput,
                      !priceValue && styles.priceInputMissing,
                    ]}
                    value={priceValue}
                    onChangeText={(v) =>
                      setItemPrices((prev) => applyPriceToRow(row, v, prev))
                    }
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <TouchableOpacity
                    onPress={() => handleUnmerge(row.groupId)}
                    style={styles.unmergeBtn}
                    accessibilityLabel="Unmerge group"
                  >
                    <Text style={styles.unmergeBtnText}>×</Text>
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          );
        })}

        {mergeMode && (
          <View style={styles.mergeToolbar}>
            <Text style={styles.mergeToolbarCount}>
              {selectedForMerge.size} selected
            </Text>
            <TouchableOpacity
              style={[
                styles.mergeButton,
                selectedForMerge.size < 2 && styles.mergeButtonDisabled,
              ]}
              disabled={selectedForMerge.size < 2}
              onPress={handleMergeSelected}
            >
              <Text style={styles.mergeButtonText}>
                Merge {selectedForMerge.size > 0 ? selectedForMerge.size : ""}{" "}
                items
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>Items Sum</Text>
          <Text style={styles.sumValue}>{formatCurrency(itemsSum)}</Text>
        </View>

        {/* Bill Total */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>
          Bill Total
        </Text>

        <Text style={styles.label}>Actual Total (from receipt)</Text>
        <TextInput
          style={styles.input}
          value={actualTotal}
          onChangeText={setActualTotal}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={Colors.textTertiary}
        />

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Tax</Text>
            <TextInput
              style={styles.input}
              value={tax}
              onChangeText={setTax}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>VAT</Text>
            <TextInput
              style={styles.input}
              value={vat}
              onChangeText={setVat}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Delivery</Text>
            <TextInput
              style={styles.input}
              value={delivery}
              onChangeText={setDelivery}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Discount</Text>
            <TextInput
              style={styles.input}
              value={discount}
              onChangeText={setDiscount}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Payments */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>
          Who Paid?
        </Text>
        <Text style={styles.hint}>
          Leave empty if you paid the full bill
        </Text>
        {participants?.map((p) => {
          const name =
            p.profiles?.display_name ?? p.guests?.name ?? "Unknown";
          return (
            <View key={p.id} style={styles.payerRow}>
              <Text style={styles.payerName}>{name}</Text>
              <TextInput
                style={styles.payerInput}
                value={payerAmounts[p.id] ?? ""}
                onChangeText={(v) =>
                  setPayerAmounts((prev) => ({ ...prev, [p.id]: v }))
                }
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          );
        })}

        {/* Payments summary */}
        {hasPayments && (
          <View style={[
            styles.paymentsSummary,
            Math.abs(paymentsDiff) > 0.01 ? styles.paymentsMismatch : styles.paymentsMatch,
          ]}>
            <View style={styles.paymentsSummaryRow}>
              <Text style={styles.paymentsSummaryLabel}>Payments Total</Text>
              <Text style={styles.paymentsSummaryValue}>
                {formatCurrency(paymentsTotal)}
              </Text>
            </View>
            <View style={styles.paymentsSummaryRow}>
              <Text style={styles.paymentsSummaryLabel}>Bill Total</Text>
              <Text style={styles.paymentsSummaryValue}>
                {formatCurrency(totalNum)}
              </Text>
            </View>
            {Math.abs(paymentsDiff) > 0.01 && (
              <Text style={styles.paymentsDiffText}>
                {paymentsDiff > 0
                  ? `Overpaid by ${formatCurrency(paymentsDiff)}`
                  : `Short by ${formatCurrency(Math.abs(paymentsDiff))}`}
              </Text>
            )}
            {Math.abs(paymentsDiff) <= 0.01 && (
              <Text style={styles.paymentsOkText}>Payments match the bill</Text>
            )}
          </View>
        )}

        {/* Preview */}
        {preview && (
          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Preview</Text>
            {preview.breakdowns
              .filter((b) => b.totalOwed > 0 || b.totalPaid > 0)
              .map((b) => {
                const p = participants?.find(
                  (p) => p.id === b.participantId
                );
                const name =
                  p?.profiles?.display_name ?? p?.guests?.name ?? "Unknown";
                const isGuest = !!b.guestId;
                return (
                  <View key={b.participantId} style={styles.previewRow}>
                    <Text style={styles.previewName}>
                      {name}{isGuest ? "  (Guest)" : ""}
                    </Text>
                    <View style={styles.previewAmounts}>
                      <Text style={styles.previewOwes}>
                        Owes: {formatCurrency(b.totalOwed)}
                      </Text>
                      {b.totalPaid > 0 && (
                        <Text style={styles.previewPaid}>
                          Paid: {formatCurrency(b.totalPaid)}
                        </Text>
                      )}
                      {b.net === 0 ? (
                        <Text style={[styles.previewNet, { color: Colors.success }]}>
                          Settled
                        </Text>
                      ) : (
                        <Text
                          style={[
                            styles.previewNet,
                            { color: b.net > 0 ? Colors.success : Colors.error },
                          ]}
                        >
                          {b.net > 0
                            ? `Gets back ${formatCurrency(b.net)}`
                            : `Owes ${formatCurrency(Math.abs(b.net))}`}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
          </View>
        )}

        {/* Settlements */}
        {preview && preview.debts.length > 0 && (
          <View style={styles.settlementsSection}>
            <Text style={styles.sectionTitle}>Who Pays Who</Text>
            {preview.debts.map((d, i) => {
              const resolveDebtName = (id: string) => {
                if (id.startsWith("guest:")) {
                  const guestId = id.replace("guest:", "");
                  const guestP = participants?.find((p) => p.guest_id === guestId);
                  return (guestP?.guests?.name ?? "Guest") + " (Guest)";
                }
                const p = participants?.find((p) => p.user_id === id);
                return p?.profiles?.display_name ?? "Unknown";
              };
              const fromName = resolveDebtName(d.fromUserId);
              const toName = resolveDebtName(d.toUserId);
              return (
                <View key={i} style={styles.settlementRow}>
                  <View style={styles.settlementArrow}>
                    <Text style={styles.settlementFrom}>{fromName}</Text>
                    <Text style={styles.settlementArrowText}>→</Text>
                    <Text style={styles.settlementTo}>{toName}</Text>
                  </View>
                  <Text style={styles.settlementAmount}>
                    {formatCurrency(d.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {preview && preview.debts.length === 0 && preview.breakdowns.length > 0 && (
          <View style={styles.settlementsSection}>
            <Text style={styles.allSettledText}>Everyone is settled!</Text>
          </View>
        )}

        {/* Finalize Button */}
        <TouchableOpacity
          style={[styles.finalizeButton, loading && { opacity: 0.6 }]}
          onPress={handleFinalize}
          disabled={loading}
        >
          <Text style={styles.finalizeText}>
            {loading ? "Finalizing..." : "Finalize Order"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.text, marginBottom: Spacing.sm },
  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  combineToggle: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primary + "15" },
  combineToggleText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },
  label: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.text, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  hint: { fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.sm },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.text },
  row: { flexDirection: "row", gap: Spacing.sm },
  halfInput: { flex: 1 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm },
  itemRowSelected: { backgroundColor: Colors.primary + "10" },
  groupRow: { backgroundColor: Colors.surface, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, marginVertical: 2, borderBottomWidth: 0 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: FontSize.md, color: Colors.text },
  sharedTag: { fontSize: FontSize.xs, color: Colors.primary },
  addedByTag: { fontSize: FontSize.xs, color: Colors.textTertiary },
  priceInput: { width: 100, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, padding: Spacing.sm, fontSize: FontSize.md, color: Colors.text, textAlign: "right" },
  priceInputMissing: { borderColor: Colors.error, backgroundColor: Colors.errorLight },
  mergeCheckbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border },
  mergeCheckboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  unmergeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surfaceSecondary },
  unmergeBtnText: { fontSize: FontSize.lg, color: Colors.textSecondary, lineHeight: FontSize.lg },
  mergeToolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.sm, marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  mergeToolbarCount: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: "500" },
  mergeButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: Colors.primary },
  mergeButtonDisabled: { opacity: 0.4 },
  mergeButtonText: { fontSize: FontSize.sm, color: "#FFFFFF", fontWeight: "600" },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.sm, marginTop: Spacing.xs },
  sumLabel: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text },
  sumValue: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text },
  payerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.sm },
  payerName: { fontSize: FontSize.md, color: Colors.text, flex: 1 },
  payerInput: { width: 100, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, padding: Spacing.sm, fontSize: FontSize.md, color: Colors.text, textAlign: "right" },
  paymentsSummary: { padding: Spacing.sm, borderRadius: BorderRadius.sm, marginTop: Spacing.sm },
  paymentsMismatch: { backgroundColor: Colors.errorLight },
  paymentsMatch: { backgroundColor: Colors.successLight },
  paymentsSummaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  paymentsSummaryLabel: { fontSize: FontSize.sm, color: Colors.text },
  paymentsSummaryValue: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.text },
  paymentsDiffText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.error, marginTop: Spacing.xs },
  paymentsOkText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.success, marginTop: Spacing.xs },
  previewSection: { marginTop: Spacing.lg, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  previewRow: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  previewName: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text },
  previewAmounts: { marginTop: Spacing.xs },
  previewOwes: { fontSize: FontSize.sm, color: Colors.textSecondary },
  previewPaid: { fontSize: FontSize.sm, color: Colors.textSecondary },
  previewNet: { fontSize: FontSize.sm, fontWeight: "600", marginTop: 2 },
  settlementsSection: { marginTop: Spacing.lg, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  settlementRow: { flexDirection: "column", gap: Spacing.xs, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  settlementArrow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flexWrap: "wrap" },
  settlementFrom: { fontSize: FontSize.md, color: Colors.error, fontWeight: "500", flexShrink: 1 },
  settlementArrowText: { fontSize: FontSize.lg, color: Colors.textTertiary },
  settlementTo: { fontSize: FontSize.md, color: Colors.success, fontWeight: "500", flexShrink: 1 },
  settlementAmount: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text, alignSelf: "flex-end" },
  allSettledText: { fontSize: FontSize.md, fontWeight: "600", color: Colors.success, textAlign: "center" },
  finalizeButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center", marginTop: Spacing.xl },
  finalizeText: { color: "#FFFFFF", fontSize: FontSize.md, fontWeight: "600" },
});
