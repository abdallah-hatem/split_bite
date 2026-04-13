-- ============================================
-- SplitBite: Initial Schema
-- ============================================

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated_at trigger function
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- ============================================
-- GROUPS
-- ============================================
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  invite_code text unique not null default encode(gen_random_bytes(5), 'hex'),
  currency text not null default 'EGP',
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger groups_updated_at
  before update on public.groups
  for each row execute function public.update_updated_at();

-- ============================================
-- GROUP MEMBERS
-- ============================================
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  unique(group_id, user_id)
);

-- ============================================
-- GUESTS (temporary participants)
-- ============================================
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  claimed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================
-- ORDERS
-- ============================================
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  status text not null default 'open' check (status in ('open', 'locked', 'finalized', 'settled')),
  created_by uuid not null default auth.uid() references public.profiles(id),
  actual_total numeric(12,2),
  tax numeric(12,2) not null default 0,
  tip numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.update_updated_at();

-- ============================================
-- ORDER PARTICIPANTS
-- ============================================
create table public.order_participants (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references public.profiles(id),
  guest_id uuid references public.guests(id),
  is_included boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (user_id is not null and guest_id is null) or
    (user_id is null and guest_id is not null)
  )
);

create unique index order_participants_user_unique
  on public.order_participants(order_id, user_id)
  where user_id is not null;

create unique index order_participants_guest_unique
  on public.order_participants(order_id, guest_id)
  where guest_id is not null;

-- ============================================
-- ITEMS
-- ============================================
create table public.items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  name text not null,
  price numeric(12,2),
  quantity integer not null default 1,
  is_shared boolean not null default false,
  added_by_participant_id uuid not null references public.order_participants(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================
-- ITEM SHARES
-- ============================================
create table public.item_shares (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  participant_id uuid not null references public.order_participants(id) on delete cascade,
  share_fraction numeric(5,4) not null default 1.0,
  unique(item_id, participant_id)
);

-- ============================================
-- PAYMENTS
-- ============================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  participant_id uuid not null references public.order_participants(id) on delete cascade,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);

-- ============================================
-- LEDGER ENTRIES (persistent debt tracking)
-- ============================================
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id),
  to_user_id uuid not null references public.profiles(id),
  amount numeric(12,2) not null check (amount > 0),
  type text not null check (type in ('order_debt', 'guest_transfer', 'settlement')),
  order_id uuid references public.orders(id),
  description text,
  created_at timestamptz not null default now(),
  check (from_user_id != to_user_id)
);

-- ============================================
-- PUSH TOKENS
-- ============================================
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  created_at timestamptz not null default now(),
  unique(user_id, expo_push_token)
);

-- ============================================
-- GROUP BALANCES VIEW
-- ============================================
create or replace view public.group_balances as
select
  group_id,
  from_user_id,
  to_user_id,
  sum(amount) as total_amount
from public.ledger_entries
group by group_id, from_user_id, to_user_id;

-- ============================================
-- INDEXES
-- ============================================
create index idx_group_members_group on public.group_members(group_id);
create index idx_group_members_user on public.group_members(user_id);
create index idx_guests_group on public.guests(group_id);
create index idx_guests_host on public.guests(host_user_id);
create index idx_orders_group on public.orders(group_id);
create index idx_orders_status on public.orders(status);
create index idx_order_participants_order on public.order_participants(order_id);
create index idx_items_order on public.items(order_id);
create index idx_item_shares_item on public.item_shares(item_id);
create index idx_payments_order on public.payments(order_id);
create index idx_ledger_entries_group on public.ledger_entries(group_id);
create index idx_ledger_entries_from on public.ledger_entries(from_user_id);
create index idx_ledger_entries_to on public.ledger_entries(to_user_id);
