-- Backfill orders.finalized_at for previously-finalized rows whose
-- finalized_at was never populated. The column existed in the initial
-- schema but no code (mutation or trigger) wrote to it, so every
-- finalized order before today carries NULL — which broke date-bounded
-- spending stats queries that did `.gte('finalized_at', since)`.
--
-- For the backfill value, prefer updated_at (most likely the moment the
-- order status was flipped to 'finalized') and fall back to created_at.
--
-- The application code now stamps finalized_at when the status is set to
-- 'finalized', so this migration handles only the historical gap.

update public.orders
   set finalized_at = coalesce(updated_at, created_at)
 where status = 'finalized'
   and finalized_at is null;
