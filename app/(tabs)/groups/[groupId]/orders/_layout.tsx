import { Stack } from "expo-router";

export default function OrdersLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerTintColor: "#111827",
      }}
    >
      <Stack.Screen name="create" options={{ title: "New Order" }} />
      <Stack.Screen name="[orderId]" options={{ headerShown: false }} />
    </Stack>
  );
}
