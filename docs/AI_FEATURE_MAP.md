# TradeX AI - Comprehensive AI Feature Map (Prompt 40)

Every AI capability across the TradeX platform connects to the single unified inference service layer (`app.ai`) powered by Groq models (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `llama-3.2-11b-vision-preview`) with automatic deterministic fallback (`MockProvider`).

Zero hardcoded mock strings or second integrations exist in user-facing endpoints. Every feature adheres to:
1. Grounded strictly in database rows and trade records.
2. Formatted as validated Pydantic JSON schemas.
3. Explicitly labeled `'AI generated'` (or `'AI generated (Advisory only - Human decides)'` for admin moderation).
4. Persisted only upon explicit user confirmation.

---

## 1. Unified AI Feature Matrix

| # | Domain | Feature Name | API Endpoint | Prompt Template | Primary Provider & Model | Fallback Strategy | Status |
|---|---|---|---|---|---|---|---|
| 1 | Buyer | AI Search (Extract & Match) | `POST /api/v1/search/ai` | `search_extract.v1.txt` | Groq (`llama-3.1-8b-instant`) | Deterministic Rule Fixture Engine | **Live** |
| 2 | Buyer | AI Mode Natural Language Sourcing | `POST /api/v1/ai-mode/chat` | `search_extract.v1.txt` | Groq (`llama-3.1-8b-instant`) | Deterministic Sourcing Engine | **Live** |
| 3 | Buyer | AI Trade Copilot & RAG Guidance | `POST /api/v1/copilot/chat` | `copilot_system.v1.txt` | Groq (`llama-3.3-70b-versatile`) | Vector/Keyword Knowledge Retrieval | **Live** |
| 4 | Buyer | RFQ Contract Generator | `POST /api/v1/rfqs/generate` | `rfq_generate.v1.txt` | Groq (`llama-3.3-70b-versatile`) | Structured RFQ Fallback Schema | **Live** |
| 5 | Buyer | Supplier Match & Audit Explanation | `POST /api/v1/suppliers/match` | `supplier_match_explain.v1.txt` | Groq (`llama-3.1-8b-instant`) | Deterministic Trust Audit Evaluator | **Live** |
| 6 | Buyer | Quote Comparison Recommendation | `POST /api/v1/rfqs/{id}/comparison/ai` | `quote_compare.v1.txt` | Groq (`llama-3.3-70b-versatile`) | Deterministic Landed-Cost Matrix | **Live** |
| 7 | Buyer | Negotiation & Deal Assist in Messages | `POST /api/v1/ai/negotiation/assist` | `negotiation_assist.v1.txt` | Groq (`llama-3.3-70b-versatile`) | Margin & Volume Trade Evaluator | **Live** |
| 8 | Buyer | Product Detail AI Summary | `GET /api/v1/products/{id}/ai-summary` | `product_summary.v1.txt` | Groq (`llama-3.1-8b-instant`) | Specification Quality Evaluator | **Live** |
| 9 | Buyer | Shipment Delay-Risk Narrative | `POST /api/v1/ai/shipments/{id}/summary` | `shipment_summary.v1.txt` | Groq (`llama-3.1-8b-instant`) | Maritime Telemetry Simulator | **Live** |
| 10 | Buyer | Analytics Market Insights | `POST /api/v1/analytics/insights` | `market_insight.v1.txt` | Groq (`llama-3.3-70b-versatile`) | Commodity Demand Index Math Engine | **Live** |
| 11 | Supplier | Product Listing Copywriter | `POST /api/v1/supplier/ai/generate-listing` | `listing_writer.v1.txt` | Groq (`llama-3.3-70b-versatile`) | Export Catalog Specification Drafter | **Live** |
| 12 | Supplier | Inquiry Reply Generator | `POST /api/v1/supplier/ai/reply-draft` | `inquiry_reply.v1.txt` | Groq (`llama-3.1-8b-instant`) | B2B Commercial Proforma Drafter | **Live** |
| 13 | Supplier | Profile Completeness Tips | `GET /api/v1/supplier/ai/profile-tips` | `profile_tips.v1.txt` | Groq (`llama-3.1-8b-instant`) | Storefront Audit & Gap Analysis | **Live** |
| 14 | Supplier | RFQ Opportunity Assessment | `GET /api/v1/supplier/rfqs/{id}/ai-summary` | `rfq_opportunity.v1.txt` | Groq (`llama-3.3-70b-versatile`) | Capacity & Port Alignment Evaluator | **Live** |
| 15 | Documents | Trade Document OCR & Extraction | `POST /api/v1/documents/{id}/extract` | `doc_extract.v1.txt` | Groq (`llama-3.2-11b-vision-preview` / `llama-3.3-70b-versatile`) | Rule-based Trade Entity Extractor | **Live** |
| 16 | Admin | Flagged Content Moderation Summary | `POST /api/v1/admin/moderation/ai-summary` | `moderation_summary.v1.txt` | Groq (`llama-3.3-70b-versatile`) | Trade Policy Compliance Checker | **Live** |

---

## 2. Guardrails & Platform Protections

1. **Multi-Company Data Isolation**: Tenant IDs and company IDs are strictly isolated. No counterparty can access another enterprise's trade negotiation history, private pricing, or draft documents.
2. **PII Redaction**: Email addresses, phone numbers, and identifying credentials are automatically scrubbed via `app.ai.privacy.sanitize_dict_pii` before sending payloads to upstream LLM APIs.
3. **Circuit Breaker**: Monitored via `app.ai.circuit_breaker.circuit_breaker`. If consecutive vendor timeouts or 429 rate limits exceed the failure threshold (default 3), the circuit breaker opens for 30 seconds and routes inference immediately to `MockProvider` ('Demo AI') without delaying client requests.
4. **Daily AI Budget**: Governed by `settings.AI_DAILY_BUDGET` (10,000 calls). When exhausted, all features gracefully fall back to deterministic responses with explicit logging.
5. **Feature Flags**: Each capability has an environment toggle (`AI_FLAG_SEARCH`, `AI_FLAG_COPILOT`, `AI_FLAG_LISTING_WRITER`, etc.) permitting hot disabling without downtime.
6. **Telemetry & Auditing**: Every invocation logs structured tokens, latency, provider, and fallback status to the `ai_logs` PostgreSQL table, visible on `/admin/ai/usage`.
