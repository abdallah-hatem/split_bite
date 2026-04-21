# 2026-04-21 - Apple Review Fixes

## Summary
Addressed Apple App Store review rejections: account deletion requirement and unresponsive tabs.

## What Was Done

### Apple Issue 1: Account Deletion (Guideline 5.1.1(v))
- Already implemented in Profile screen (previous session)
- Verified UI: Profile tab → scroll → Delete Account → double confirmation
- Server deletes auth user + all related data via `delete_user_account()` RPC

### Apple Issue 2: Unresponsive Activity/Profile Tabs (iOS 26.4.1)
Root cause: loading states could get stuck when user/session was momentarily null.

- Profile: `fetchProfile` now always calls `setLoading(false)` in finally block
- Activity: only shows spinner on initial load, not on refocus/refetch
- `useActivityFeed` gated on `enabled: !!user` with user-keyed query
- Push notifications wrapped in try/catch to prevent UI blocking

### Cloud Migration Fix
Cloud DB was missing `created_by default auth.uid()` on groups and orders.
Added migration 00006 to set the defaults on cloud.

## Session Notes
- Reminded user that groups can only be deleted by their creator (RLS)
- Multiple test accounts on cloud caused confusion about delete permissions

## Next Steps
- Wait for Apple review of new build
- Record screen video demonstrating account deletion flow
