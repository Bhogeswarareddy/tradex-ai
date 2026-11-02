# ADR 0001: Retrieval-Augmented Generation (RAG) for Trade Compliance & Knowledge

## Status
Accepted

## Context
Cross-border B2B trade involves complex, binding regulatory requirements:
1. International Commercial Terms (Incoterms 2020: FOB, CIF, DDP, EXW, CFR) allocating risks, freight costs, and insurance obligations between buyer and seller.
2. Customs clearance procedures, import/export duties, Harmonized System (HS) codes, and phytosanitary certificates for agricultural commodities.
3. Country-specific mandatory export/import documentation (e.g., Bill of Lading, Certificate of Origin, Commercial Invoice, Packing List, Fumigation Certificate).

Relying solely on parametric memory (unaugmented LLM generation) poses serious commercial and legal liabilities:
- Models frequently hallucinate statutory document lists, misattribute customs tariffs, or confuse buyer/seller risk transfer points under Incoterms.
- Trade regulations and phytosanitary standards evolve dynamically over time.

## Decision
We implemented a strict Retrieval-Augmented Generation (RAG) pipeline for all trade compliance, Incoterms, and logistics queries:
- Authoritative regulatory trade documents, Incoterms guides, and customs frameworks are chunked and embedded into high-dimensional vectors.
- User queries are analyzed by the trade knowledge router:
  - If a trade knowledge inquiry is detected, top-$k$ verified context chunks are retrieved based on cosine similarity with an explicit relevance threshold ($> 0.65$).
  - If the relevance threshold is not met, the system responds honestly: *"I could not find verified evidence in the Trade Knowledge Base"*, rather than speculating.
  - Retrieved chunks are presented in the response as clickable evidence source chips (document name, section, confidence score).
  - Answers are labeled with an explicit disclaimer: *"General guidance. Official verification needed for legal, tax, or customs compliance."*

## Consequences
### Positive
- Zero regulatory hallucinations on Incoterms and mandatory trade documentation.
- Verifiable provenance: Every statement cites an underlying authoritative document.
- Hybrid inquiries (e.g., *"500 kg rice from India to USA, what documents?"*) cleanly partition real catalogue search results from retrieved trade compliance requirements.

### Negative
- Adds a retrieval stage latency (~50-150ms vector query).
- Requires continuous indexing of new bilateral trade treaties and compliance frameworks.
