# Product Requirements Document

## One-Line Summary
A group-based ordering system with real-time collaboration, guest support, and a persistent debt ledger that automatically tracks and settles balances across multiple orders.

## Core Concept
A mobile app where users:
- Create groups (friends, coworkers, etc.)
- Start collaborative orders
- Add items in real-time
- Handle payments (single or multiple payers)
- Automatically track persistent debts within each group

The system behaves like a **shared wallet per group**, not just per order.

## Core Entities
1. **Users** - Registered accounts, can join multiple groups
2. **Groups** - Persistent collection of users with running debt ledger
3. **Orders** - Temporary events inside groups that update the ledger
4. **Participants** - Registered users OR guests (temporary, linked to host)

## Key Principles
- Payments = source of truth
- Items = flexible input
- One owner ensures accuracy
- Guests are mapped to real users
- Ledger is persistent across orders
- System minimizes user effort

## MVP Scope
See [[mvp-scope]] for detailed MVP feature list.
