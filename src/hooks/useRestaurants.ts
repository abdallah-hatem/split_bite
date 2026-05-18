import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";

export type Restaurant = {
  id: string;
  external_source: string;
  external_id: string;
  name: string;
  slug: string | null;
  cuisine: string | null;
  currency: string;
  logo_url: string | null;
  image_url: string | null;
};

/**
 * List restaurants visible to the user. RLS allows any signed-in user to read
 * the full catalogue. Ordered alphabetically by name; client-side filter on
 * the optional search term to avoid an extra round-trip for partial matches.
 */
export function useRestaurants(search?: string) {
  return useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select(
          "id, external_source, external_id, name, slug, cuisine, currency, logo_url, image_url"
        )
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Restaurant[];
    },
    select: (rows) => {
      if (!search?.trim()) return rows;
      const q = search.trim().toLowerCase();
      return rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.cuisine ?? "").toLowerCase().includes(q)
      );
    },
  });
}
