# ADR-001: Supabase for Backend

## Status
Accepted

## Context
Need a backend that provides auth, database, realtime, and ideally edge functions — without managing servers.

## Decision
Use Supabase as the entire backend.

## Consequences
**Pros:**
- Single platform for auth, database, realtime, storage, edge functions
- RLS enforces security at the DB layer
- Postgres-native (no ORM, just SQL)
- Cloud-hosted, low ops
- Local dev via `supabase start` (Docker)

**Cons:**
- Vendor lock-in to Supabase specifics (RPC functions, RLS syntax)
- Limited customization vs self-hosted backend
- Realtime has its own quirks

## Alternatives Considered
- **Firebase** — rejected due to NoSQL (need relational for ledger) and Google lock-in
- **Custom Node.js + Postgres** — rejected due to ops burden
- **PocketBase** — rejected due to immaturity for mobile
