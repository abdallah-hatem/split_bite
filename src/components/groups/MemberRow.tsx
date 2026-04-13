import { View, Text, StyleSheet } from "react-native";
import { Member } from "@/src/hooks/useGroup";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

type Props = {
  member: Member;
};

export function MemberRow({ member }: Props) {
  const name = member.profiles.display_name || "Unknown";

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{name[0].toUpperCase()}</Text>
      </View>
      <Text style={styles.name}>{name}</Text>
      {member.role === "admin" && (
        <Text style={styles.badge}>Admin</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: FontSize.sm,
    fontWeight: "700",
  },
  name: {
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
  },
  badge: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: "600",
    backgroundColor: Colors.primary + "15",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
});
