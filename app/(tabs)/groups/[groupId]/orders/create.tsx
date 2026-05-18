import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useCreateOrder } from "@/src/hooks/useOrders";
import { PickFromMenuSheet } from "@/src/components/orders/PickFromMenuSheet";
import { Restaurant } from "@/src/hooks/useRestaurants";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

export default function CreateOrder() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [showRestaurantPicker, setShowRestaurantPicker] = useState(false);
  const createOrder = useCreateOrder();

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter an order title");
      return;
    }

    try {
      const order = await createOrder.mutateAsync({
        groupId,
        title: title.trim(),
        restaurantId: restaurant?.id ?? null,
      });
      router.replace(`/(tabs)/groups/${groupId}/orders/${order.id}` as any);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>What are you ordering?</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Pizza Night, Lunch at Shake Shack"
        placeholderTextColor={Colors.textTertiary}
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          setTitleEdited(true);
        }}
      />

      <Text style={[styles.label, { marginTop: Spacing.lg }]}>
        Restaurant (optional)
      </Text>
      <Text style={styles.hint}>
        Pick a restaurant and everyone in this order will only be able to add
        items from its menu. Leave blank for a free-form order.
      </Text>

      {restaurant ? (
        <View style={styles.restaurantCard}>
          {restaurant.logo_url ? (
            <Image
              source={{ uri: restaurant.logo_url }}
              style={styles.restaurantLogo}
            />
          ) : (
            <View
              style={[
                styles.restaurantLogo,
                { backgroundColor: Colors.primaryLight },
              ]}
            >
              <Text style={styles.restaurantLogoText}>
                {restaurant.name[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.restaurantName}>{restaurant.name}</Text>
            {restaurant.cuisine && (
              <Text style={styles.restaurantCuisine} numberOfLines={1}>
                {restaurant.cuisine}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setRestaurant(null)}
            style={styles.restaurantClearBtn}
            accessibilityLabel="Clear restaurant"
          >
            <Text style={styles.restaurantClearBtnText}>×</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.pickRestaurantBtn}
          onPress={() => setShowRestaurantPicker(true)}
        >
          <Text style={styles.pickRestaurantBtnText}>+ Pick restaurant</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.button, createOrder.isPending && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={createOrder.isPending}
      >
        <Text style={styles.buttonText}>
          {createOrder.isPending ? "Creating..." : "Start Order"}
        </Text>
      </TouchableOpacity>

      <PickFromMenuSheet
        mode="restaurant"
        visible={showRestaurantPicker}
        onClose={() => setShowRestaurantPicker(false)}
        onPickRestaurant={(r) => {
          setRestaurant(r);
          if (!titleEdited) setTitle(r.name);
          setShowRestaurantPicker(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  label: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text, marginBottom: Spacing.sm },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.sm },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.text },

  pickRestaurantBtn: { borderRadius: BorderRadius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primary + "10", alignItems: "center" },
  pickRestaurantBtnText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: "700" },

  restaurantCard: { flexDirection: "row", alignItems: "center", gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.primary, padding: Spacing.sm },
  restaurantLogo: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  restaurantLogoText: { color: "#FFFFFF", fontWeight: "700", fontSize: FontSize.md },
  restaurantName: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text },
  restaurantCuisine: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  restaurantClearBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surfaceSecondary },
  restaurantClearBtnText: { fontSize: FontSize.lg, color: Colors.textSecondary, lineHeight: FontSize.lg },

  button: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center", marginTop: Spacing.xl },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: FontSize.md, fontWeight: "600" },
});
