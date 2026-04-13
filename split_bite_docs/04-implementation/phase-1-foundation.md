# Phase 1: Foundation

## Status: In Progress
**Target:** Days 1-3

## Checklist
- [x] Scaffold Expo project with tabs template
- [x] Install all dependencies (app + test)
- [x] Initialize Supabase (`supabase init`)
- [x] Create Supabase client with SecureStore adapter (`src/lib/supabase.ts`)
- [x] Create AuthProvider (`src/providers/AuthProvider.tsx`)
- [x] Create QueryProvider (`src/providers/QueryProvider.tsx`)
- [x] Build root layout with providers
- [x] Build auth screens (sign-in, sign-up)
- [x] Create initial migration (all tables + triggers)
- [x] Create RLS policies migration
- [x] Configure Jest with jest-expo preset
- [x] Set up test mocks (Supabase, Expo Router, SecureStore)
- [x] Create test scaffolds for calculations + settlement
- [ ] Connect to Supabase cloud project (env vars)
- [ ] Run migrations on cloud
- [ ] Test auth flow end-to-end
- [ ] Set up Expo dev client

## Key Files Created
- `src/lib/supabase.ts` — Supabase client
- `src/lib/constants.ts` — Design tokens
- `src/providers/AuthProvider.tsx` — Auth context
- `src/providers/QueryProvider.tsx` — TanStack Query
- `app/_layout.tsx` — Root layout
- `app/auth/sign-in.tsx` — Sign in screen
- `app/auth/sign-up.tsx` — Sign up screen
- `supabase/migrations/00001_initial_schema.sql`
- `supabase/migrations/00002_rls_policies.sql`
- `jest.config.ts`
- `__tests__/setup.ts`

## Notes
- Default currency set to EGP
- Invite codes are 10-char hex strings from gen_random_bytes
- Profile auto-created from email prefix on signup
