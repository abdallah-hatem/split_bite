import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/AuthProvider";
import {
  computeNetBalances,
  optimizeSettlements,
} from "@/src/utils/settlement";
import {
  notifySettlement,
  notifySettlementConfirmed,
  notifySettlementRejected,
} from "@/src/utils/notifications";

export type OrderDebt = {
  orderId: string;
  orderTitle: string;
  amount: number;
  type: string;
  date: string;
};

export type PairwiseBalance = {
  userId: string;
  displayName: string;
  net: number; // positive = they owe you, negative = you owe them
  orders: OrderDebt[]; // breakdown by order
};

export const balanceKeys = {
  group: (groupId: string) => ["balances", groupId] as const,
};

export function useGroupBalances(groupId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: balanceKeys.group(groupId),
    queryFn: async () => {
      // Fetch all ledger entries with order details
      const { data: entries, error } = await supabase
        .from("ledger_entries")
        .select("*, order:order_id(id, title)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Compute net balances
      const netBalances = computeNetBalances(
        (entries ?? []).map((e) => ({
          fromUserId: e.from_user_id,
          toUserId: e.to_user_id,
          amount: e.amount,
        }))
      );

      // Compute optimal settlements
      const settlements = optimizeSettlements(netBalances);

      // Fetch profile names
      const userIds = new Set<string>();
      for (const e of entries ?? []) {
        userIds.add(e.from_user_id);
        userIds.add(e.to_user_id);
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", Array.from(userIds));

      const nameMap = new Map<string, string>();
      for (const p of profiles ?? []) {
        nameMap.set(p.id, p.display_name);
      }

      // Build per-user order breakdowns relative to current user
      const userOrderMap = new Map<string, OrderDebt[]>();

      for (const e of entries ?? []) {
        const isFrom = e.from_user_id === user?.id;
        const isTo = e.to_user_id === user?.id;
        if (!isFrom && !isTo) continue;

        const otherUserId = isFrom ? e.to_user_id : e.from_user_id;
        const orderDebt: OrderDebt = {
          orderId: (e.order as any)?.id ?? "",
          orderTitle: (e.order as any)?.title ?? (e.type === "settlement" ? "Settlement" : "Unknown"),
          amount: isFrom ? -e.amount : e.amount, // negative = I owe, positive = they owe me
          type: e.type,
          date: e.created_at,
        };

        if (!userOrderMap.has(otherUserId)) {
          userOrderMap.set(otherUserId, []);
        }
        userOrderMap.get(otherUserId)!.push(orderDebt);
      }

      // Build pairwise balances
      const myBalances: PairwiseBalance[] = [];

      for (const s of settlements) {
        if (s.fromUserId === user?.id) {
          myBalances.push({
            userId: s.toUserId,
            displayName: nameMap.get(s.toUserId) ?? "Unknown",
            net: -s.amount,
            orders: userOrderMap.get(s.toUserId) ?? [],
          });
        } else if (s.toUserId === user?.id) {
          myBalances.push({
            userId: s.fromUserId,
            displayName: nameMap.get(s.fromUserId) ?? "Unknown",
            net: s.amount,
            orders: userOrderMap.get(s.fromUserId) ?? [],
          });
        }
      }

      return {
        myBalances,
        allSettlements: settlements.map((s) => ({
          ...s,
          fromName: nameMap.get(s.fromUserId) ?? "Unknown",
          toName: nameMap.get(s.toUserId) ?? "Unknown",
        })),
      };
    },
    enabled: !!groupId,
  });
}

export function useSettleUp() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      groupId,
      toUserId,
      amount,
    }: {
      groupId: string;
      toUserId: string;
      amount: number;
    }) => {
      // Create pending settlement (needs beneficiary confirmation)
      const { error } = await supabase.from("pending_settlements").insert({
        group_id: groupId,
        from_user_id: user!.id,
        to_user_id: toUserId,
        amount,
      });

      if (error) throw error;

      // Notify beneficiary to confirm
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user!.id)
        .single();

      notifySettlement(
        toUserId,
        profile?.display_name ?? "Someone",
        amount,
        groupId
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: balanceKeys.group(variables.groupId),
      });
      queryClient.invalidateQueries({
        queryKey: ["pending_settlements"],
      });
    },
  });
}

export function usePendingSettlements() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pending_settlements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_settlements")
        .select("*, from_profile:from_user_id(display_name), to_profile:to_user_id(display_name), group:group_id(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });
}

export function useConfirmSettlement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      settlementId,
      groupId,
      fromUserId,
      amount,
      action,
    }: {
      settlementId: string;
      groupId: string;
      fromUserId: string;
      amount: number;
      action: "confirmed" | "rejected";
    }) => {
      // Update pending settlement status
      const { error: updateError } = await supabase
        .from("pending_settlements")
        .update({ status: action, resolved_at: new Date().toISOString() })
        .eq("id", settlementId);

      if (updateError) throw updateError;

      // If confirmed, create the actual ledger entry
      if (action === "confirmed") {
        // Reverse direction: creditor "owes" debtor to cancel original debt
        // Original debt: fromUser → toUser (debtor owes creditor)
        // Settlement:    toUser → fromUser (cancels it out)
        const { error: ledgerError } = await supabase
          .from("ledger_entries")
          .insert({
            group_id: groupId,
            from_user_id: user!.id,
            to_user_id: fromUserId,
            amount,
            type: "settlement",
            description: "Confirmed settlement",
          });

        if (ledgerError) throw ledgerError;
      }

      // Notify the sender of the outcome (confirmed or rejected).
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user!.id)
        .single();
      const actorName = profile?.display_name ?? "Someone";

      if (action === "confirmed") {
        notifySettlementConfirmed(fromUserId, actorName, amount, groupId);
      } else {
        notifySettlementRejected(fromUserId, actorName, amount, groupId);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: balanceKeys.group(variables.groupId),
      });
      queryClient.invalidateQueries({
        queryKey: ["pending_settlements"],
      });
    },
  });
}
