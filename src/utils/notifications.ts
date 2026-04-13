import { supabase } from "@/src/lib/supabase";

type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

/**
 * Send push notification to specific users via Expo Push API
 */
async function sendPushNotifications(
  userIds: string[],
  payload: NotificationPayload
) {
  if (userIds.length === 0) return;

  // Fetch push tokens for these users
  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("expo_push_token")
    .in("user_id", userIds);

  if (!tokens?.length) return;

  const messages = tokens.map((t) => ({
    to: t.expo_push_token,
    sound: "default" as const,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  // Send via Expo Push API
  try {
    console.log(`[Notifications] Sending to ${messages.length} device(s):`, messages.map(m => m.to));
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    const result = await response.json();
    console.log("[Notifications] Response:", JSON.stringify(result));
  } catch (error) {
    console.warn("[Notifications] Failed:", error);
  }
}

/**
 * Notify group members that a new order was created
 */
export async function notifyOrderCreated(
  groupId: string,
  orderTitle: string,
  creatorName: string,
  creatorId: string
) {
  // Get all group members except the creator
  const { data: members, error } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .neq("user_id", creatorId);

  console.log(`[Notifications] notifyOrderCreated: group=${groupId}, creator=${creatorId}, members=${JSON.stringify(members)}, error=${error?.message}`);

  const userIds = (members ?? []).map((m) => m.user_id);

  await sendPushNotifications(userIds, {
    title: "New Order",
    body: `${creatorName} started "${orderTitle}"`,
    data: { type: "order_created", groupId },
  });
}

/**
 * Notify group members that an order was finalized
 */
export async function notifyOrderFinalized(
  groupId: string,
  orderTitle: string,
  finalizerName: string,
  finalizerId: string
) {
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .neq("user_id", finalizerId);

  const userIds = (members ?? []).map((m) => m.user_id);

  await sendPushNotifications(userIds, {
    title: "Order Finalized",
    body: `${finalizerName} finalized "${orderTitle}". Check your split!`,
    data: { type: "order_finalized", groupId },
  });
}

/**
 * Notify a user that someone settled a debt with them
 */
export async function notifySettlement(
  toUserId: string,
  fromName: string,
  amount: number
) {
  await sendPushNotifications([toUserId], {
    title: "Settlement Received",
    body: `${fromName} settled ${amount.toFixed(2)} with you`,
    data: { type: "settlement" },
  });
}
