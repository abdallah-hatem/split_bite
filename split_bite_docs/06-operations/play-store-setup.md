# Play Store Setup — SplitBite

This guide is for shipping SplitBite to Google Play **using a friend's Google Play developer account** while the build/code pipeline stays under our EAS project (`@leo_pepsi_2/split_bite`).

Two ownership concepts are separate:

| Thing | Owned by |
|---|---|
| EAS project, signing keystore, source code | **Me** (`@leo_pepsi_2/split_bite`) |
| Google Play app listing, package name, payouts | **Friend** (their Google Play developer account) |

They connect via a service account JSON the friend issues — that's how my EAS account is allowed to upload AABs to their Play Console.

---

## Part 1 — What the friend does (once, ~1–2 hours of active work + 1–3 days of identity verification)

### 1. Make sure they have a Play Console developer account
- https://play.google.com/console — $25 one-time fee.
- Identity verification can take 1–3 days. Nothing else can proceed until it's approved.

### 2. Create the SplitBite app in Play Console
- Sign in to https://play.google.com/console.
- Click **Create app**.
- App name: **SplitBite**
- Default language: pick one (e.g. English (United States)).
- App or game: **App**
- Free or paid: **Free**
- Accept developer program policies + US export laws → Create app.

### 3. Register the package name
- Inside the new app → **Set up your app** → look for the section asking for package name / application ID.
- Use exactly: `com.leopepsi2.splitbite`
  - This must match the `android.package` in our `app.json`.
  - If Play tells them the name is taken, **stop and message me** — it shouldn't be, but if it is we have to rename across the project.

### 4. Enroll in Play App Signing
When Play asks how to handle app signing during setup, choose **Use Play App Signing** (this should be the default for new apps). This lets Google manage the production signing key while my EAS builds sign with a separate upload key. It's much more forgiving long-term — keystore loss doesn't kill the app.

### 5. Fill the store listing (can be polished later but needed before review)
**Main store listing:**
- Short description (~80 chars)
- Full description (~4000 chars max)
- App icon (512×512 PNG, no transparency) — use `assets/images/icon.png` upscaled
- Feature graphic (1024×500 PNG)
- Phone screenshots: at least 2, ideally 4–8. Same screenshots I used on App Store work.

