import { Stack } from "expo-router";

export default function GroupDetailLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Group" }} />
      <Stack.Screen name="members" options={{ title: "Members" }} />
      <Stack.Screen name="balances" options={{ title: "Balances" }} />
      <Stack.Screen
        name="orders"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}
