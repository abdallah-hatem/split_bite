# State Management

## Server State: TanStack Query v5

Location: `src/hooks/`

### Query Key Convention
```typescript
groupKeys.all                = ["groups"]
groupKeys.detail(id)         = ["groups", id]
groupKeys.members(id)        = ["groups", id, "members"]
orderKeys.all(groupId)       = ["orders", { groupId }]
orderKeys.detail(id)         = ["orders", id]
orderKeys.items(id)          = ["orders", id, "items"]
orderKeys.participants(id)   = ["orders", id, "participants"]
balanceKeys.group(groupId)   = ["balances", groupId]
```

### Defaults (QueryProvider)
- `staleTime: 30 seconds`
- `gcTime: 5 minutes`
- `refetchOnWindowFocus: false`

### Mutations
Each mutation:
1. Performs the Supabase query
2. Invalidates relevant query keys on success
3. Sometimes sends push notifications (non-blocking)

### Pagination
`useInfiniteQuery` with 10-15 items per page:
- `useOrders(groupId)` — group orders (10/page)
- `useActivityFeed()` — ledger entries (15/page)

## Real-time: Supabase Realtime

Location: `src/hooks/useRealtimeOrder.ts`

Used narrowly for:
- Live item changes on an open order
- Order status transitions

**Pattern:** Realtime events invalidate TanStack Query caches; they don't maintain parallel state.

## Client State

### Auth
`AuthProvider` in `src/providers/AuthProvider.tsx`:
- Subscribes to `supabase.auth.onAuthStateChange`
- Exposes `session`, `user`, `signUp`, `signIn`, `signOut`

### Reactive Redirect
`app/_layout.tsx` uses `useSegments()`:
- If unauthenticated and not in `auth/`, redirect to sign-in
- If authenticated and in `auth/`, redirect to groups

### Screen-local state
Managed with `useState`/`useReducer` per screen. No global store.

## Why No Global Store (Redux/Zustand)?

- TanStack Query handles all server state
- Supabase Realtime handles live updates
- Auth context handles session
- No remaining need for a global store
