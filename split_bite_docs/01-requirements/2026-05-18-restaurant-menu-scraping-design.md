# Restaurant Menu Scraping — Design

**Status:** Approved (brainstorm 2026-05-18)
**Implements:** Pull menus from specific Talabat URLs into Supabase under a restaurant-agnostic schema, expose a "Pick from menu" affordance in the Add Item flow so users add real items + prices in one tap instead of typing each.

## Risks acknowledged

Already discussed and accepted: Talabat ToS prohibits scraping; Apple's 5.2.2 may reject apps that obviously rip data; selectors / JSON shapes will break over time. Mitigations: admin-curated URLs only (never user-submitted), local script (no production scraper infra), Zod validation fails loud when shape changes, infrequent re-scrapes.

## Schema

Three tables. Restaurant-agnostic so future sources (`'manual'`, `'foursquare'`, etc.) drop in without schema changes.

```sql
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

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  external_id text,
  name text not null,
  display_order integer not null default 0,
  unique (restaurant_id, external_id)
);

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
```

RLS: any signed-in user can `select` all three tables. No write policies → only the service-role key (used by the scraper) can mutate. Adds an `updated_at` trigger on `restaurants` to track refreshes.

## Talabat data shape

Confirmed from inspecting the SSR'd page (`<script id="__NEXT_DATA__">`):

```
data.props.pageProps.initialMenuState
├─ restaurant     { id, name, branchId, restaurantSlug, branchSlug,
│                   heroImage, logo, cuisineString, ... }
├─ menuData       { categories: [
│                     { id, name, items: [{ id, name, description,
│                                          price, image, ... }],
│                       prevItemsCount } ],
│                   items: [...flat list], filteredCategories: [...]  }
└─ currentCountry { currencyISO: "EGP" }
```

Sample (`Gad — branchId 697415`): 26 categories, 276 items.

**Special case:** the first category has `id: -1, name: "Picks for you 🔥"` — a personalized cross-cut. Skipped, not stored.

## Scraper architecture

Local TypeScript script at `scripts/scrape-talabat.ts`. Run as:
```bash
npm run scrape:talabat -- https://www.talabat.com/egypt/restaurant/697415/gad3
```

Pipeline:
1. Parse URL → extract `branchId` (the path segment after `/restaurant/`).
2. `fetch` the page with realistic browser headers (matched the working curl probe — `User-Agent`, `Accept`, `Accept-Language`).
3. Regex-extract `__NEXT_DATA__` script tag, JSON.parse.
4. Validate with Zod: `restaurant`, `menuData.categories[].items[]`, `currentCountry.currencyISO`.
5. Map to our schema. The Talabat `restaurant.branchId` becomes our `external_id`. Categories with `id: -1` are filtered out.
6. Upsert via `supabase-js` with the service-role key:
   - `restaurants` — upsert by `(external_source, external_id)`.
   - `menu_categories` — upsert by `(restaurant_id, external_id)`.
   - `menu_items` — upsert by `(category_id, external_id)`.
7. Stamp `last_scraped_at = now()`. If called again within 6h, refuse unless `--force`.
8. Print a summary: `Restaurant X · N categories · M items · K updated, J inserted`.

**Service-role key handling:**
- Read from `scripts/.env.scraper.local` (gitignored via existing `.env*.local` rule).
- Fallback to `process.env.SUPABASE_URL` and `process.env.SUPABASE_SERVICE_ROLE_KEY`.
- If neither, try shelling `supabase status -o env` (local default).
- Fail with a clear message if all sources are empty.

A committed `scripts/.env.scraper.example` shows the file format.

## App integration

Inside the **Add Item** modal, add a button above the name field:
```
[ + Pick from menu ]
```

Tap → opens a modal sheet:

```
┌─────────────────────────────┐
│ Pick from menu              │
├─────────────────────────────┤
│ 🔍 Search restaurants…      │
│                             │
│ ▸ Gad                       │
│ ▸ Pizza Hut                 │
└─────────────────────────────┘
```

Tap a restaurant → expand category list → tap an item → modal closes, form auto-fills `name` and `price` so the user can adjust before saving.

Two new hooks:

- `useRestaurants(search?)` — `select * from restaurants order by name`. Client-side filters by search term.
- `useRestaurantMenu(restaurantId)` — joined select: `menu_categories(*, menu_items(*))` ordered by `display_order`.

No DB link from `orders` to `restaurants` for MVP. The picker is a shortcut, not a hard reference.

## Files / changes

| File | Change |
|---|---|
| `supabase/migrations/00009_restaurant_menu_tables.sql` | New: three tables + RLS select policies + updated_at trigger on restaurants |
| `scripts/scrape-talabat.ts` | New: the local scraper script |
| `scripts/.env.scraper.example` | New: template for env vars |
| `package.json` | New script `scrape:talabat`; add `zod` to devDependencies, `tsx` to run the TS script |
| `src/hooks/useRestaurants.ts` | New: react-query for restaurant list |
| `src/hooks/useRestaurantMenu.ts` | New: react-query for one restaurant's nested menu |
| `src/components/orders/PickFromMenuSheet.tsx` | New: the picker modal |
| `app/(tabs)/groups/[groupId]/orders/[orderId]/index.tsx` | Add the "Pick from menu" button to AddItemModal; hook up the sheet; pre-fill name/price on selection |

No changes to the calc engine, finalize flow, or any existing feature.

## Test plan

**Local-only for v1**:
1. Apply migration to local Supabase (`supabase migration up`).
2. Run `npm run scrape:talabat -- https://www.talabat.com/egypt/restaurant/697415/gad3` against local.
3. Verify in Supabase Studio: 1 restaurant, ~25 categories, ~275 items, image URLs present.
4. Re-run within 6h → should refuse with `--force` hint.
5. Re-run with `--force` → row counts stable (upserts, no duplicates).
6. In the app (phone pointed at local Supabase per earlier setup), open an order → Add Item → Pick from menu → Gad → pick "Foul With Mixture Sandwich" → form pre-fills name "Foul With Mixture Sandwich" + price 17.10 → save → appears in items list.

Cloud rollout is deferred — user wants local-only validation first.

## Rollout

Two-phase:
1. **Local validation (v1):** migration on local, scraper against local, app pointed at local. No cloud changes.
2. **Cloud (later, after sign-off):** `supabase db push` migration → run scraper against cloud → OTA the app changes (the JS for the picker UI is OTA-eligible; the migration must land first).

No new EAS build needed — all changes are JS or pure SQL.
