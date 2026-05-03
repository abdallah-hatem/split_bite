# 2026-05-03 - iPad Resubmission, Custom Split, Guests First-Class

## Summary
Second Apple review rejection on iPad (despite the 04-21 fix); decided to drop iPad support to remove the surface entirely. While preparing the resubmission, added a non-equal item split feature and fixed a long-standing bug in how guests appear in finalize/summary.

## Apple Review (round 2)

### Guideline 2.1(a) — iPad tabs still unresponsive (iPadOS 26.4.2)
The 04-21 defensive fixes (try/catch/finally on loading, push wrapped) did not stick on the iPad reviewer's device. Doubled down with broader defenses:
- AuthProvider: `.catch()` + 4s safety timer on `getSession()` so `isLoading` never hangs forever (suspected SecureStore/network stall on iPadOS 26).
- Profile: removed the full-screen spinner. Renders avatar + email from auth context immediately; display_name fetch updates in background.
- Activity: removed the full-screen spinner. FlatList always mounts; spinner moved to `ListEmptyComponent` so the tab is responsive on first load.
- Switched `.single()` to `.maybeSingle()` on profile fetch so a missing row no longer throws.

### Guideline 1.5 — Support URL
GitHub repo URL was rejected. Wrote `docs/support.html` styled to match `privacy-policy.html` (FAQ + contact email). Hosted via existing GitHub Pages config (`dev` branch, `/docs`) at `https://abdallah-hatem.github.io/split_bite/support.html`. App Store Connect Support URL field needs updating before resubmission.

### Decision: drop iPad support
After two iPad-specific rejections the team couldn't reproduce locally, set `ios.supportsTablet: false` to make the app iPhone-only. Existing iPad installs keep working in iPhone-compat mode but no iPad reviewer surface to fail. One-way door — going back to universal later is awkward.

## New Feature: Custom (non-equal) item split
Spec at `01-requirements/2026-05-03-custom-split-design.md`.

- New 4th option in Add Item modal: **Custom split**. Picks people AND assigns per-person weights in the same flow.
- Input: plain weight numbers (e.g. `1`, `1`, `2`). Live percentage shown next to each weight ("(25%)") and a "Total weight X — covers 100%" line at the bottom.
- Save disabled until total weight > 0.
- Stored as fractions in existing `item_shares.share_fraction numeric(5,4)` — no migration needed.
- Calc engine already handled fractional shares; just stopped hard-coding `1/N` on insert.
- Scope trimmed to **add-only**: today the Edit Item modal only edits name + price. Edit-assignment + edit-custom-split is a separate follow-up.

## Bug Fix: Guests as first-class participants
User reported a finalize-screen scenario:
- bodz + Guest 1 share two pizzas (650 EGP), delivery 50, total 700.
- Payments: bodz 100, Guest 1 250, Guest 2 350.
- Guest 2 paid but ordered nothing.

Pre-fix UI showed:
- bodz "Settled" (wrong — bodz net owes 321.50).
- Guest 1 with "Paid 250 · Share charged to host".
- Guest 2 invisible in Preview (filtered out by `b.totalOwed > 0`).
- Who Pays Who: Guest 1 → bodz, bodz → Guest 2 (host-routed).

Root cause was Step 8 in `calculations.ts` — guests' nets were transferred to their host so the calc engine could keep `computeDebts` user-only. The UI then showed both pre-transfer (per-row totals) and post-transfer (net + Settled status) data side-by-side, causing the contradiction.

Fix:
- Removed the host-transfer step entirely. Each guest keeps their own `net = totalPaid - totalOwed`.
- `computeDebts` now treats users and guests as peers; emits `guest:<guestId>` IDs in the debts list.
- Replaced the entire "Guest handling" test suite with new "Guests (direct settlement)" tests asserting direct payments. Added a regression test mirroring the screenshot.
- Preview filter relaxed to `totalOwed > 0 || totalPaid > 0` so participants who paid without ordering are visible.
- Removed the "Share charged to host" / "Charged to host" UI text. Guests now show Settled / Owes X / Gets back X like real users.

**Ledger persistence unchanged.** `from_user_id`/`to_user_id` in `ledger_entries` still reference profiles only, so guest debts continue to be filtered out at the persistence layer. Guest settlements remain ephemeral on the order summary, which matches the model where guests are temporary participants who don't persist into group balances.

## Order display
- New helper `src/utils/itemShares.ts` formats share labels:
  - Equal split: `"bodz, Guest 1"` (clean, implies equal)
  - Custom split: `"bodz 60%, Guest 1 40%"` (percentages explicit)
- Used in three places: Order item list, Finalize Bill prices, Order Summary.
- Who Pays Who row now stacks vertically (names on one row with `flexWrap`, amount aligned `flex-end` underneath) so long names don't overlap the EGP amount on narrow screens.

## Tests / quality
- 52 unit tests passing (47 → 52: added 4 custom-split tests + 1 guest-screenshot regression, kept the rest including the rewritten guest suite).
- `tsc --noEmit` clean.

## Build / submission
- Two earlier EAS builds were cancelled (one without `--auto-submit`, one because `eas.json` was missing `ascAppId`). Recorded `ascAppId 6762308340` permanently in `eas.json`, `06-operations/deployment.md`, and Claude memory.
- Final resubmission build uses `eas build --platform ios --profile production --auto-submit --non-interactive`.

## Process notes
- Added `CLAUDE.md` with strict git rule: never commit/push without explicit per-action permission. Auto mode does not relax this. Triggered after two slips where files were committed automatically.
- Brainstorming gate enforced for the Custom split feature; spec was written and approved before implementation.

## Next Steps
- Wait for Apple review of build 12 (or whatever auto-submit lands).
- Update App Store Connect Support URL to the GitHub Pages support.html before re-submitting.
- Follow-up task: assignment-editing in the Edit Item modal (currently only name + price), which would also bring Custom split to edit.
