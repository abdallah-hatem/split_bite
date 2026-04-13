import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { GroupWithMeta } from "@/src/hooks/useGroups";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

type Props = {
  group: GroupWithMeta;
};

export function GroupCard({ group }: Props) {
  const hasActive = group.activeOrders > 0;

  return (
    <Link href={`/(tabs)/groups/${group.id}`} asChild>
      <TouchableOpacity
        style={[styles.card, hasActive && styles.cardActive]}
      >
        <View style={styles.row}>
          <View style={[styles.avatar, hasActive && styles.avatarActive]}>
            <Text style={styles.avatarText}>
              {group.name[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{group.name}</Text>
              {group.isOwner && (
                <View style={styles.ownerBadge}>
                  <Text style={styles.ownerText}>Owner</Text>
                </View>
              )}
            </View>
            {hasActive ? (
              <View style={styles.metaRow}>
                <View style={styles.dot} />
                <Text style={styles.activeText}>
                  {group.activeOrders} active order{group.activeOrders !== 1 ? "s" : ""}
                </Text>
                {group.myActiveOrder && (
                  <Text style={styles.myOrderText}> · Your order</Text>
                )}
              </View>
            ) : group.description ? (
              <Text style={styles.desc} numberOfLines={1}>
                {group.description}
              </Text>
            ) : null}
          </View>
          <Text style={styles.currency}>{group.currency}</Text>
        </View>
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
  cardActive: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarActive: {
    backgroundColor: Colors.success,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: FontSize.lg,
    fontWeight: "700",
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.text,
  },
  ownerBadge: {
    backgroundColor: Colors.primary + "15",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  ownerText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: "600",
  },
  desc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  activeText: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: "500",
  },
  myOrderText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: "500",
  },
  currency: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: "500",
  },
});
