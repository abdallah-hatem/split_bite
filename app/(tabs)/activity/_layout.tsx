import { Stack } from "expo-router";

export default function ActivityLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerTintColor: "#111827",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Activity" }} />
    </Stack>
  );
}
