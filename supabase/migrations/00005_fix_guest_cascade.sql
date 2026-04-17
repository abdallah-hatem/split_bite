-- Fix: add ON DELETE CASCADE to order_participants.guest_id
-- Without this, deleting a group fails because guests are deleted
-- before order_participants that reference them.

alter table public.order_participants
  drop constraint order_participants_guest_id_fkey;

alter table public.order_participants
  add constraint order_participants_guest_id_fkey
  foreign key (guest_id) references public.guests(id) on delete cascade;
