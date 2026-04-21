# ADR-002: Guest Participant Model

## Status
Accepted

## Context
We want group members to add people to an order who don't have app accounts (friends, one-time participants). How should their debts be handled?

## Decision
Guests are stored as DB rows in a `guests` table linked to a `host_user_id` (the real user who added them). In calculations:

1. Guest items are tallied as normal
2. Guest's net is transferred to the host in the persistent ledger
3. Additionally, guest-host settlements are computed separately when the guest pays (e.g., if the guest paid cash to the restaurant, the host owes the guest back)

## Consequences
**Pros:**
- No need for guest accounts
- Host is responsible for guest debts to the rest of the group
- Guest payments reduce host's liability
- Clean ledger (only real users)

**Cons:**
- Guest-host settlements are tracked in-memory only, not persisted to the ledger
- If a guest later becomes a real user, we'd need a manual claim flow (not implemented)

## Alternatives Considered
- **No guests, require accounts** — too high friction
- **Anonymous accounts** — creates account spam
- **Split guest debt proportionally among group** — less intuitive
