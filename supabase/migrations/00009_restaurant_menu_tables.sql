-- Restaurant + menu tables for the "Pick from menu" feature.
--
-- Designed source-agnostic: future data sources ('manual', 'foursquare', ...)
-- drop in without schema changes. Talabat is just the first 'external_source'.
--
-- See split_bite_docs/01-requirements/2026-05-18-restaurant-menu-scraping-design.md
--
-- RLS: any authenticated user can SELECT all three tables (browsing the menu
-- picker). No INSERT / UPDATE / DELETE policies exist, so only the
-- service-role key (used by the scraper) can mutate. Mutations from the app
-- using the anon/authenticated keys will be silently blocked by RLS — intended.

-- ============================================
-- RESTAURANTS
-- ============================================
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  external_source text not null default 'talabat',
  external_id text not null,
  name text not null,
  slug text,
  url text,
  cuisine text,
  currency text not null default 'EGP',
  image_url text,
  logo_url text,
  last_scraped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_source, external_id)
);

create index idx_restaurants_name on public.restaurants (name);

create trigger restaurants_updated_at
  before update on public.restaurants
  for each row execute function public.update_updated_at();

-- ============================================
-- MENU CATEGORIES
-- ============================================
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  external_id text,
  name text not null,
  display_order integer not null default 0,
  unique (restaurant_id, external_id)
);

create index idx_menu_categories_restaurant
  on public.menu_categories (restaurant_id, display_order);

-- ============================================
-- MENU ITEMS
-- ============================================
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  external_id text,
  name text not null,
  description text,
  price numeric(10,2) not null,
  image_url text,
  is_available boolean not null default true,
  display_order integer not null default 0,
  unique (category_id, external_id)
);

create index idx_menu_items_category
  on public.menu_items (category_id, display_order);

-- ============================================
-- RLS
-- ============================================
alter table public.restaurants enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;

-- Any signed-in user can browse the menu catalogue.
create policy "restaurants_select" on public.restaurants
  for select to authenticated using (true);

create policy "menu_categories_select" on public.menu_categories
  for select to authenticated using (true);

create policy "menu_items_select" on public.menu_items
  for select to authenticated using (true);

-- Intentionally no write policies — scraper holds service-role key.
