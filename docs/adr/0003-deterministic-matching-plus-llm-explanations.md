# ADR 0003: Deterministic Matching Engine Combined with LLM Explanations

## Status
Accepted

## Context
A critical failure mode in early AI sourcing prototypes was **supplier & inventory hallucination**:
- LLMs prompted to find suppliers would fabricate non-existent company names, invent inventory quantities, or match unrelated companies (e.g., matching a spice exporter to an Apple iPhone inquiry based purely on semantic similarity to "export capacity").
- LLMs often invented filter constraints that the buyer never typed (e.g., hallucinating a "Lead Time: Within days" chip).

In B2B commerce, inventory figures, unit pricing, MOQs, and supplier identity must strictly reflect verifiable database records.

## Decision
We implemented a **two-tier hybrid architecture**:
1. **Tier 1: Deterministic Sourcing Engine (`SourcingEngine`)**:
   - The LLM's role in search is restricted to **structured intent parsing**: extracting target product entity, requested quantity, target unit, destination country, Incoterm, and stated price ceiling.
   - The actual product search is executed by deterministic PostgreSQL queries combining:
     - Negative token exclusion (e.g., queries for "rice" explicitly exclude "tea", "millet").
     - Product-type and synonym filtering (matching products against verified database listings and synonyms).
     - Quantity comparison against real live inventory (`stock >= requested_qty`).
   - If 0 products match the database criteria, 0 suppliers are returned. The supplier count strictly matches the distinct supplier count of the returned products.
2. **Tier 2: LLM Match Explanations**:
   - Once real products are fetched from the database, the LLM receives the concrete product and supplier records as factual context.
   - The LLM generates a concise, one-line justification explaining *why* the product meets the buyer's stated criteria (e.g., *"Meets 500 kg requirement with 2,400 kg in stock from certified Indian exporter"*).
   - If the LLM is unavailable or times out, a deterministic template-based explanation is returned with zero disruption to the user experience.

## Consequences
### Positive
- 100% elimination of fabricated suppliers and fictitious stock numbers.
- Unstated buyer constraints (such as lead time or destination) are never inserted as active filters, but instead surfaced as helpful follow-up suggestions.
- Clear separation between facts (database) and narrative synthesis (LLM).

### Negative
- Requires robust database schema indexing, synonym tables, and structured entity parsers.
