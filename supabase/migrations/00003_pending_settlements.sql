-- ============================================
-- PENDING SETTLEMENTS (require beneficiary confirmation)
-- ============================================
create table public.pending_settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id),
  to_user_id uuid not null references public.profiles(id),
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (from_user_id != to_user_id)
);

-- RLS
alter table public.pending_settlements enable row level security;

-- Both parties can see their settlements
create policy "pending_settlements_select" on public.pending_settlements
  for select to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid());

-- The payer can create a pending settlement
create policy "pending_settlements_insert" on public.pending_settlements
  for insert to authenticated
  with check (from_user_id = auth.uid());

-- The beneficiary can update (confirm/reject)
create policy "pending_settlements_update" on public.pending_settlements
  for update to authenticated
  using (to_user_id = auth.uid());

create index idx_pending_settlements_from on public.pending_settlements(from_user_id);
create index idx_pending_settlements_to on public.pending_settlements(to_user_id);
create index idx_pending_settlements_status on public.pending_settlements(status);
