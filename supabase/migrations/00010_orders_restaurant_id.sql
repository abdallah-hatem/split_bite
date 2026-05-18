-- Tie orders to a restaurant (optional).
--
-- When set, the order is "restaurant-tied" — the UI restricts item entry to
-- that restaurant's scraped menu, hides free-text item input, and shows the
-- restaurant context in the order header.
--
-- When NULL, the order is "free-form" — the existing behaviour. All existing
-- orders default to NULL on this migration.
--
-- ON DELETE SET NULL: if a restaurant row is removed, orders that referenced
-- it gracefully degrade to free-form rather than being deleted with it.

alter table public.orders
  add column restaurant_id uuid references public.restaurants(id) on delete set null;

create index idx_orders_restaurant_id on public.orders (restaurant_id);
