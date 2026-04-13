import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";

export type Payment = {
  id: string;
  order_id: string;
  participant_id: string;
  amount: number;
  created_at: string;
};

export function usePayments(orderId: string) {
  return useQuery({
    queryKey: ["payments", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "*, participant:participant_id(id, user_id, guest_id, profiles:user_id(display_name), guests:guest_id(name))"
        )
        .eq("order_id", orderId);

      if (error) throw error;
      return data as any[];
    },
    enabled: !!orderId,
  });
}
