# SplitBite Dashboard

## Project Status
**Current Phase:** Phase 1 - Foundation
**Last Updated:** 2026-04-13

---

## Active Work
- [x] Project scaffolding (Expo + TypeScript)
- [x] Supabase initialization
- [x] Auth provider + Supabase client with SecureStore
- [x] Tab navigation (Groups, Activity, Profile)
- [x] Auth screens (Sign In, Sign Up)
- [x] Database schema migration (all tables)
- [x] RLS policies migration
- [x] Jest test setup
- [ ] Connect to Supabase cloud project
- [ ] Verify auth flow end-to-end

---

## Phase Overview
| Phase | Status | Description |
|-------|--------|-------------|
| 1. Foundation | In Progress | Auth, project setup, DB schema |
| 2. Groups | Not Started | Group CRUD, invite system |
| 3. Orders & Items | Not Started | Collaborative ordering, realtime |
| 4. Calculations | Not Started | Split engine, finalization, ledger |
| 5. Polish | Not Started | Balances, settlements, notifications |

---

## Quick Links
- [[01-requirements/PRD|Product Requirements]]
- [[02-architecture/overview|Architecture Overview]]
- [[02-architecture/database-schema|Database Schema]]
- [[04-implementation/phase-1-foundation|Phase 1 Details]]

---

## Recent Sessions
- [[Sessions/2026-04-13 - Project Kickoff|2026-04-13: Project Kickoff]]

---

## Tech Stack
- **Frontend:** Expo (React Native) + TypeScript
- **Backend:** Supabase (Auth, Postgres, Realtime, Edge Functions)
- **State:** TanStack Query + Supabase Realtime
- **Testing:** Jest, RNTL, MSW, pgTAP, Maestro
