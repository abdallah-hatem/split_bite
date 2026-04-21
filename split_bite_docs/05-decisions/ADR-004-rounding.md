# ADR-004: Round to Nearest 0.5 EGP

## Status
Accepted

## Context
Bill splitting produces fractional amounts like 16.67 EGP. These are awkward for real-world cash payments in Egypt (where sub-pound coins are rare).

## Decision
All amounts in the calculation engine and settlements round to the nearest 0.5 EGP:
- 1.1 → 1.5
- 1.4 → 1.5
- 1.6 → 2.0
- 3.3 → 3.5
- 3.7 → 4.0

Implemented via `round2(n) = Math.round(n * 2) / 2`.

The rounding-fix step ensures the total still matches `actualTotal` by distributing residual amounts (0.5 EGP steps) to the largest share.

## Consequences
**Pros:**
- Cleaner amounts (e.g., "Owes 17 EGP" instead of "Owes 16.67 EGP")
- Easier cash handling for Egyptian market
- Still precise enough (0.5 EGP ≈ $0.015 USD)

**Cons:**
- Rounding errors can accumulate on large orders (mitigated by rounding-fix step)
- Less accurate for non-Egyptian currencies (but app is EGP-first)

## Alternatives Considered
- **Round to 0.01** — too granular, messy cash payments
- **Round to 1.0** — too coarse, accuracy loss
- **No rounding** — floating point errors, messy display
