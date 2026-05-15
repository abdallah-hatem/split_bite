# Deployment

## Cloud Supabase
**Project:** `ocwmcnjnwvsoxkxkbvmd` (region: default)

**Push migrations:**
```bash
supabase link --project-ref ocwmcnjnwvsoxkxkbvmd
supabase db push
```

**Dashboard:** https://supabase.com/dashboard/project/ocwmcnjnwvsoxkxkbvmd

## EAS Build (App Store)

**Project:** `@leo_pepsi_2/split_bite`
**Project ID:** `3694f975-6340-47f3-80fa-cb6b4b105221`

**Environment variables** (set in EAS dashboard for production):
- `EXPO_PUBLIC_SUPABASE_URL` — cloud URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — cloud anon key

**Build and submit:**
```bash
eas build --profile production --platform ios --auto-submit
```

Builds take ~10-15 min on EAS cloud. Free tier queue adds 1-3 hrs wait.

## OTA Updates (EAS Update)

JS-only changes can skip the App Store and go out via OTA:

```bash
eas update --branch production --message "describe change"
```

Requires `expo-updates` installed and `runtimeVersion.policy: "appVersion"` in `app.json`.

**What needs a new build:**
- `app.json` changes (name, icon, splash, plugins)
- Native modules added/removed
- Permissions changes

**What can be OTA:**
- JS code changes
- Styles, assets
- Hook/component changes
- Supabase queries (though schema changes require `supabase db push` to cloud)

## App Store Connect
- **App ID:** `com.leopepsi2.splitbite`
- **Bundle ID:** `com.leopepsi2.splitbite`
- **ASC App ID (`ascAppId`):** `6762308340` — required in `eas.json` for `eas build --auto-submit`
- **Apple Team:** CN24UJRFFJ
- **Account:** abdallahhatem36@gmail.com
- **Support URL:** https://abdallah-hatem.github.io/split_bite/support.html
- **Privacy URL:** https://abdallah-hatem.github.io/split_bite/privacy-policy.html

## APNs (push notifications)
- **Active key (2026-05-15):** `CK6KKK4PUB` — must match between Apple Developer → Keys and the Expo dashboard. Verified working via Expo Push API receipt on 2026-05-15.
- Previous keys `3KZB99KCWF` (revoked) and `73M659HY23` ("SA Egypt APNs", different project) — do **not** point Expo at these.
- Replacing the key never requires an app rebuild: existing Expo push tokens stay valid; only Expo's signing key changes.
- If a receipt comes back with `error: "InvalidCredentials"` / `apns.reason: "InvalidProviderToken"`, the `.p8` in Expo doesn't cryptographically match what Apple has for the Key ID. Fix is to revoke + recreate in Apple, then re-upload the fresh `.p8` to Expo.

## Demo Account (for App Review)
- Email: `abdallahhatem36@gmail.com`
- Password: `123123`
