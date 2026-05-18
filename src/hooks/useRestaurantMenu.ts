import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  /** null = "Price on Selection" — Talabat couldn't quote a base price. */
  price: number | null;
  image_url: string | null;
  display_order: number;
};

export type MenuCategory = {
  id: string;
  name: string;
  display_order: number;
  menu_items: MenuItem[];
};

/**
 * Fetch a restaurant's menu as nested categories → items, ordered by the
 * scraper-assigned display_order. Returns categories with non-empty items
 * only.
 */
export function useRestaurantMenu(restaurantId: string | null | undefined) {
  return useQuery({
    queryKey: ["restaurant-menu", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select(
          `id, name, display_order,
           menu_items(id, name, description, price, image_url, display_order)`
        )
        .eq("restaurant_id", restaurantId)
        .order("display_order", { ascending: true });
      if (error) throw error;

      const categories = ((data ?? []) as unknown as MenuCategory[]).map(
        (c) => ({
          ...c,
          menu_items: [...(c.menu_items ?? [])].sort(
            (a, b) => a.display_order - b.display_order
          ),
        })
      );
      return categories.filter((c) => c.menu_items.length > 0);
    },
  });
}
