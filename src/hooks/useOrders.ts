import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/AuthProvider";
import { notifyOrderCreated } from "@/src/utils/notifications";
import { clearDraft as clearFinalizeDraft } from "@/src/utils/finalizeDraftStore";
import {
  isParticipantEntangled,
  EntanglementItem,
} from "@/src/utils/orderEntanglement";

export type Order = {
  id: string;
  group_id: string;
  title: string;
  status: "open" | "locked" | "finalized" | "settled";
  created_by: string;
  actual_total: number | null;
  tax: number;
  vat: number;
  delivery: number;
  discount: number;
  created_at: string;
  finalized_at: string | null;
  restaurant_id: string | null;
  restaurant?: {
    id: string;
    name: string;
    logo_url: string | null;
    image_url: string | null;
    cuisine: string | null;
    currency: string;
  } | null;
};

export type OrderParticipant = {
  id: string;
  order_id: string;
  user_id: string | null;
  guest_id: string | null;
  is_included: boolean;
  profiles?: { display_name: string; avatar_url: string | null };
  guests?: { name: string };
};

export type Item = {
  id: string;
  order_id: string;
  name: string;
  price: number | null;
  quantity: number;
  is_shared: boolean;
  added_by_participant_id: string;
  created_at: string;
};

export type ItemShare = {
  id: string;
  item_id: string;
  participant_id: string;
  share_fraction: number;
};

export const orderKeys = {
  all: (groupId: string) => ["orders", { groupId }] as const,
  detail: (id: string) => ["orders", id] as const,
  participants: (id: string) => ["orders", id, "participants"] as const,
  items: (id: string) => ["orders", id, "items"] as const,
};

const PAGE_SIZE = 10;

export function useOrders(groupId: string) {
  return useInfiniteQuery({
    queryKey: orderKeys.all(groupId),
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (error) throw error;
      return data as Order[];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    enabled: !!groupId,
  });
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, restaurant:restaurant_id(id, name, logo_url, image_url, cuisine, currency)"
        )
        .eq("id", orderId)
        .single();

      if (error) throw error;
      return data as unknown as Order;
    },
    enabled: !!orderId,
  });
}

export function useOrderParticipants(orderId: string) {
  return useQuery({
    queryKey: orderKeys.participants(orderId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_participants")
        .select(
          "id, order_id, user_id, guest_id, is_included, profiles:user_id(display_name, avatar_url), guests:guest_id(name, host_user_id)"
        )
        .eq("order_id", orderId);

      if (error) throw error;
      return data as unknown as OrderParticipant[];
    },
    enabled: !!orderId,
  });
}

export type ItemWithShares = Item & {
  item_shares: {
    participant_id: string;
    share_fraction: number;
  }[];
  added_by: OrderParticipant | null;
};

export function useOrderItems(orderId: string) {
  return useQuery({
    queryKey: orderKeys.items(orderId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select(
          "*, item_shares(participant_id, share_fraction), added_by:added_by_participant_id(id, user_id, guest_id, profiles:user_id(display_name), guests:guest_id(name))"
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as unknown as ItemWithShares[];
    },
    enabled: !!orderId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      groupId,
      title,
      restaurantId,
    }: {
      groupId: string;
      title: string;
      restaurantId?: string | null;
    }) => {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          group_id: groupId,
          title,
          ...(restaurantId ? { restaurant_id: restaurantId } : {}),
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Auto-add creator as participant
      const { error: participantError } = await supabase
        .from("order_participants")
        .insert({ order_id: order.id, user_id: user!.id });

      if (participantError) throw participantError;

      return order as Order;
    },
    onSuccess: async (order) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.all(order.group_id),
      });

      // Send push notification to group members
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user!.id)
        .single();

      try {
        await notifyOrderCreated(
          order.group_id,
          order.title,
          profile?.display_name ?? "Someone",
          user!.id
        );
      } catch (e) {
        console.warn("[Notifications] Error in onSuccess:", e);
      }
    },
  });
}

