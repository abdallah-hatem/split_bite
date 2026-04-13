import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/AuthProvider";
import { notifyOrderCreated } from "@/src/utils/notifications";

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
        .select("*")
        .eq("id", orderId)
        .single();

      if (error) throw error;
      return data as Order;
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
          "id, order_id, user_id, guest_id, is_included, profiles:user_id(display_name, avatar_url), guests:guest_id(name)"
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
    }: {
      groupId: string;
      title: string;
    }) => {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({ group_id: groupId, title })
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

      notifyOrderCreated(
        order.group_id,
        order.title,
        profile?.display_name ?? "Someone",
        user!.id
      );
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
    }: {
      orderId: string;
      name: string;
      price: number | null;
      quantity: number;
      isShared: boolean;
      participantId: string;
      sharedWith?: string[]; // participant IDs to split with
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

      // Create item shares
      const shareParticipants = sharedWith?.length
        ? sharedWith
        : [participantId];
      const fraction = 1 / shareParticipants.length;

      const shares = shareParticipants.map((pid) => ({
        item_id: item.id,
        participant_id: pid,
        share_fraction: fraction,
      }));

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
      const { data, error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId)
        .select()
        .single();

      if (error) throw error;
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
