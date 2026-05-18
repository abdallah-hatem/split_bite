# SplitBite — Claude Instructions

Project-level rules for working in this repo. These override defaults.

## Git — strictest rule

**Never run `git commit` or `git push` without explicit permission for that exact action.**

- After making file changes, stop and ask: *"Want me to commit?"* — wait for yes.
- "Save it" / "make this change" / "add this" authorise file edits only, NEVER commits.
- A prior `ok push` covers one commit + one push. The next change starts fresh — re-ask.
- EAS auto-bumped files (e.g. `buildNumber`) are still changes that need commit approval.
- After committing, ask separately about pushing — never combine.
- Exception: user's literal message contains "commit", "commit and push", or "push" → that authorises that step.

This rule applies even in `auto` mode. Auto mode authorises code edits, not git history changes.

## Branch policy

- Default working branch is `dev`. PRs go from `dev` to `main`.
- Never force-push. Never push to `main` directly.

## Obsidian vault

The vault at `split_bite_docs/` is the source of project context. On session start, read `Dashboard.md`. Use `Templates/` formats for new notes.

- New design specs → `split_bite_docs/01-requirements/YYYY-MM-DD-<topic>.md`
- Session notes → `split_bite_docs/Sessions/YYYY-MM-DD - <title>.md` (only when user says "update obsidian")
- Operational reference (App Store IDs, EAS, Supabase) → `split_bite_docs/06-operations/`

## App Store / EAS quick reference

Full details in `split_bite_docs/06-operations/deployment.md`. Critical IDs:

- **Bundle ID:** `com.leopepsi2.splitbite`
- **ASC App ID:** `6762308340` (in `eas.json`)
- **Apple Team:** `CN24UJRFFJ`
- **APNs Push Key:** `CK6KKK4PUB` (in Apple Developer + Expo; verified 2026-05-15)
- **EAS project:** `@leo_pepsi_2/split_bite`
- **Support URL:** `https://abdallah-hatem.github.io/split_bite/support.html`

To build + auto-submit hands-free:
```bash
eas build --platform ios --profile production --auto-submit --non-interactive
```

**Version-train rule (learned 2026-05-14):** once Apple approves a build at version X.Y.Z, that train closes for new submissions. Bump `expo.version` (and let EAS auto-increment `buildNumber`) before submitting the next round. The `runtimeVersion.policy: "appVersion"` setup means a version bump also forks the OTA channel — old installs stop receiving OTA updates from the new train (intended; treat each version as a hard cut-over).

## Supabase

- Local dev points at `http://127.0.0.1:54321` (test users seeded by `scripts/seed-users.sh`: `bodz@test.com` / `123123`).
- Cloud production: `ocwmcnjnwvsoxkxkbvmd.supabase.co`. Cloud config is backed up locally as `.env.cloud.local` (gitignored).
- Schema changes: write migration in `supabase/migrations/`, then `supabase db push` to apply to cloud.

## Testing

```bash
npm run test:unit        # 52 unit tests, must pass before any merge
npx tsc --noEmit         # type check, must be clean
```

For UI changes, start the dev server (`npx expo start --go --ios`) and exercise the feature manually. Type-check + tests pass != feature works.

## Brainstorming gate

For any new feature ("add X", "build Y"), invoke the brainstorming skill before writing code. The skill writes a spec to `split_bite_docs/01-requirements/` and only then we proceed to writing-plans.

## Push notifications

