-- Allow a user to delete their own participant row (leave the order),
-- and the order creator to delete any participant row in their order
-- (remove someone from the order).
--
-- Cascades on items.added_by_participant_id and item_shares.participant_id
-- handle cleanup automatically; PostgreSQL cascades bypass RLS so no extra
-- delete policies are needed on items / item_shares for this flow.
--
-- Application-level rules layered on top of this policy (enforced in the UI
-- and mutation handlers):
--   * Only allowed when orders.status = 'open'.
--   * The order creator cannot remove themselves through this policy — they
--     delete the entire order via the existing "Delete Order" flow.
--   * An entanglement check refuses the delete when the target shares items
--     with other participants, so cascades never silently take away other
--     people's items / shares.

create policy "order_participants_delete" on public.order_participants
  for delete to authenticated
  using (
    user_id = auth.uid()
    or order_id in (
      select id from public.orders where created_by = auth.uid()
    )
  );
