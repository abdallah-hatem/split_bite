import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/AuthProvider";

/**
 * Returns whether the currently-signed-in user has `profiles.is_admin = true`.
 * Cached for the session; revalidated on focus / refetch.
 */
export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.is_admin === true;
    },
  });

  return { isAdmin: data === true, isLoading };
}
