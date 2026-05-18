import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { Stack } from "expo-router";
import { useRestaurants, Restaurant } from "@/src/hooks/useRestaurants";
import {
  useScrapeRestaurant,
  useDeleteRestaurant,
} from "@/src/hooks/useScrapeRestaurant";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function AdminRestaurantsScreen() {
  const [url, setUrl] = useState("");
  const { data: restaurants, isLoading, refetch } = useRestaurants();
  const scrape = useScrapeRestaurant();
  const deleteRestaurant = useDeleteRestaurant();
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const onSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!/\/restaurant\/\d+/.test(trimmed)) {
      Alert.alert(
        "Bad URL",
        "Paste a Talabat restaurant URL like https://www.talabat.com/egypt/restaurant/123/slug"
      );
      return;
    }
    try {
      const result = await scrape.mutateAsync({ url: trimmed });
      Alert.alert(
        "Added",
        `${result.restaurantName} — ${result.categoryCount} categories, ${result.itemCount} items.`
      );
      setUrl("");
    } catch (err: any) {
      Alert.alert("Scrape failed", err?.message ?? "Unknown error");
    }
  };

  const onRefreshExisting = (r: Restaurant) => {
    if (!r.url) {
      Alert.alert(
        "No URL saved",
        "This restaurant doesn't have a source URL stored. Re-add it from the input above."
      );
      return;
    }
    Alert.alert(
      "Re-scrape menu",
      `Refresh "${r.name}" from Talabat?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Refresh",
          onPress: async () => {
            try {
              const result = await scrape.mutateAsync({ url: r.url! });
              Alert.alert(
                "Refreshed",
                `${result.restaurantName} — ${result.categoryCount} categories, ${result.itemCount} items.`
              );
            } catch (err: any) {
              Alert.alert("Refresh failed", err?.message ?? "Unknown error");
            }
          },
        },
      ]
    );
  };

  const onDelete = (r: Restaurant) => {
    Alert.alert(
      "Delete restaurant",
      `Remove "${r.name}" from the catalogue? This deletes its menu too.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRestaurant.mutateAsync({ restaurantId: r.id });
            } catch (err: any) {
              Alert.alert("Delete failed", err?.message ?? "Unknown error");
            }
          },
        },
      ]
    );
  };

  const onPullRefresh = async () => {
    setPullRefreshing(true);
    try {
      await refetch();
    } finally {
      setPullRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Restaurants" }} />

      <FlatList
        data={restaurants ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={pullRefreshing} onRefresh={onPullRefresh} />
        }
        ListHeaderComponent={
          <View style={styles.addCard}>
            <Text style={styles.label}>Add a Talabat restaurant</Text>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="https://www.talabat.com/egypt/restaurant/…"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity
              style={[
                styles.button,
                (scrape.isPending || !url.trim()) && styles.buttonDisabled,
              ]}
              onPress={onSubmit}
              disabled={scrape.isPending || !url.trim()}
            >
              {scrape.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Scrape</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.help}>
              Pasting a URL kicks off the server-side scraper. Existing
              restaurants get re-scraped; new ones get added.
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>No restaurants yet</Text>
              <Text style={styles.emptySubtitle}>
                Paste a Talabat URL above to seed the catalogue.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.logo_url ? (
              <Image source={{ uri: item.logo_url }} style={styles.logo} />
            ) : (
              <View
                style={[styles.logo, { backgroundColor: Colors.primaryLight }]}
              >
                <Text style={styles.logoText}>
                  {item.name[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.cuisine && (
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {item.cuisine}
                </Text>
              )}
              <Text style={styles.rowScraped} numberOfLines={1}>
                Last scraped {formatRelative((item as any).last_scraped_at ?? null)}
              </Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => onRefreshExisting(item)}
                disabled={scrape.isPending}
              >
                <Text style={styles.iconBtnText}>↻</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, styles.iconBtnDanger]}
                onPress={() => onDelete(item)}
                disabled={deleteRestaurant.isPending}
              >
                <Text style={styles.iconBtnDangerText}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, gap: Spacing.sm },

  addCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  label: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    minHeight: 40,
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#FFFFFF", fontSize: FontSize.md, fontWeight: "700" },
  help: { fontSize: FontSize.xs, color: Colors.textTertiary },

  centered: { alignItems: "center", padding: Spacing.xl, gap: Spacing.xs },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.text },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logo: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  logoText: { color: "#FFFFFF", fontWeight: "700", fontSize: FontSize.md },
  rowName: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text },
  rowMeta: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  rowScraped: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },

  actions: { flexDirection: "row", gap: 6 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary + "15",
  },
  iconBtnText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: "700" },
  iconBtnDanger: { backgroundColor: Colors.errorLight },
  iconBtnDangerText: { fontSize: FontSize.lg, color: Colors.error, fontWeight: "700", lineHeight: FontSize.lg },
});
