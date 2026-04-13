import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
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
        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
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
  displayName: { fontSize: FontSize.xl, fontWeight: "700", color: Colors.text, marginBottom: Spacing.xs },
  email: { fontSize: FontSize.sm, color: Colors.textSecondary },
  spacer: { flex: 1 },
  signOutButton: { backgroundColor: Colors.errorLight, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: "center", marginBottom: Spacing.lg },
  signOutText: { color: Colors.error, fontSize: FontSize.md, fontWeight: "600" },
});
