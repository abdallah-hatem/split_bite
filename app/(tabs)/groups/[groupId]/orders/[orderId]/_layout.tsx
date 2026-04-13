import { Stack } from "expo-router";

export default function OrderDetailLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Order" }} />
      <Stack.Screen name="finalize" options={{ title: "Finalize Bill" }} />
      <Stack.Screen name="summary" options={{ title: "Summary" }} />
    </Stack>
  );
}
