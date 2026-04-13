-- ============================================
-- SplitBite: Row Level Security Policies
-- ============================================

-- Helper function to check group membership without triggering RLS recursion
create or replace function public.is_group_member(p_group_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.guests enable row level security;
alter table public.orders enable row level security;
alter table public.order_participants enable row level security;
alter table public.items enable row level security;
alter table public.item_shares enable row level security;
alter table public.payments enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.push_tokens enable row level security;

-- ============================================
-- PROFILES
-- ============================================
-- Anyone authenticated can read profiles (for display names/avatars)
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (true);

-- Users can only update their own profile
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================
-- GROUPS
-- ============================================
-- Members can read their groups
-- Members and creators can read full group data; anyone can look up by invite_code (for joining)
create policy "groups_select" on public.groups
  for select to authenticated
  using (true);

-- Any authenticated user can create a group
create policy "groups_insert" on public.groups
  for insert to authenticated
  with check (created_by = auth.uid());

-- Only group admins can update
create policy "groups_update" on public.groups
  for update to authenticated
  using (
    exists (
      select 1 from public.group_members
      where group_id = groups.id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

-- ============================================
-- GROUP MEMBERS
-- ============================================
-- Members can see fellow group members
create policy "group_members_select" on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id));

-- Any authenticated user can insert (join a group)
create policy "group_members_insert" on public.group_members
  for insert to authenticated
  with check (user_id = auth.uid());

-- Admins can kick, users can leave
create policy "group_members_delete" on public.group_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );

-- ============================================
-- GUESTS
-- ============================================
-- Group members can see guests in their groups
create policy "guests_select" on public.guests
  for select to authenticated
  using (public.is_group_member(group_id));

-- Group members can create guests
create policy "guests_insert" on public.guests
  for insert to authenticated
  with check (
    host_user_id = auth.uid()
    and public.is_group_member(group_id)
  );

-- Host can update their guests
create policy "guests_update" on public.guests
  for update to authenticated
  using (host_user_id = auth.uid())
  with check (host_user_id = auth.uid());

-- ============================================
-- ORDERS
-- ============================================
-- Group members can read orders in their groups
create policy "orders_select" on public.orders
  for select to authenticated
  using (public.is_group_member(group_id));

-- Group members can create orders
create policy "orders_insert" on public.orders
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_group_member(group_id)
  );

-- Order creator can update (lock, finalize, etc.)
create policy "orders_update" on public.orders
  for update to authenticated
  using (created_by = auth.uid());

-- Order creator can delete open orders
create policy "orders_delete" on public.orders
  for delete to authenticated
  using (created_by = auth.uid() and status in ('open', 'locked'));

-- ============================================
-- ORDER PARTICIPANTS
-- ============================================
-- Group members can see participants
create policy "order_participants_select" on public.order_participants
  for select to authenticated
  using (
    order_id in (
      select o.id from public.orders o
      where public.is_group_member(o.group_id)
    )
  );

-- Group members can add themselves or guests as participants
create policy "order_participants_insert" on public.order_participants
  for insert to authenticated
  with check (
    order_id in (
      select o.id from public.orders o
      where public.is_group_member(o.group_id)
    )
  );

-- Order creator can update participants (toggle inclusion)
create policy "order_participants_update" on public.order_participants
  for update to authenticated
  using (
    order_id in (
      select id from public.orders where created_by = auth.uid()
    )
  );

-- ============================================
-- ITEMS
-- ============================================
-- Participants can see items
create policy "items_select" on public.items
  for select to authenticated
  using (
    order_id in (
      select o.id from public.orders o
      where public.is_group_member(o.group_id)
    )
  );

-- Participants can add items when order is open
create policy "items_insert" on public.items
  for insert to authenticated
  with check (
    order_id in (
      select o.id from public.orders o
      where public.is_group_member(o.group_id)
        and o.status = 'open'
    )
  );

-- Item adder or order creator can update items
create policy "items_update" on public.items
  for update to authenticated
  using (
    order_id in (
      select id from public.orders where created_by = auth.uid()
    )
  );

-- Item adder or order creator can delete items
create policy "items_delete" on public.items
  for delete to authenticated
  using (
    order_id in (
      select o.id from public.orders o
      where o.created_by = auth.uid() and o.status in ('open', 'locked')
    )
  );

-- ============================================
-- ITEM SHARES
-- ============================================
create policy "item_shares_select" on public.item_shares
  for select to authenticated
  using (
    item_id in (
      select i.id from public.items i
      join public.orders o on o.id = i.order_id
      where public.is_group_member(o.group_id)
    )
  );

create policy "item_shares_insert" on public.item_shares
  for insert to authenticated
  with check (
    item_id in (
      select i.id from public.items i
      join public.orders o on o.id = i.order_id
      where public.is_group_member(o.group_id)
        and o.status = 'open'
    )
  );

create policy "item_shares_update" on public.item_shares
  for update to authenticated
  using (
    item_id in (
      select i.id from public.items i
      join public.orders o on o.id = i.order_id
      where o.created_by = auth.uid()
    )
  );

create policy "item_shares_delete" on public.item_shares
  for delete to authenticated
  using (
    item_id in (
      select i.id from public.items i
      join public.orders o on o.id = i.order_id
      where o.created_by = auth.uid()
    )
  );

-- ============================================
-- PAYMENTS
-- ============================================
create policy "payments_select" on public.payments
  for select to authenticated
  using (
    order_id in (
      select o.id from public.orders o
      where public.is_group_member(o.group_id)
    )
  );

-- Order creator can manage payments
create policy "payments_insert" on public.payments
  for insert to authenticated
  with check (
    order_id in (
      select id from public.orders
      where created_by = auth.uid()
      and status in ('locked', 'finalized')
    )
  );

create policy "payments_update" on public.payments
  for update to authenticated
  using (
    order_id in (
      select id from public.orders where created_by = auth.uid()
    )
  );

create policy "payments_delete" on public.payments
  for delete to authenticated
  using (
    order_id in (
      select id from public.orders where created_by = auth.uid()
    )
  );

-- ============================================
-- LEDGER ENTRIES
-- ============================================
-- Group members can read ledger entries
create policy "ledger_entries_select" on public.ledger_entries
  for select to authenticated
  using (public.is_group_member(group_id));

-- Settlement entries are inserted by authenticated users involved
create policy "ledger_entries_insert_settlement" on public.ledger_entries
  for insert to authenticated
  with check (
    type = 'settlement'
    and (from_user_id = auth.uid() or to_user_id = auth.uid())
    and public.is_group_member(group_id)
  );

-- ============================================
-- PUSH TOKENS
-- ============================================
create policy "push_tokens_select" on public.push_tokens
  for select to authenticated
  using (user_id = auth.uid());

create policy "push_tokens_insert" on public.push_tokens
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "push_tokens_delete" on public.push_tokens
  for delete to authenticated
  using (user_id = auth.uid());
