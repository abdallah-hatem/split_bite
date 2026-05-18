-- Allow menu_items.price to be null for "Price on Selection" items.
--
-- Talabat marks items with variable pricing (where the price depends on
-- options the user picks at checkout — e.g. "Shawerma Meal" with size +
-- side options) using price = 0 + hasChoices = true. We previously stored
-- those as price 0, which made them appear free in the picker.
--
-- After this migration, the scraper writes null for those items; the UI
-- renders "Price varies" and the user enters the actual price when picking
-- the item into an order.

alter table public.menu_items
  alter column price drop not null;
