import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Link } from "expo-router";
import { useGroups } from "@/src/hooks/useGroups";
import { GroupCard } from "@/src/components/groups/GroupCard";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

export default function GroupsScreen() {
  const { data: groups, isLoading, refetch, isRefetching } = useGroups();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!groups?.length ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptySubtitle}>
            Create a group to start splitting bills with friends
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          renderItem={({ item }) => <GroupCard group={item} />}
        />
      )}

      <View style={styles.actions}>
        <Link href="/(tabs)/groups/create" asChild>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Create Group</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/(tabs)/groups/join" asChild>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Join with Code</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: "700", color: Colors.text, marginBottom: Spacing.sm },
  emptySubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: "center" },
  list: { gap: Spacing.md, paddingBottom: Spacing.md },
  actions: { gap: Spacing.sm, paddingBottom: Spacing.lg },
  primaryButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: FontSize.md, fontWeight: "600" },
  secondaryButton: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  secondaryButtonText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: "600" },
});
