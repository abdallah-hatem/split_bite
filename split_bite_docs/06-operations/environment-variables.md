# Environment Variables

## Client-side (.env / EAS env)

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://ocwmcnjnwvsoxkxkbvmd.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | `sb_publishable_...` |

Both are prefixed `EXPO_PUBLIC_` so they get embedded in the client bundle.

## EAS Build

Set for the `production` environment:

```bash
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "https://..." --visibility plaintext --type string
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..." --visibility plaintext --type string
```

## Local Development

Put them in `.env` at the project root. Expo loads this automatically.

- For iOS simulator: use `http://127.0.0.1:54321`
- For physical device on same WiFi: use `http://<mac-lan-ip>:54321`
- For cloud: use the cloud URL

## Secrets (NOT in client)

Never commit the Supabase `service_role` key to the repo or include it in the client bundle. It bypasses RLS.
