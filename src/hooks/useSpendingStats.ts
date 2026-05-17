import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/AuthProvider";
import {
  aggregateSpendingStats,
  SpendingStats,
  StatsOrder,
} from "@/src/utils/spendingStats";

/**
 * Fetches every finalized order the user is a participant in, finalized
 * within `daysBack` days (use `Infinity` for "all time"), and aggregates
 * spending stats client-side via the calc engine.
 *
 * RLS already restricts the query to orders in groups the user is a member
 * of, so the result set is naturally bounded.
 */
export function useSpendingStats(daysBack: number) {
  const { user } = useAuth();

  return useQuery<SpendingStats>({
    queryKey: ["spending-stats", user?.id, daysBack],
    enabled: !!user,
    queryFn: async () => {
      const sinceMs =
        Number.isFinite(daysBack) && daysBack > 0
          ? Date.now() - daysBack * 24 * 60 * 60 * 1000
          : null;

      // Fetch all my finalized orders, then filter by effective date in JS.
      // Many existing rows have NULL finalized_at (the column existed but
      // was never populated before today's fix) — fall back to updated_at /
      // created_at so old orders show up in the date-bounded views too.
      const { data, error } = await supabase
        .from("orders")
        .select(
          `id, title, finalized_at, updated_at, created_at,
           actual_total, tax, vat, delivery, discount,
           group:group_id(id, name),
           items(id, name, price, quantity, added_by_participant_id,
                 item_shares(participant_id, share_fraction)),
           order_participants(id, user_id, guest_id),
           payments(participant_id, amount)`
        )
        .eq("status", "finalized")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const inRange = ((data ?? []) as any[]).filter((o) => {
        if (sinceMs === null) return true;
        const iso = o.finalized_at ?? o.updated_at ?? o.created_at;
        if (!iso) return false;
        return new Date(iso).getTime() >= sinceMs;
      });

      // Keep only orders where the current user is a participant.
      const mine = (inRange as unknown as StatsOrder[]).filter((o) =>
        o.order_participants.some((p) => p.user_id === user!.id)
      );

      return aggregateSpendingStats(mine, user!.id);
    },
  });
}
