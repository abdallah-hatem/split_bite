-- Function to delete a user's account and all associated data
-- Called by the user themselves via RPC
create or replace function public.delete_user_account()
returns void as $$
declare
  uid uuid := auth.uid();
begin
  -- Delete profile (cascades won't cover everything due to RLS)
  delete from public.push_tokens where user_id = uid;
  delete from public.pending_settlements where from_user_id = uid or to_user_id = uid;
  delete from public.ledger_entries where from_user_id = uid or to_user_id = uid;
  delete from public.group_members where user_id = uid;
  delete from public.guests where host_user_id = uid;
  delete from public.profiles where id = uid;

  -- Delete the auth user
  delete from auth.users where id = uid;
end;
$$ language plpgsql security definer;
