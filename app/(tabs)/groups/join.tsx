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
import { useJoinGroup } from "@/src/hooks/useGroups";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

export default function JoinGroup() {
  const [inviteCode, setInviteCode] = useState("");
  const joinGroup = useJoinGroup();

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      Alert.alert("Error", "Please enter an invite code");
      return;
    }

    try {
      const result = await joinGroup.mutateAsync(inviteCode);
      if (result.alreadyMember) {
        Alert.alert("Already a member", "You're already in this group");
      }
      router.replace(`/(tabs)/groups/${result.groupId}`);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join a Group</Text>
      <Text style={styles.subtitle}>Enter the invite code shared with you</Text>

      <TextInput
        style={styles.input}
        placeholder="Invite code"
        placeholderTextColor={Colors.textTertiary}
        value={inviteCode}
        onChangeText={setInviteCode}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[styles.button, joinGroup.isPending && styles.buttonDisabled]}
        onPress={handleJoin}
        disabled={joinGroup.isPending}
      >
        <Text style={styles.buttonText}>
          {joinGroup.isPending ? "Joining..." : "Join Group"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: "700", color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.lg },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.lg, color: Colors.text, textAlign: "center", letterSpacing: 2 },
  button: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center", marginTop: Spacing.xl },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: FontSize.md, fontWeight: "600" },
});
