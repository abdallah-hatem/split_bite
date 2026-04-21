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
- **Apple Team:** CN24UJRFFJ
- **Account:** abdallahhatem36@gmail.com

## Demo Account (for App Review)
- Email: `abdallahhatem36@gmail.com`
- Password: `123123`
