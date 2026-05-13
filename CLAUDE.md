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
- **EAS project:** `@leo_pepsi_2/split_bite`
- **Support URL:** `https://abdallah-hatem.github.io/split_bite/support.html`

To build + auto-submit hands-free:
```bash
eas build --platform ios --profile production --auto-submit --non-interactive
```

## Supabase

- Local dev points at `http://127.0.0.1:54321` (test users seeded by `scripts/seed-users.sh`: `bodz@test.com` / `123123`).
- Cloud production: `ocwmcnjnwvsoxkxkbvmd.supabase.co`. Cloud config is backed up locally as `.env.cloud.local` (gitignored).
- Schema changes: write migration in `supabase/migrations/`, then `supabase db push` to apply to cloud.

## Testing

```bash
npm run test:unit        # 47 unit tests, must pass before any merge
npx tsc --noEmit         # type check, must be clean
```

For UI changes, start the dev server (`npx expo start --go --ios`) and exercise the feature manually. Type-check + tests pass != feature works.

## Brainstorming gate

For any new feature ("add X", "build Y"), invoke the brainstorming skill before writing code. The skill writes a spec to `split_bite_docs/01-requirements/` and only then we proceed to writing-plans.

## Push notifications

- The native config for push (iOS `aps-environment` entitlement, Android channel) is applied by `expo-notifications` **only when listed as a config plugin** in `app.json`. Missing this entry was the root cause of "notifications work in Expo Go but not in production" (May 2026). Always keep it under `expo.plugins`.
- APNs auth: the Key ID stored in Expo (https://expo.dev/accounts/leo_pepsi_2/projects/split_bite/credentials) must match an active key in Apple Developer → Keys. Apple only allows 2 active keys per team — if Apple shows a different Key ID than Expo, re-upload the live `.p8` to Expo (or generate a new key and update both). A mismatch makes APNs silently reject pushes.

## OTA updates (eas update)

OTA is configured (`updates.url` + `runtimeVersion.policy: "appVersion"` + `expo-updates` plugin). Known blocker for any `eas update`:

- `src/lib/supabase.ts` references `localStorage` directly inside the `Platform.OS === "web"` branch. The `expo export --platform=all` step that `eas update` runs evaluates the supabase client during web SSR, where `Platform.OS === "web"` is true but `localStorage` is undefined in Node. Bundling crashes.
- Fix when ready: gate with `typeof window !== "undefined"` (or replace with `AsyncStorage` for web).

## Auto mode reminder

When auto mode is on, the harness wants action over questions for routine code work. Auto mode does NOT relax:
- Git rules above
- The brainstorming-before-features rule
- User confirmation for production actions (EAS submit, force-push, destructive ops)