**Other required sections in the left sidebar:**
- **App content** → Privacy policy URL → `https://abdallah-hatem.github.io/split_bite/privacy-policy.html`
- **App content** → Ads → SplitBite does **not** show ads.
- **App content** → App access → all functionality is available after sign-up; no special test instructions needed.
- **App content** → Content rating → fill the IARC questionnaire. SplitBite has no violence, no user-generated chat, no payments processed in-app — should come out as **Everyone / 3+**.
- **App content** → Target audience → 13+ (or whatever's appropriate; not designed for under-13).
- **App content** → Data safety → declare:
  - **Personal info collected:** Email address, Name (display name)
  - **App activity collected:** Order data (food items, prices, group membership)
  - **Device IDs:** Push notification tokens
  - **All data is encrypted in transit** (HTTPS to Supabase).
  - **No data sold** to third parties.
  - **Users can request deletion** via the in-app account deletion flow.
- **App content** → Government apps → No.
- **App content** → News apps → No.
- **App content** → COVID-19 contact-tracing apps → No.

### 6. Create the service account so I can upload builds
This is the bridge between my EAS account and the friend's Play Console.

#### 6a. In Google Cloud Console
- Go to https://console.cloud.google.com → switch into the Google account that owns the Play Console.
- Top bar → project dropdown → **New Project** → name it e.g. `splitbite-play`.
- Inside the new project: hamburger menu → **IAM & Admin** → **Service Accounts** → **Create service account**.
  - Name: `splitbite-eas-submit`
  - ID: leave as auto-generated.
  - Click **Create and continue**.
- Skip the "Grant this service account access to project" step (Play Console handles the actual permission grant separately).
- **Done**.
- Back on the Service Accounts list → click the new one → **Keys** tab → **Add key → Create new key → JSON** → **Create**. A JSON file downloads.
- **Save this file.** Treat it like a password — anyone with it can upload to your Play Console. Send it to me through a secure channel (encrypted message, password manager share, etc., not plain email).

#### 6b. In Play Console
- Sidebar → **API access**.
- If prompted, link the Google Cloud project from step 6a.
- Find the `splitbite-eas-submit@…` service account in the list → **Grant access**.
- Permissions: enable **Releases → Release apps to testing tracks** and **Release to production**. (Or use the preset "Release manager".)
- Apply for: **App-specific access → SplitBite only** (safer than account-wide).
- Save.

### 7. Set up Firebase for Android push notifications
Push on Android goes via Firebase Cloud Messaging (FCM), not APNs.

#### 7a. Create the Firebase project
- https://console.firebase.google.com → **Add project** → name `splitbite` (or reuse the Cloud project from step 6a — Firebase can attach to an existing GCP project).
- Disable Google Analytics if asked (we don't need it).

#### 7b. Register the Android app inside Firebase
- Firebase console → Project Overview → **Add app** → Android icon.
- Android package name: `com.leopepsi2.splitbite` (must match Play Console).
- Nickname: SplitBite (optional).
- Skip Debug signing certificate SHA-1 for now (only needed if we use Firebase Auth, which we don't).
- Click **Register app**.
- Download `google-services.json` → save it for handoff.
- Skip the rest of the SDK setup steps — EAS handles that for us as long as `google-services.json` exists.

#### 7c. Enable FCM API v1 + create push service account
- Inside the Firebase project, go to **Project settings** (gear icon) → **Cloud Messaging** tab.
- Confirm **Firebase Cloud Messaging API (V1)** is enabled.
- Below it, **Service account credentials** → create a new service account JSON key (or you can reuse the one from step 6a if you'd like; either works). Download it.
- This second JSON is what Expo uses to send pushes through FCM on our behalf.

### 8. Hand off to me
Send (via a secure channel):
1. The Play service account JSON from step 6a (`splitbite-eas-submit-*.json`).
2. `google-services.json` from step 7b.
3. The FCM V1 service account JSON from step 7c.
4. Confirmation the Play Console listing exists, package name is `com.leopepsi2.splitbite`, and Play App Signing is enrolled.

Friend's work is done at this point. From here it's mostly me.

---

## Part 2 — What I do after the friend hands off (~1–2 hours)

### 1. Drop the credential files into the project
```bash
mkdir -p credentials
mv ~/Downloads/splitbite-eas-submit-*.json credentials/play-service-account.json
mv ~/Downloads/google-services.json google-services.json
mv ~/Downloads/<fcm-service-account>.json credentials/fcm-service-account.json
```

Make sure they're all gitignored. `.gitignore` already has `credentials/` covered for iOS, but verify:

```bash
echo "google-services.json" >> .gitignore   # only if not already there
echo "credentials/" >> .gitignore           # idempotent
```

### 2. Wire `google-services.json` into `app.json`
Add the `googleServicesFile` field under `android`:

```json
"android": {
  "adaptiveIcon": { ... },
  "edgeToEdgeEnabled": true,
  "predictiveBackGestureEnabled": false,
  "package": "com.leopepsi2.splitbite",
  "googleServicesFile": "./google-services.json"
}
```

### 3. Add the submit profile to `eas.json`
Extend the existing `submit.production` to include Android:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "abdallahhatem36@gmail.com",
      "appleTeamId": "CN24UJRFFJ",
      "ascAppId": "6762308340"
    },
    "android": {
      "serviceAccountKeyPath": "./credentials/play-service-account.json",
      "track": "internal"
    }
  }
}
```

`track: "internal"` lands the build in Internal testing first — safer than going straight to production.

### 4. Upload FCM credentials to EAS
```bash
eas credentials
```
- Platform → **Android**
- Profile → **production**
- Action → **Google Service Account: Manage your Google Service Account Key for Push Notifications (FCM V1)**
- Upload the FCM V1 service account JSON.

### 5. First build + smoke test (preview track on EAS)
Before doing a production submission, build a dev/internal AAB and sideload it onto a real Android device to catch Android-specific runtime issues (we've only tested iOS so far).

```bash
eas build --platform android --profile preview
```

EAS will prompt to create an **Android keystore** on first build — accept. EAS stores it under our `@leo_pepsi_2/split_bite` account; reuse it forever. (Play App Signing means even if we lose this, we can issue a new upload key. Still don't lose it on purpose.)

Install the AAB on a real Android device (transfer via USB or use EAS's QR code install link). Run through:
- Sign up + sign in
- Create group, add items, finalize an order
- Notification permission grant
- Send a settle-up; confirm test push lands on the *other* device

If anything breaks, fix and iterate before touching production.

### 6. Production build + submit to internal testing
```bash
eas build --platform android --profile production --auto-submit --non-interactive
```

With `--auto-submit`, when the build finishes EAS calls the Play Console API using `play-service-account.json` and uploads the AAB to the **Internal testing** track of the friend's Play Console.

Friend (and any internal testers) can then install it via the opt-in link Play Console provides under **Testing → Internal testing → Testers**.

### 7. Promote internal → production
Once internal testing looks healthy:
- Friend opens Play Console → Testing → Internal testing → **Promote release → Production**.
- Fill the release notes (the same "What's new" from App Store works).
- Submit for review. Google's review usually takes 1–7 days.

No rebuild required — same AAB just gets re-tracked.

### 8. Diagnose push delivery on Android
Same pattern as iOS — get the device's push token from Supabase `push_tokens`, send a test via the Expo Push API, fetch the receipt. The token shape is the same `ExponentPushToken[...]`. The only difference is delivery goes through FCM instead of APNs; if a receipt errors with `MessageTooBig` or `MismatchSenderId` or `InvalidCredentials`, it's pointing at the FCM credentials in step 4 rather than APNs.

---

## Notes / gotchas

- **App ownership is the friend's.** They own the Play Store listing, payouts (if we ever charge), legal contact info, the right to delete the listing. If we ever fall out, that's a risk. Not symmetric to iOS where we're the owner.
- **Bundle identifier (`com.leopepsi2.splitbite`) must match everywhere:** `app.json`, Play Console app, Firebase Android app, `google-services.json`. Any mismatch makes the build silently fail to register for push or get rejected by Play.
- **Don't commit JSON credentials.** `credentials/` and `google-services.json` should stay out of git. Verify with `git status` before every commit.
- **Keep the iOS pipeline working** — adding Android doesn't change the iOS flow at all. We can still `eas build --platform ios --profile production --auto-submit`.
- **OTA updates ship to both platforms.** `eas update --branch production` publishes JS to whatever platforms are at the current `runtimeVersion`. Once Android is live, OTAs reach Android users too — no extra work.

---

## Summary of artifacts

After all this is done, the project will have these new files (or updates):

```
app.json                                            # +android.googleServicesFile
eas.json                                            # +submit.production.android
google-services.json                                # gitignored, from Firebase
credentials/play-service-account.json               # gitignored, from Play Console API access
credentials/fcm-service-account.json                # gitignored, from Firebase Cloud Messaging
.gitignore                                          # update if needed
```

And the friend has:
- Play Console app published (initially Internal testing)
- Firebase project for FCM
- Two service accounts in their Google Cloud (one for Play submit, one for FCM push)
