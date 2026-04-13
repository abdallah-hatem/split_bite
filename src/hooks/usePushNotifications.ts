import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/AuthProvider";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission denied");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const projectId =
    require("expo-constants").default?.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: projectId ?? undefined,
  });
  return tokenData.data;
}

function handleNotificationTap(data?: Record<string, unknown>) {
  if (!data) return;
  const type = data?.type;
  const groupId = data?.groupId;

  const orderId = data?.orderId;

  switch (type) {
    case "order_created":
      if (groupId) {
        router.push(`/(tabs)/groups/${groupId}` as any);
      }
      break;
    case "order_finalized":
      if (groupId && orderId) {
        router.push(
          `/(tabs)/groups/${groupId}/orders/${orderId}/summary` as any
        );
      } else if (groupId) {
        router.push(`/(tabs)/groups/${groupId}` as any);
      }
      break;
    case "settlement":
      router.push("/(tabs)/activity" as any);
      break;
    default:
      router.push("/(tabs)/groups" as any);
      break;
  }
}

export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Register token
    registerForPushNotifications()
      .then(async (token) => {
        if (!token) return;

        await supabase.from("push_tokens").upsert(
          { user_id: user.id, expo_push_token: token },
          { onConflict: "user_id,expo_push_token" }
        );
      })
      .catch((err) => {
        console.log("Push notification setup skipped:", err.message);
      });

    // Handle notification tap when app is in foreground/background
    const responseSub =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        handleNotificationTap(data);
      });

    return () => {
      responseSub.remove();
    };
  }, [user]);

  // Handle notification that opened the app from killed state
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        handleNotificationTap(data);
      }
    });
  }, []);
}
