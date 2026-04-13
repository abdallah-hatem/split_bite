import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useCreateOrder } from "@/src/hooks/useOrders";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

export default function CreateOrder() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [title, setTitle] = useState("");
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
      });
      router.replace(
        `/(tabs)/groups/${groupId}/orders/${order.id}` as any
      );
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>What are you ordering?</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Pizza Night, Lunch at Shake Shack"
        placeholderTextColor={Colors.textTertiary}
        value={title}
        onChangeText={setTitle}
        autoFocus
      />

      <TouchableOpacity
        style={[styles.button, createOrder.isPending && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={createOrder.isPending}
      >
        <Text style={styles.buttonText}>
          {createOrder.isPending ? "Creating..." : "Start Order"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  label: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text, marginBottom: Spacing.sm },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.text },
  button: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center", marginTop: Spacing.xl },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: FontSize.md, fontWeight: "600" },
});