export function useAddItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      name,
      price,
      quantity,
      isShared,
      participantId,
      sharedWith,
      customWeights,
    }: {
      orderId: string;
      name: string;
      price: number | null;
      quantity: number;
      isShared: boolean;
      participantId: string;
      sharedWith?: string[]; // participant IDs to split equally
      customWeights?: { participantId: string; weight: number }[]; // overrides sharedWith for non-equal splits
    }) => {
      const { data: item, error: itemError } = await supabase
        .from("items")
        .insert({
          order_id: orderId,
          name,
          price,
          quantity,
          is_shared: isShared,
          added_by_participant_id: participantId,
        })
        .select()
        .single();

      if (itemError) throw itemError;

      let shares: { item_id: string; participant_id: string; share_fraction: number }[];

      if (customWeights && customWeights.length > 0) {
        // Non-equal split: normalise weights → fractions summing to 1.0
        const totalWeight = customWeights.reduce((s, w) => s + w.weight, 0);
        if (totalWeight <= 0) {
          throw new Error("Total weight must be greater than zero");
        }
        shares = customWeights.map((w) => ({
          item_id: item.id,
          participant_id: w.participantId,
          share_fraction: w.weight / totalWeight,
        }));
      } else {
        // Equal split (existing behaviour)
        const shareParticipants = sharedWith?.length
          ? sharedWith
          : [participantId];
        const fraction = 1 / shareParticipants.length;
        shares = shareParticipants.map((pid) => ({
          item_id: item.id,
          participant_id: pid,
          share_fraction: fraction,
        }));
      }

      const { error: sharesError } = await supabase
        .from("item_shares")
        .insert(shares);

      if (sharesError) throw sharesError;

      return item as Item;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.items(variables.orderId),
      });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      orderId,
    }: {
      itemId: string;
      orderId: string;
    }) => {
      const { error } = await supabase
        .from("items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.items(variables.orderId),
      });
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      orderId,
      name,
      price,
    }: {
      itemId: string;
      orderId: string;
      name: string;
      price: number | null;
    }) => {
      const { error } = await supabase
        .from("items")
        .update({ name, price })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.items(variables.orderId),
      });
    },
  });
}

export function useAddGuest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      orderId,
      groupId,
      guestName,
    }: {
      orderId: string;
      groupId: string;
      guestName: string;
    }) => {
      const { data: guest, error: guestError } = await supabase
        .from("guests")
        .insert({
          name: guestName,
          host_user_id: user!.id,
          group_id: groupId,
        })
        .select()
        .single();

      if (guestError) throw guestError;

      const { data: participant, error: participantError } = await supabase
        .from("order_participants")
        .insert({ order_id: orderId, guest_id: guest.id })
        .select()
        .single();

      if (participantError) throw participantError;

      return { guest, participant };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.participants(variables.orderId),
      });
    },
  });
}

/**
 * Internal: query the order's items + shares for the given participant, then
 * run the pure entanglement check. Throws an Error with a user-facing message
 * if the participant is entangled and can't be removed cleanly.
 */
async function assertNotEntangled(
  orderId: string,
  participantId: string,
  failureMessage: string
): Promise<void> {
  const { data, error } = await supabase
    .from("items")
    .select("added_by_participant_id, item_shares(participant_id)")
    .eq("order_id", orderId);

  if (error) throw error;

  if (isParticipantEntangled((data ?? []) as EntanglementItem[], participantId)) {
    throw new Error(failureMessage);
  }
}

/**
 * Leave an order yourself. Caller passes the participant_id row that
 * belongs to them (looked up in the screen). Allowed only when the order
 * is `open`; the UI doesn't render the button otherwise.
 */
export function useLeaveOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      participantId,
    }: {
      orderId: string;
      participantId: string;
    }) => {
      await assertNotEntangled(
        orderId,
        participantId,
        "You can't leave this order while you're sharing items with others. " +
          "Delete those items first, or ask the order creator to remove your share."
      );

      const { error } = await supabase
        .from("order_participants")
        .delete()
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.participants(variables.orderId),
      });
      queryClient.invalidateQueries({
        queryKey: orderKeys.items(variables.orderId),
      });
    },
  });
}

/**
 * Remove someone else from the order. The RLS policy restricts this to the
 * order creator. The UI also gates the affordance.
 *
 * `targetName` is purely for the error message — passes through so the alert
 * reads "Can't remove Yara …" instead of a generic message.
 */
export function useRemoveParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      participantId,
      targetName,
    }: {
      orderId: string;
      participantId: string;
      targetName: string;
    }) => {
      await assertNotEntangled(
        orderId,
        participantId,
        `Can't remove ${targetName} — they're sharing items with others. ` +
          "Delete or update those items first."
      );

      const { error } = await supabase
        .from("order_participants")
        .delete()
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.participants(variables.orderId),
      });
      queryClient.invalidateQueries({
        queryKey: orderKeys.items(variables.orderId),
      });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      groupId,
    }: {
      orderId: string;
      groupId: string;
    }) => {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (error) throw error;
      // Drop any local finalize draft tied to this order.
      await clearFinalizeDraft(orderId);
      return { groupId };
    },
    onSuccess: ({ groupId }) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.all(groupId),
      });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: Order["status"];
    }) => {
      // Stamp finalized_at when transitioning to 'finalized' so spending-stats
      // queries can filter by date. The schema had the column from day one
      // but nothing was populating it.
      const update: Record<string, unknown> = { status };
      if (status === "finalized") {
        update.finalized_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("orders")
        .update(update)
        .eq("id", orderId)
        .select()
        .single();

      if (error) throw error;
      // If the host reopened a finalized order (back to 'open'), drop the
      // stale pre-finalize draft so the next finalize visit starts from the
      // current DB state, not a 30-day-old form snapshot.
      if (status === "open") {
        await clearFinalizeDraft(orderId);
      }
      return data as Order;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.detail(order.id),
      });
      queryClient.invalidateQueries({
        queryKey: orderKeys.all(order.group_id),
      });
    },
  });
}
