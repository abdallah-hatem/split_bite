# 2026-04-13 - Project Kickoff

## Summary
Initialized the SplitBite project from scratch. Set up the full foundation including Expo project scaffolding, Supabase initialization, authentication flow, database schema, and test infrastructure.

## What Was Done
1. **Project Scaffolding**
   - Created Expo project with tabs template (SDK 54)
   - Installed all dependencies (Supabase, TanStack Query, SecureStore, etc.)
   - Installed test dependencies (Jest, RNTL, MSW, jest-expo)

2. **Supabase Setup**
   - Initialized Supabase project (`supabase init`)
   - Created comprehensive initial migration with all 11 tables
   - Created RLS policies for all tables
   - Supabase client configured with SecureStore auth adapter

3. **App Structure**
   - Root layout with AuthProvider + QueryProvider
   - Auth screens (sign-in, sign-up) with full form validation
   - Tab navigation (Groups, Activity, Profile)
   - Groups tab with Create/Join/Detail screens
   - Profile screen with sign out

4. **Testing Infrastructure**
   - Jest configured with jest-expo preset
   - Test setup file with mocks for Supabase, Expo Router, SecureStore
   - MSW server setup for API mocking
   - Test scaffolds for calculation engine (40+ todo tests)
   - Test scaffolds for settlement algorithm (10+ todo tests)

5. **Obsidian Vault**
   - Created vault structure with all directories
   - Dashboard, templates, architecture docs

## Decisions Made
- Using EGP as default currency (Egyptian market focus)
- Supabase client uses SecureStore on native, localStorage on web
- Tab structure: Groups (primary), Activity, Profile
- All RLS policies written upfront to avoid security gaps

## Next Steps
- Connect to a Supabase cloud project (set env vars)
- Test auth flow end-to-end on device/simulator
- Begin Phase 2: Groups (hooks, real data, invite system)
