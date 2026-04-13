import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/AuthProvider";
import {
  computeNetBalances,
  optimizeSettlements,
} from "@/src/utils/settlement";

export type PairwiseBalance = {
  userId: string;
  displayName: string;
  net: number; // positive = they owe you, negative = you owe them
};

export const balanceKeys = {
  group: (groupId: string) => ["balances", groupId] as const,
};

export function useGroupBalances(groupId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: balanceKeys.group(groupId),
    queryFn: async () => {
      // Fetch all ledger entries for this group
      const { data: entries, error } = await supabase
        .from("ledger_entries")
        .select("from_user_id, to_user_id, amount")
        .eq("group_id", groupId);

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

      // Fetch profile names for all involved users
      const userIds = new Set<string>();
      for (const s of settlements) {
        userIds.add(s.fromUserId);
        userIds.add(s.toUserId);
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", Array.from(userIds));

      const nameMap = new Map<string, string>();
      for (const p of profiles ?? []) {
        nameMap.set(p.id, p.display_name);
      }

      // Build pairwise balances relative to current user
      const myBalances: PairwiseBalance[] = [];

      for (const s of settlements) {
        if (s.fromUserId === user?.id) {
          // I owe someone
          myBalances.push({
            userId: s.toUserId,
            displayName: nameMap.get(s.toUserId) ?? "Unknown",
            net: -s.amount,
          });
        } else if (s.toUserId === user?.id) {
          // Someone owes me
          myBalances.push({
            userId: s.fromUserId,
            displayName: nameMap.get(s.fromUserId) ?? "Unknown",
            net: s.amount,
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
      const { error } = await supabase.from("ledger_entries").insert({
        group_id: groupId,
        from_user_id: user!.id,
        to_user_id: toUserId,
        amount,
        type: "settlement",
        description: "Manual settlement",
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: balanceKeys.group(variables.groupId),
      });
    },
  });
}
