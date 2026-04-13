import { Stack } from "expo-router";

export default function GroupsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Groups" }} />
      <Stack.Screen name="create" options={{ title: "New Group" }} />
      <Stack.Screen name="join" options={{ title: "Join Group" }} />
      <Stack.Screen
        name="[groupId]"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}
