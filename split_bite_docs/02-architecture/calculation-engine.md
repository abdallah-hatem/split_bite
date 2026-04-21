# Calculation Engine

Location: `src/utils/calculations.ts`

## Purpose
Takes order data (items, shares, payments, fees) and returns who owes who.

## Algorithm

### Step 1: Items Sum
Sum all items: `Σ(price × quantity)`.

### Step 2: Adjustment Ratio
`baseTotal = actualTotal - tax - vat - delivery + discount`
`adjustmentRatio = baseTotal / itemsSum`

Usually 1.0 since total validation enforces items + fees = actual total.

### Step 3: Per-Participant Item Cost
For each included participant, sum `Σ(item.price × quantity × shareFraction)` across items they share.

### Step 4: Fee Distribution
Each participant's proportion of adjusted items determines their share of:
- Tax
- VAT
- Delivery
- Discount (subtracted)

`totalOwed = adjustedTotal + taxShare + vatShare + deliveryShare - discountShare`

### Step 5: Rounding Fix
After rounding each participant's share, distribute residual cents to the largest share so totals sum exactly to `actualTotal`. Rounding is to nearest 0.5 EGP.

### Step 6: Apply Payments
`net = totalPaid - totalOwed`
- `net > 0` → gets money back
- `net < 0` → owes money
- `net = 0` → settled

### Step 7: Guest Debt Transfer
For each guest with a `hostUserId`:
1. Track the guest's net separately as a guest settlement
2. Transfer the guest's net to the host's net (for inter-user debt computation)
3. Zero out the guest's net

This way:
- Inter-user debts account for guest costs charged to host
- Guest settlement lines show when host owes guest or vice versa (when guest pays)

### Step 8: Minimize Transactions
Greedy matching: largest creditor with largest debtor, transfer `min(credit, debt)`, repeat until all balances settled.

### Step 9: Add Guest Settlements
Guest↔host settlements are added as debts with `guest:id` prefix for display only (never written to ledger).

## Key Design Decisions

- **Rounding to 0.5** — cleaner amounts for Egyptian market, less friction than cents
- **Guest payments as settlements** — guests can pay, creating host-guest settlements
- **Validation enforced** — items + fees must equal actualTotal before finalization
- **Deterministic** — same inputs always produce same outputs (46+ unit tests)

## Tests
`__tests__/unit/utils/calculations.test.ts` — 35 tests covering:
- Basic splits, shared items, delivery/tax/VAT/discount
- Multi-payer, guest handling, rounding, real-world scenarios
