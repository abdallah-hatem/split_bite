# Play Store Listing — Copy-Paste Content

All the text content for the friend to drop directly into Play Console fields. Companion to `play-store-setup.md` (the procedural guide).

---

## App basics

- **App name:** SplitBite
- **Default language:** English (United States)
- **App or game:** App
- **Free or paid:** Free
- **Category (primary):** Lifestyle
- **Category (secondary):** Finance

---

## Short description
*(Play Console limit: 80 chars)*

> Split group orders and bills fairly with friends — no math, no awkwardness.

*(73 / 80 chars)*

---

## Full description
*(Play Console limit: 4000 chars. Paste exactly as-is — Play renders the line breaks and emoji.)*

```
SplitBite makes splitting the bill effortless. Whether you're ordering food with friends, hosting a dinner, or living with roommates, SplitBite tracks who ordered what, who paid, and exactly what each person owes — automatically.

✨ Features
• Groups — create a group for your friends, roommates, or coworkers and share an invite code to let them join
• Orders — start a shared order so everyone can add what they want; perfect for group food delivery
• Item-level splits — assign each item to one person, everyone, or specific people
• Custom ratio splits — split a single item in any ratio you want (e.g. 1 : 1 : 2 when one person had a bigger portion)
• Guests — include people who aren't on the app yet; the host vouches for them
• Real-time collaboration — see what others are adding as they add it
• Bill finalization — enter the actual receipt total, tax, VAT, delivery, and discount; SplitBite reconciles the difference automatically
• Multi-payer support — more than one person can chip in on the same bill
• Per-person summary — see exactly what each person owes, with a clean breakdown
• Group balance ledger — track who owes whom across all your orders, not just one
• Settlement requests — mark a payment so the receiver can confirm or reject it
• Push notifications — get a heads up when an order is created, finalized, or when someone wants to settle

🎯 Built for
• Friends ordering food delivery together
• Roommates splitting takeout or groceries
• Office lunch orders
• Travel groups settling shared expenses

🔒 Privacy first
SplitBite only collects what it needs to work: your email, your display name, and the order data you create. No ads. No tracking. No data sold to third parties. Your data is encrypted in transit and stored securely. Delete your account and all your data from inside the app any time via Profile → Delete Account.

💰 Free
SplitBite is completely free. No subscriptions. No in-app purchases.

📧 Support
abdallahhatem36@gmail.com
https://abdallah-hatem.github.io/split_bite/support.html

Made with care to make splitting bills less painful.
```

---

## URLs

- **Privacy policy:** `https://abdallah-hatem.github.io/split_bite/privacy-policy.html`
- **App website (optional):** `https://abdallah-hatem.github.io/split_bite/support.html`
- **Support email:** `abdallahhatem36@gmail.com`
- **Phone:** optional, can leave blank

---

## Graphics specs (we still need to produce these)

| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG, no transparency | exists at `assets/images/icon.png` — may need upscale + remove transparency |
| Feature graphic | 1024×500 PNG, no transparency | **TBD** — needed |
| Phone screenshots | 1080×1920 or 16:9 PNG, min 2, max 8 | can reuse iOS screenshots if same orientation; otherwise capture from a Pixel emulator |
| 7-inch tablet (optional) | 1024×768 | skip (app is phone-only) |
| 10-inch tablet (optional) | 2048×1536 | skip |

---

## Content rating (IARC questionnaire answers)

The questionnaire is Yes/No questions. Answer:

- Violence: **No**
- Sexual content: **No**
- Crude humor: **No**
- Profanity: **No**
- Gambling: **No**
- Controlled substance references: **No**
- Real-money gambling: **No**
- Tobacco / alcohol / drug references: **No**
- Scary / disturbing imagery: **No**
- User-generated text/photos/videos shared with strangers: **No** — display names and group/order/item names are only seen by other members of the user's groups, not by strangers
- Location sharing: **No**
- Personal info sharing with strangers: **No**
- Digital purchases: **No**
- Web browsing: **No**

Expected outcome: **Everyone / 3+**

---

## Target audience and content

- Target age groups: **13+** (uncheck under-13 boxes)
- Appeals to children under 13: **No**
- Ads to children: **No** (we don't show ads at all)

---

## App access

- **All functionality available without restrictions:** Yes
- **Login required to use the app:** Yes — email + password sign-up is required to do anything meaningful
- **Test credentials for reviewers:**
  - Email: `abdallahhatem36@gmail.com`
  - Password: `123123`
  - (Or create a fresh demo account specifically for the friend's Play submission and put its credentials here. Some reviewers also want a video or instructions — usually not required for a simple lifestyle app.)

---

## Data safety section

The friend will be asked a sequence of multi-step questions. Use these answers.

### Does your app collect or share any of the required user data types?
**Yes.**

### Personal info

- **Email address**
  - Collected: Yes
  - Shared: No
  - Required: Yes
  - Purposes: Account management, App functionality
  - Encrypted in transit: Yes
  - Users can request deletion: Yes
- **Name** (display name)
  - Collected: Yes
  - Shared: No
  - Required: Yes
  - Purposes: Account management, App functionality
  - Encrypted in transit: Yes
  - Users can request deletion: Yes

### Financial info
- Not collected. SplitBite tracks who owes whom but does not process payments and does not collect bank, credit card, or payment-method information.

### Location
- Not collected.

### Photos and videos
- Not collected.

### Audio
- Not collected.

### Files and docs
- Not collected.

### Calendar
- Not collected.

### Contacts
- Not collected.

### App activity
- **App interactions** (item assignments, settlement actions, etc.)
  - Collected: Yes
  - Shared: No
  - Required: Yes
  - Purposes: App functionality
  - Encrypted in transit: Yes
  - Users can request deletion: Yes
- **In-app search history**: No
- **Other user-generated content** (group names, order titles, item names):
  - Collected: Yes
  - Shared: No (only with other members of the user's groups)
  - Required: Yes
  - Purposes: App functionality
  - Encrypted in transit: Yes
  - Users can request deletion: Yes

### Web browsing
- Not collected.

### App info and performance
- Crash logs: **No** (we don't ship Crashlytics or similar)
- Diagnostics: No
- Other: No

### Device or other IDs
- **Other IDs** — Expo push notification token
  - Collected: Yes
  - Shared: No (only used to send notifications via Expo's push service)
  - Required: No (optional — users can deny notification permission)
  - Purposes: App functionality (push notifications)
  - Encrypted in transit: Yes
  - Users can request deletion: Yes

### Security practices summary
- All data is encrypted in transit (HTTPS to Supabase): **Yes**
- You follow the Families Policy: **No** (not targeting families/children)
- Users can request data deletion: **Yes** — in-app via Profile → Delete Account
- Independent security review: No

---

## Government apps / News apps / Tax apps / COVID-19 apps
All: **No**

---

## Pricing & distribution

- Free: **Yes**
- Distribute in: All countries (or pick specifically). Egypt + relevant markets at minimum.
- Contains ads: **No**

---

## Release notes ("What's new in this version")

For the very first 1.0.1 release on Play:

```
Initial release of SplitBite for Android.
• Create groups and share an invite code with friends
• Add orders, split items equally or by custom ratios
• Track group balances and settle up with confirmation
• Push notifications for new orders, finalized bills, and settlements
```

---

## Permissions justification

If Play asks why the app requests specific permissions:

- **Internet** — required to talk to our Supabase backend
- **Receive push notifications (Firebase Messaging)** — required to deliver notifications about orders and settlements
- **Vibrate** — optional notification feedback
- **Read external storage / write external storage** — not requested
- **Camera / location / contacts** — not requested
