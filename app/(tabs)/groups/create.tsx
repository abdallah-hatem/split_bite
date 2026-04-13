import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useCreateGroup } from "@/src/hooks/useGroups";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

export default function CreateGroup() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createGroup = useCreateGroup();

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a group name");
      return;
    }

    try {
      const group = await createGroup.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
      });
      router.replace(`/(tabs)/groups/${group.id}`);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Group Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Lunch Squad"
        placeholderTextColor={Colors.textTertiary}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="What's this group for?"
        placeholderTextColor={Colors.textTertiary}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity
        style={[styles.button, createGroup.isPending && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={createGroup.isPending}
      >
        <Text style={styles.buttonText}>
          {createGroup.isPending ? "Creating..." : "Create Group"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  label: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.text, marginTop: Spacing.md, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.text },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  button: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center", marginTop: Spacing.xl },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: FontSize.md, fontWeight: "600" },
});
