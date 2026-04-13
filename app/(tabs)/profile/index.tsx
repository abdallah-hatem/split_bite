import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "@/src/providers/AuthProvider";
import { supabase } from "@/src/lib/supabase";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    if (data) {
      setDisplayName(data.display_name);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert("Error", "Display name can't be empty");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() })
        .eq("id", user!.id);

      if (error) throw error;
      setDirty(false);
      Alert.alert("Saved", "Your profile has been updated");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName?.[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={(v) => {
            setDisplayName(v);
            setDirty(true);
          }}
          placeholder="Your name"
          placeholderTextColor={Colors.textTertiary}
        />

        {dirty && (
          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.spacer} />

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  avatarSection: { alignItems: "center", marginTop: Spacing.lg, marginBottom: Spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center", marginBottom: Spacing.sm },
  avatarText: { color: "#FFFFFF", fontSize: FontSize.xxxl, fontWeight: "700" },
  email: { fontSize: FontSize.sm, color: Colors.textSecondary },
  form: { gap: Spacing.xs },
  label: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.text },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.text },
  saveButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center", marginTop: Spacing.sm },
  saveButtonText: { color: "#FFFFFF", fontSize: FontSize.md, fontWeight: "600" },
  spacer: { flex: 1 },
  signOutButton: { backgroundColor: Colors.errorLight, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center", marginBottom: Spacing.lg },
  signOutText: { color: Colors.error, fontSize: FontSize.md, fontWeight: "600" },
});
