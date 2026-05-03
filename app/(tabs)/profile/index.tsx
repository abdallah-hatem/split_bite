import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import { useAuth } from "@/src/providers/AuthProvider";
import { supabase } from "@/src/lib/supabase";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled || !data?.display_name) return;
        setDisplayName(data.display_name);
        setOriginalName(data.display_name);
      } catch {
        // Profile name is non-critical; UI already shows email and avatar.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSave = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      Alert.alert("Error", "Name can't be empty");
      return;
    }

    if (trimmed === originalName) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      // Check if name is taken by anyone in user's groups
      const { data: myGroups } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id);

      if (myGroups && myGroups.length > 0) {
        const groupIds = myGroups.map((g) => g.group_id);

        // Get all member user IDs from those groups (except me)
        const { data: groupMembers } = await supabase
          .from("group_members")
          .select("user_id")
          .in("group_id", groupIds)
          .neq("user_id", user!.id);

        if (groupMembers && groupMembers.length > 0) {
          const memberIds = [...new Set(groupMembers.map((m) => m.user_id))];

          // Check if any of them have this name
          const { data: conflicts } = await supabase
            .from("profiles")
            .select("display_name")
            .in("id", memberIds)
            .ilike("display_name", trimmed);

          if (conflicts && conflicts.length > 0) {
            Alert.alert(
              "Name Taken",
              `"${trimmed}" is already used by someone in your groups. Please choose a different name.`
            );
            setSaving(false);
            return;
          }
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({ display_name: trimmed })
        .eq("id", user!.id);

      if (error) throw error;

      setOriginalName(trimmed);
      setDisplayName(trimmed);
      setEditing(false);
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

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all your data including groups, orders, and balances. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete My Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "All your data will be permanently deleted. You will not be able to recover your account.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete Everything",
                  style: "destructive",
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      const { error } = await supabase.rpc("delete_user_account");
                      if (error) throw error;
                      await signOut();
                    } catch (error: any) {
                      Alert.alert("Error", error.message);
                      setDeleting(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const avatarLetter =
    displayName?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    "?";

  return (
    <View style={styles.container}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarLetter}</Text>
        </View>

        {editing ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.nameInput}
              value={displayName}
              onChangeText={setDisplayName}
              autoFocus
              placeholder="Your name"
              placeholderTextColor={Colors.textTertiary}
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelEditButton}
                onPress={() => {
                  setDisplayName(originalName);
                  setEditing(false);
                }}
              >
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={styles.displayName}>
              {displayName || "Set your name"}
            </Text>
            <Text style={styles.editHint}>Tap to edit</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.spacer} />

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteAccountButton}
        onPress={handleDeleteAccount}
        disabled={deleting}
      >
        <Text style={styles.deleteAccountText}>
          {deleting ? "Deleting..." : "Delete Account"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  avatarSection: { alignItems: "center", marginTop: Spacing.lg, marginBottom: Spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center", marginBottom: Spacing.sm },
  avatarText: { color: "#FFFFFF", fontSize: FontSize.xxxl, fontWeight: "700" },
  displayName: { fontSize: FontSize.xl, fontWeight: "700", color: Colors.text, textAlign: "center" },
  editHint: { fontSize: FontSize.xs, color: Colors.primary, textAlign: "center", marginTop: 2 },
  email: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
  editRow: { width: "100%", paddingHorizontal: Spacing.lg },
  nameInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.lg, color: Colors.text, textAlign: "center" },
  editActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  cancelEditButton: { flex: 1, padding: Spacing.sm, alignItems: "center", borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceSecondary },
  cancelEditText: { color: Colors.textSecondary, fontWeight: "600" },
  saveButton: { flex: 1, padding: Spacing.sm, alignItems: "center", borderRadius: BorderRadius.md, backgroundColor: Colors.primary },
  saveButtonText: { color: "#FFFFFF", fontWeight: "600" },
  spacer: { flex: 1 },
  signOutButton: { backgroundColor: Colors.errorLight, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center", marginBottom: Spacing.lg },
  signOutText: { color: Colors.error, fontSize: FontSize.md, fontWeight: "600" },
  deleteAccountButton: { borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center", marginBottom: Spacing.xl },
  deleteAccountText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: "500" },
});
