import { Stack } from "expo-router";

export default function OrdersLayout() {
  return (
    <Stack>
      <Stack.Screen name="create" options={{ title: "New Order" }} />
      <Stack.Screen name="[orderId]" options={{ headerShown: false }} />
    </Stack>
  );
}
