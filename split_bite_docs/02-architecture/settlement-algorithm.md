# Settlement Algorithm

Location: `src/utils/settlement.ts`

## Purpose
Given a set of ledger entries, compute the minimum number of transactions to settle all debts.

## Algorithm

### computeNetBalances(entries)
1. For each entry (`from → to = amount`):
   - `balance[from] -= amount`
   - `balance[to] += amount`
2. Filter out zero balances (|balance| < 0.25)

### optimizeSettlements(balances)
Greedy approach:
1. Split into **creditors** (positive) and **debtors** (negative)
2. Sort both by amount descending
3. Repeat:
   - Take largest creditor and largest debtor
   - Transfer `min(credit, debt)` from debtor to creditor
   - Remove any that reach zero
4. Stop when either list is empty

Result: at most `n-1` transactions for `n` people.

## Example

**Balances:**
- A: -30 (owes 30)
- B: -20 (owes 20)
- C: +50 (owed 50)

**Steps:**
1. C (50) ↔ A (30) → A pays C 30. C now at 20.
2. C (20) ↔ B (20) → B pays C 20. Both at 0.

**Result:** 2 transactions.

## Where It's Used
- **Balances screen** — shows pairwise "who owes who" with settle-up button
- **Calculation engine** — computes order debts in the finalize preview
- **Order summary** — shows settlements needed after finalization

## Tests
`__tests__/unit/utils/settlement.test.ts` — 11 tests:
- Two people, circular debts, already balanced
- One creditor many debtors, many creditors one debtor
- Large groups, floating point precision
