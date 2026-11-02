# ADR 0004: PostgreSQL as the Single Authoritative Source of Truth

## Status
Accepted

## Context
A major integrity risk in AI-augmented enterprise applications is data synchronization drift between vector index caches, in-memory caches, and persistent relational storage:
- Stale cached price tiers or stock counts presented in chat could lead to invalid RFQs, disputed purchase orders, or contract breach.
- Seeded scale numbers (e.g., total suppliers, shipments, country coverage) displayed on home dashboards must not be static mock numbers unbacked by actual database records.

## Decision
We established PostgreSQL as the sole, non-negotiable source of truth across all TradeX surfaces:
1. **Dynamic Dashboard Metrics**:
   - The Home Dashboard KPIs (active suppliers, buyers, active shipments, trading countries) and supplier leaderboards are computed via optimized SQL aggregate queries and database views.
   - If seeded scale data is active, the interface explicitly badges the metrics as *"Demo network"*.
2. **Transactional Data Integrity**:
   - Live inventory, tier pricing, MOQ, and supplier verification status displayed in AI Search, AI Mode, and AI Copilot cards are populated directly from relational joins against `products`, `users`, and `suppliers` tables.
   - Verification badges (e.g., *Gold Verified*, *Silver Verified*, *Basic Registered*) are driven by active database records and verification tier criteria, never hardcoded.
3. **Optimistic Locking & State Transitions**:
   - RFQ and Order lifecycles enforce database-level state machine validations (e.g., `draft` -> `submitted` -> `quoted` -> `ordered` -> `in_transit` -> `delivered`).

## Consequences
### Positive
- Strict auditability: Every metric displayed to a buyer, supplier, or auditor maps directly to persistent relational rows.
- Data consistency across Search, Cart, RFQ drafting, Order fulfillment, and Analytics.
- Safe concurrency and conflict resolution.

### Negative
- Requires continuous optimization of SQL query plans, composite indexes, and periodic database vacuuming under heavy write loads.
