// Edge Function: scrape-talabat
//
// Admin-only. Fetches a Talabat restaurant URL, parses its __NEXT_DATA__
// blob, and upserts the restaurant + categories + items into our catalogue.
// Mirrors the local-Node `scripts/scrape-talabat.js` but runs in Deno on
// Supabase's edge.
//
// Call from the app via supabase.functions.invoke('scrape-talabat', {
//   body: { url: '<talabat-url>' }
// })
//
// Auth model:
// - Caller's JWT is read from the Authorization header.
// - We use an anon-key client + that JWT to look up the caller and check
//   their profiles.is_admin flag.
// - If admin, a separate service-role client does the upserts (bypassing
//   RLS on the catalogue tables).
//
// Environment:
//   SUPABASE_URL                — auto-populated by Supabase
//   SUPABASE_ANON_KEY           — auto-populated
//   SUPABASE_SERVICE_ROLE_KEY   — auto-populated (Edge Functions get this)
//
// Local dev:
//   supabase functions serve scrape-talabat --env-file supabase/.env.local

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  restaurant: {
    external_id: string;
    name: string;
    slug: string | null;
    cuisine: string | null;
    image_url: string | null;
    logo_url: string | null;
    currency: string;
  };
  categories: {
    external_id: string;
    name: string;
    display_order: number;
    items: {
      external_id: string;
      name: string;
      description: string | null;
      price: number | null;
      image_url: string | null;
      display_order: number;
    }[];
  }[];
};

function parseTalabatUrl(u: string): { branchId: string } {
  const m = u.match(/\/restaurant\/(\d+)/);
  if (!m) throw new Error(`Could not extract branchId from URL: ${u}`);
  return { branchId: m[1] };
}

async function fetchHtml(u: string): Promise<string> {
  const res = await fetch(u, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${u}`);
  return await res.text();
}

function extractNextData(html: string): any {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!m) {
    throw new Error(
      "Could not find __NEXT_DATA__ in the page. Talabat may have changed " +
        "their HTML structure, or the URL returned an error page."
    );
  }
  return JSON.parse(m[1]);
}

function pickPayload(nextData: any, url: string): Payload {
  const ims = nextData?.props?.pageProps?.initialMenuState;
  if (!ims || !ims.restaurant || !ims.menuData) {
    throw new Error(
      "initialMenuState / restaurant / menuData missing. Talabat changed the " +
        "SSR shape — update the scraper."
    );
  }
  const r = ims.restaurant;
  const md = ims.menuData;
  const currency = ims?.currentCountry?.currencyISO ?? "EGP";

  if (r.branchId == null) throw new Error("restaurant.branchId missing");
  if (!Array.isArray(md.categories)) {
    throw new Error("menuData.categories is not an array");
  }

  return {
    restaurant: {
      external_id: String(r.branchId),
      name: r.name ?? "Unknown restaurant",
      slug: r.restaurantSlug ?? r.branchSlug ?? null,
      cuisine: r.cuisineString ?? null,
      image_url: r.heroImage ?? null,
      logo_url: r.logo ?? null,
      currency,
    },
    categories: md.categories
      .filter((c: any) => c && c.id !== -1) // skip "Picks for you 🔥"
      .map((c: any, idx: number) => ({
        external_id: String(c.id),
        name: String(c.name ?? "").trim() || `Category ${idx + 1}`,
        display_order: idx,
        items: (c.items ?? []).map((it: any, j: number) => {
          // Talabat: hasChoices items with price = 0 are "Price on Selection"
          // (size/options drive the final cost). Store null so the UI knows
          // to ask the user for the actual price at pick time.
          const rawPrice =
            typeof it.price === "number" ? it.price : Number(it.price);
          const hasChoices = it.hasChoices === true;
          const price =
            Number.isFinite(rawPrice) && rawPrice > 0
              ? rawPrice
              : hasChoices
              ? null
              : 0;
          return {
            external_id: String(it.id),
            name: String(it.name ?? "").trim() || `Item ${j + 1}`,
            description: it.description ? String(it.description).trim() : null,
            price,
            image_url: it.originalImage || it.image || null,
            display_order: j,
          };
        }),
      })),
  };
}

async function upsertAll(adminClient: any, url: string, payload: Payload) {
  const { restaurant, categories } = payload;

  const { data: restRow, error: restErr } = await adminClient
    .from("restaurants")
    .upsert(
      [
        {
          external_source: "talabat",
          external_id: restaurant.external_id,
          url,
          name: restaurant.name,
          slug: restaurant.slug,
          cuisine: restaurant.cuisine,
          image_url: restaurant.image_url,
          logo_url: restaurant.logo_url,
          currency: restaurant.currency,
          last_scraped_at: new Date().toISOString(),
        },
      ],
      { onConflict: "external_source,external_id" }
    )
    .select("id, name")
    .single();
  if (restErr) throw restErr;

  const catRows = categories.map((c) => ({
    restaurant_id: restRow.id,
    external_id: c.external_id,
    name: c.name,
    display_order: c.display_order,
  }));
  const { data: insertedCats, error: catErr } = await adminClient
    .from("menu_categories")
    .upsert(catRows, { onConflict: "restaurant_id,external_id" })
    .select("id, external_id");
  if (catErr) throw catErr;
  const catIdByExternal = new Map(
    insertedCats.map((c: any) => [c.external_id, c.id])
  );

  const itemRows: any[] = [];
  for (const cat of categories) {
    const catId = catIdByExternal.get(cat.external_id);
    for (const it of cat.items) {
      itemRows.push({
        category_id: catId,
        external_id: it.external_id,
        name: it.name,
        description: it.description,
        price: it.price,
        image_url: it.image_url,
        display_order: it.display_order,
      });
    }
  }

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < itemRows.length; i += CHUNK) {
    const slice = itemRows.slice(i, i + CHUNK);
    const { error: itErr } = await adminClient
      .from("menu_items")
      .upsert(slice, { onConflict: "category_id,external_id" });
    if (itErr) throw itErr;
    inserted += slice.length;
  }

  return {
    restaurantId: restRow.id,
    restaurantName: restRow.name,
    categoryCount: insertedCats.length,
    itemCount: inserted,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Caller-scoped client to identify them and check is_admin.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await userClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const url = body.url;
    if (typeof url !== "string" || !url.includes("/restaurant/")) {
      return new Response(
        JSON.stringify({ error: "Provide a valid Talabat restaurant URL" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    parseTalabatUrl(url); // validates shape

    const html = await fetchHtml(url);
    const nextData = extractNextData(html);
    const payload = pickPayload(nextData, url);

    // Service-role client for the catalogue upserts (bypasses RLS).
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const result = await upsertAll(adminClient, url, payload);

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[scrape-talabat] failed:", err?.message ?? err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Unknown error" }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
