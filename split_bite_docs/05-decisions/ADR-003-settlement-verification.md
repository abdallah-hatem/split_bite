# ADR-003: Settlement Verification

## Status
Accepted

## Context
When one user settles up with another, how do we ensure the beneficiary actually received the money before zeroing out the debt?

## Decision
Two-step settlement flow:

1. **Payer initiates**: creates a row in `pending_settlements` (status='pending')
2. **Beneficiary notified**: push notification "X says they paid you $Y. Please confirm."
3. **Beneficiary acts**: tapping notification opens balances screen with Confirm/Reject buttons
4. **On confirm**: creates a reverse `ledger_entries` row that cancels the original debt
5. **On reject**: payer is notified, can try again

## Consequences
**Pros:**
- Prevents one-sided settlement claims
- Creates trust in the debt system
- Clear audit trail (pending → confirmed/rejected)

**Cons:**
- Extra friction vs one-tap settlement
- Requires beneficiary to have the app open / notifications enabled

## Alternatives Considered
- **Immediate settlement** — too easy to abuse, no verification
- **Manual confirmation in app** (no notifications) — misses time-sensitive settlements
- **Payment integration (InstaPay/Vodafone Cash)** — deferred to future; doesn't work for cash
