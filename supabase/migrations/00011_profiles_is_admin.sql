-- Mark certain users as admins so the in-app "scrape a restaurant" tool can
-- gate its UI + Edge Function authorization on a single boolean.
--
-- After this migration, manually flip is_admin = true for whoever should be
-- able to add restaurants:
--
--   update public.profiles set is_admin = true
--    where id = (select id from auth.users where email = 'YOUR_EMAIL');

alter table public.profiles
  add column is_admin boolean not null default false;

-- Allow any authenticated user to read the is_admin flag from any profile
-- they can already see (existing profile select policy covers this). No new
-- write policy — promotion happens out-of-band.