- The native config for push (iOS `aps-environment` entitlement, Android channel) is applied by `expo-notifications` **only when listed as a config plugin** in `app.json`. Missing this entry was the root cause of "notifications work in Expo Go but not in production" (May 2026). Always keep it under `expo.plugins`.
- APNs auth: the Key ID stored in Expo (https://expo.dev/accounts/leo_pepsi_2/projects/split_bite/credentials) must match an active key in Apple Developer → Keys. Apple only allows 2 active keys per team — if Apple shows a different Key ID than Expo, re-upload the live `.p8` to Expo (or generate a new key and update both). A mismatch makes APNs silently reject pushes.
- **`InvalidProviderToken` ≠ mismatched Key ID — it means the `.p8` you uploaded to Expo doesn't cryptographically match what Apple has on file for the Key ID.** Even if both sides show the same Key ID, this happens if the `.p8` got corrupted, truncated, or was for a different key entirely. Fix: revoke + recreate in Apple, save the fresh `.p8`, re-upload to Expo.
- **To diagnose push failures, query the receipt — `status: "ok"` on send only means Expo queued it; the receipt has the real APNs result:**
  ```bash
  # 1. Send
  curl -sS -X POST 'https://exp.host/--/api/v2/push/send' \
    -H 'Content-Type: application/json' \
    -d '[{"to":"ExponentPushToken[<token>]","title":"test","body":"test"}]'
  # → returns { data: [{ status: "ok", id: "<receipt-id>" }] }

  # 2. Wait ~15s, fetch receipt
  curl -sS -X POST 'https://exp.host/--/api/v2/push/getReceipts' \
    -H 'Content-Type: application/json' \
    -d '{"ids":["<receipt-id>"]}'
  # → look for status: "ok" (delivered) or error.* (apns.reason explains why)
  ```
  Get a working token from `push_tokens` in Supabase (Studio → SQL Editor).

## OTA updates (eas update)

OTA is configured and working (`updates.url` + `runtimeVersion.policy: "appVersion"` + `expo-updates` plugin).

**Always ship JS-only changes via the wrapper, not raw `eas update`:**

```bash
npm run ota -- "what changed in this update"
```

The wrapper (`scripts/ota.js`) does two things every time:

1. **Refuses to publish if `.env` points at a local Supabase URL** (`127.0.0.1`, `localhost`, `0.0.0.0`, or any non-https). This catches the easy mistake of OTA'ing while still on the local dev `.env`.
2. **Always passes `--clear-cache`** so Metro can't reuse stale transforms.

Why both checks matter:

- **`process.env.EXPO_PUBLIC_*` is inlined at *transform* time, not at runtime.** Metro caches transformed modules. If `.env` was local when a module was last transformed, the cached transform has the localhost URL **baked into it as a string literal**. Subsequent exports will reuse that cache and re-bake the wrong URL even if `.env` has been corrected. May 2026 burned an OTA twice this way — `.env` looked right, the published bundle still contained `127.0.0.1`. Verifying after publish: `curl` the manifest, download the launch asset, `strings -a bundle.js | grep ocwmcnjnwvsoxkxkbvmd` should hit, and `grep 127.0.0.1` should not.
- **`expo export --platform=all` SSRs the web target** because `app.json` has `web.output: "static"`. Code that runs at module-load and touches `window` / `document` / `localStorage` will crash the export. `src/lib/supabase.ts` is gated with `typeof window !== "undefined"` for this reason; follow the same pattern for any web-only code.

**OTA reach:** updates only reach builds on the **same runtime version** (= the same `expo.version`, given the `appVersion` policy). Bumping `expo.version` forks the channel — see the version-train rule under "App Store / EAS quick reference".

## Restaurant catalogue + scraping (admin-only)

A restaurant catalogue with menus lives in three tables (`restaurants`, `menu_categories`, `menu_items`) and powers two app features:
- **Restaurant-tied orders.** When `orders.restaurant_id` is set, the Add Item modal hides free-text inputs and locks item entry to that restaurant's menu. Free-form orders still work when `restaurant_id` is null.
- **Pick-from-menu shortcut.** Even free-form orders can use the menu picker to populate item name + price in one tap.

**Schema is source-agnostic** via `(external_source, external_id)` — `'talabat'` is the first source; future `'manual'` / `'foursquare'` etc. drop in without schema changes.

**Scraping is admin-curated.** Talabat ToS forbids automated scraping; Apple's 5.2.2 could reject apps that obviously rip data. Mitigations: scraping only runs against URLs an admin explicitly pastes (never an automated crawler), is rate-limited to 6h per restaurant, and is gated by `profiles.is_admin = true`.

Two ways to scrape:

**1. In-app (production-friendly).** Sign in as an admin → Profile → "Admin tools" → Restaurants → paste a Talabat URL → Scrape. Calls the `scrape-talabat` Edge Function which verifies `profiles.is_admin = true` on the caller before using the service-role key. Same flow for refresh / delete.

Granting admin happens out-of-band via SQL (intentionally — no UI for it):
```sql
update public.profiles set is_admin = true
 where id = (select id from auth.users where email = 'you@example.com');
```

**2. Local Node script** (still works for batch / dev iteration):
```bash
cp scripts/.env.scraper.example scripts/.env.scraper.local
npm run scrape:talabat -- https://www.talabat.com/egypt/restaurant/<id>/<slug>
# Add --force to override the 6h re-scrape guard.
```

Both paths read `__NEXT_DATA__.props.pageProps.initialMenuState` and upsert via the service-role key. RLS allows any signed-in user to read the catalogue; there are no write policies, so only the service-role key (Node script env or Edge Function runtime) can mutate.

**When the Talabat shape changes**, both paths fail loudly with "menuData missing / shape changed". Inspect `__NEXT_DATA__.props.pageProps.initialMenuState` on a fresh page to find what moved.

**"Price on Selection" items** (Talabat's `hasChoices && price=0`) store `null` in `menu_items.price`. The picker renders "Price varies"; AddItemModal leaves the price field empty when one is picked, so the user types the actual amount. Real zero-priced items would still store `0` — `null` means "Talabat couldn't quote a base price."

**`Picks for you 🔥`** (Talabat category `id: -1`) is intentionally filtered out. It's an algorithmic recommendation row that duplicates items from real categories and shifts per session — including it would create dupes.

**Metro blocklist:** `metro.config.js` excludes `.env.<env>.local` backup files from bundling. Without that, opening the dev server with a `.env.cloud.local` (the cloud-Supabase backup CLAUDE.md prescribes) sitting at the project root makes Metro try to parse it as JS and throws `SyntaxError`. If you ever add another env backup pattern, extend the regex.

## Auto mode reminder

When auto mode is on, the harness wants action over questions for routine code work. Auto mode does NOT relax:
- Git rules above
- The brainstorming-before-features rule
- User confirmation for production actions (EAS submit, force-push, destructive ops)
