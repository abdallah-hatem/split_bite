// Scrape a Talabat restaurant's menu and upsert it into Supabase.
//
// Usage:
//   npm run scrape:talabat -- <talabat-restaurant-url> [--force]
//
// Example:
//   npm run scrape:talabat -- https://www.talabat.com/egypt/restaurant/697415/gad3
//
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from one of:
//   1. scripts/.env.scraper.local (gitignored; preferred)
//   2. process.env
//   3. `supabase status -o env` (local default; only used if neither above set)
//
// See split_bite_docs/01-requirements/2026-05-18-restaurant-menu-scraping-design.md

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { createClient } = require("@supabase/supabase-js");

const SCRIPT_DIR = __dirname;
const ENV_FILE = path.join(SCRIPT_DIR, ".env.scraper.local");
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const force = args.includes("--force");
const positional = args.filter((a) => !a.startsWith("--"));
const url = positional[0];

if (!url) {
  console.error("Usage: npm run scrape:talabat -- <talabat-restaurant-url> [--force]");
  process.exit(1);
}

function loadEnv() {
  let url, key;

  // 1. .env.scraper.local
  if (fs.existsSync(ENV_FILE)) {
    const raw = fs.readFileSync(ENV_FILE, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (!m) continue;
      if (m[1] === "SUPABASE_URL") url = m[2].trim();
      if (m[1] === "SUPABASE_SERVICE_ROLE_KEY") key = m[2].trim();
    }
  }

  // 2. process.env
  url = url || process.env.SUPABASE_URL;
  key = key || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 3. supabase status (local fallback)
  if (!url || !key || key === "replace_me") {
    try {
      const out = execSync("supabase status -o env", { encoding: "utf8" });
      for (const line of out.split("\n")) {
        const m = line.match(/^([A-Z_]+)="?(.+?)"?$/);
        if (!m) continue;
        if (!url && m[1] === "API_URL") url = m[2];
        if ((!key || key === "replace_me") && m[1] === "SERVICE_ROLE_KEY") key = m[2];
      }
    } catch {
      // local supabase not running — fall through to error below
    }
  }

  if (!url || !key || key === "replace_me") {
    console.error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Create scripts/.env.scraper.local with both values, or start local " +
        "Supabase, or export them in your shell."
    );
    process.exit(1);
  }
  return { url, key };
}

function parseTalabatUrl(u) {
  const m = u.match(/\/restaurant\/(\d+)/);
  if (!m) throw new Error(`Could not extract branchId from URL: ${u}`);
  return { branchId: m[1] };
}

async function fetchHtml(u) {
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

function extractNextData(html) {
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

function pickPayload(nextData) {
  const ims = nextData?.props?.pageProps?.initialMenuState;
  if (!ims || !ims.restaurant || !ims.menuData) {
    throw new Error(
      "initialMenuState / restaurant / menuData missing. " +
        "Talabat changed the SSR shape — update the scraper."
    );
  }
  const r = ims.restaurant;
  const md = ims.menuData;
  const currency = ims?.currentCountry?.currencyISO ?? "EGP";

  if (typeof r.branchId !== "number" && typeof r.branchId !== "string") {
    throw new Error("restaurant.branchId missing or wrong type");
  }
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
      .filter((c) => c && c.id !== -1) // skip "Picks for you 🔥"
      .map((c, idx) => ({
        external_id: String(c.id),
        name: String(c.name ?? "").trim() || `Category ${idx + 1}`,
        display_order: idx,
        items: (c.items ?? []).map((it, j) => ({
          external_id: String(it.id),
          name: String(it.name ?? "").trim() || `Item ${j + 1}`,
          description: it.description ? String(it.description).trim() : null,
          price: typeof it.price === "number" ? it.price : Number(it.price) || 0,
          image_url: it.originalImage || it.image || null,
          display_order: j,
        })),
      })),
  };
}

async function shouldSkipScrape(supabase, externalId) {
  if (force) return false;
  const { data } = await supabase
    .from("restaurants")
    .select("id, name, last_scraped_at")
    .eq("external_source", "talabat")
    .eq("external_id", externalId)
    .maybeSingle();
  if (!data?.last_scraped_at) return false;
  const ageMs = Date.now() - new Date(data.last_scraped_at).getTime();
  if (ageMs < SIX_HOURS_MS) {
    const minsAgo = Math.round(ageMs / 60_000);
    console.log(
      `Skipping — "${data.name}" was scraped ${minsAgo} min ago. Re-run with --force to override.`
    );
    return true;
  }
  return false;
}

async function upsertAll(supabase, payload) {
  const { restaurant, categories } = payload;

  // 1. Restaurant
  const { data: restRow, error: restErr } = await supabase
    .from("restaurants")
    .upsert(
      [
        {
          external_source: "talabat",
          external_id: restaurant.external_id,
          url: url,
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
  console.log(`Restaurant ✓ ${restRow.name} (${restRow.id})`);

  // 2. Categories
  const catRows = categories.map((c) => ({
    restaurant_id: restRow.id,
    external_id: c.external_id,
    name: c.name,
    display_order: c.display_order,
  }));
  const { data: insertedCats, error: catErr } = await supabase
    .from("menu_categories")
    .upsert(catRows, { onConflict: "restaurant_id,external_id" })
    .select("id, external_id");
  if (catErr) throw catErr;
  const catIdByExternal = new Map(
    insertedCats.map((c) => [c.external_id, c.id])
  );
  console.log(`Categories ✓ ${insertedCats.length}`);

  // 3. Items (one bulk upsert for all categories)
  const itemRows = [];
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
  // Supabase has a per-request payload size; chunk to be safe.
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < itemRows.length; i += CHUNK) {
    const slice = itemRows.slice(i, i + CHUNK);
    const { error: itErr } = await supabase
      .from("menu_items")
      .upsert(slice, { onConflict: "category_id,external_id" });
    if (itErr) throw itErr;
    inserted += slice.length;
  }
  console.log(`Items ✓ ${inserted}`);

  return { restaurantName: restRow.name, restaurantId: restRow.id };
}

async function main() {
  const { url: supaUrl, key: supaKey } = loadEnv();
  console.log(`Supabase → ${supaUrl}`);
  const supabase = createClient(supaUrl, supaKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { branchId } = parseTalabatUrl(url);
  console.log(`Scraping branchId=${branchId} from ${url}`);

  if (await shouldSkipScrape(supabase, branchId)) return;

  const html = await fetchHtml(url);
  console.log(`Fetched ${html.length} bytes`);

  const nextData = extractNextData(html);
  const payload = pickPayload(nextData);
  console.log(
    `Parsed → ${payload.restaurant.name} · ${payload.categories.length} categories · ${payload.categories.reduce(
      (n, c) => n + c.items.length,
      0
    )} items`
  );

  await upsertAll(supabase, payload);
  console.log("Done.");
}

main().catch((err) => {
  console.error("\nScrape failed:", err.message ?? err);
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});
