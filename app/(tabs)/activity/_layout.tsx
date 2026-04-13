import { Stack } from "expo-router";

export default function ActivityLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Activity" }} />
    </Stack>
  );
}
