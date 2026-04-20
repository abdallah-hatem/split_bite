import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/AuthProvider";

export type LedgerEntry = {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  type: "order_debt" | "guest_transfer" | "settlement";
  order_id: string | null;
  description: string | null;
  created_at: string;
  from_profile: { display_name: string } | null;
  to_profile: { display_name: string } | null;
  group: { name: string } | null;
  order: { title: string } | null;
};

const ACTIVITY_PAGE_SIZE = 15;

export function useActivityFeed() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["activity", user?.id],
    enabled: !!user,
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select(
          "*, from_profile:from_user_id(display_name), to_profile:to_user_id(display_name), group:group_id(name), order:order_id(title)"
        )
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + ACTIVITY_PAGE_SIZE - 1);

      if (error) throw error;
      return data as unknown as LedgerEntry[];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < ACTIVITY_PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
  });
}
