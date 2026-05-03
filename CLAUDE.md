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

## Auto mode reminder

When auto mode is on, the harness wants action over questions for routine code work. Auto mode does NOT relax:
- Git rules above
- The brainstorming-before-features rule
- User confirmation for production actions (EAS submit, force-push, destructive ops)
