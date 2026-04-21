# Local Development Setup

## Prerequisites
- Node.js 20+
- Docker Desktop running
- Supabase CLI (`brew install supabase/tap/supabase`)
- Expo CLI (via npx)
- EAS CLI (`npm install -g eas-cli`)
- Xcode (for iOS simulator)

## Initial Setup

```bash
git clone https://github.com/abdallah-hatem/split_bite.git
cd split_bite
npm install
supabase start
./scripts/seed-users.sh
```

## Environment Variables

Create `.env` in the project root:

**For simulator (local Supabase):**
```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

**For physical device (local Supabase):**
Replace `127.0.0.1` with your Mac's LAN IP (find with `ipconfig getifaddr en0`).

**For cloud Supabase:**
```
EXPO_PUBLIC_SUPABASE_URL=https://ocwmcnjnwvsoxkxkbvmd.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<cloud anon key>
```

## Daily Workflow

```bash
supabase start                 # if not running
npx expo start --go --clear    # with cache clear
# Press i for iOS simulator, scan QR for physical
```

## Test Users (Local)
- `bodz@test.com` / `123123`
- `test2@test.com` / `123123`

Recreate after `supabase db reset` with `./scripts/seed-users.sh`.

## Running Tests

```bash
npm run test:unit         # Jest unit tests (46+)
npx tsc --noEmit          # Type check
```

## Supabase Studio
http://127.0.0.1:54323 — visual table browser, SQL editor, auth users
