import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";

export type ScrapeResult = {
  ok: true;
  restaurantId: string;
  restaurantName: string;
  categoryCount: number;
  itemCount: number;
};

/**
 * Calls the `scrape-talabat` Edge Function. Requires the current user to
 * have profiles.is_admin = true (the function double-checks this).
 *
 * On success, invalidates the restaurants list so the admin screen refreshes.
 */
export function useScrapeRestaurant() {
  const queryClient = useQueryClient();
  return useMutation<ScrapeResult, Error, { url: string }>({
    mutationFn: async ({ url }) => {
      const { data, error } = await supabase.functions.invoke<ScrapeResult>(
        "scrape-talabat",
        { body: { url } }
      );
      if (error) {
        // supabase.functions.invoke wraps the response error; try to extract a
        // useful message from the underlying payload.
        let message = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.text === "function") {
            const body = await ctx.text();
            const parsed = JSON.parse(body);
            if (parsed?.error) message = parsed.error;
          }
        } catch {
          /* fall through */
        }
        throw new Error(message || "Scrape failed");
      }
      if (!data) throw new Error("No response from scraper");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
    },
  });
}

/**
 * Hard-deletes a restaurant + its categories + items via cascade.
 * Admin-only (RLS will block non-admins from a direct delete, but we don't
 * have a delete policy yet — the underlying delete needs the service role).
 * For now this calls a future scrape-talabat-delete function. Stubbed via
 * direct supabase delete here; will fail unless a delete RLS policy exists.
 *
 * Keep this hook so the UI compiles; flip implementation when we add the
 * server-side delete path.
 */
export function useDeleteRestaurant() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { restaurantId: string }>({
    mutationFn: async ({ restaurantId }) => {
      const { error } = await supabase
        .from("restaurants")
        .delete()
        .eq("id", restaurantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
    },
  });
}
