-- Fix: ensure created_by defaults to auth.uid() on cloud
-- This was missed on the initial cloud migration.

alter table public.groups
  alter column created_by set default auth.uid();

alter table public.orders
  alter column created_by set default auth.uid();
