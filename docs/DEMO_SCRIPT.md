# TradeX AI: Official Demo Package & Viva Presentation Guide

This guide equips you to deliver a flawless, production-grade presentation of TradeX AI to investors, academic evaluators, and enterprise stakeholders.

---

## Part 1: The 2-Minute Elevator Pitch
> *"Cross-border B2B trade represents over \$35 trillion annually, yet it remains plagued by fragmented communication, opaque pricing, complex Incoterms compliance, and supplier discovery friction. Traditional marketplaces like Alibaba offer massive directories but zero transactional intelligence.*
>
> *TradeX AI changes this with the world's first **Deterministic-RAG Hybrid Sourcing Platform**. Unlike naive AI wrappers that hallucinate non-existent suppliers and prices, TradeX combines **strict database-as-source-of-truth matching** with **live LLM intelligence via Groq LLaMA-3.1**.
>
> *Buyers can state complex sourcing needs in natural language—like 'I need 20 MT organic turmeric powder with curcumin > 5% delivered to Hamburg under CIF'—and instantly receive verified suppliers with live stock, landed cost breakdowns, and automated compliance documents. From search to RFQ, multi-quote comparison, negotiation, and milestone tracking, TradeX orchestrates the entire international trade journey."*

---

## Part 2: The 10-Minute Walkthrough Click Path

### Step 1: Boot & Landing Page (0:00 - 1:30)
- **Action**: Launch application via `make demo` and navigate to `https://localhost` (or `http://localhost:5173`).
- **Showcase**:
  - The animated World Trade Map with glowing trade routes connecting major global logistics hubs (Mundra, Hamburg, Singapore, New York).
  - The live corridor ticker (*Mundra Port (IN) to Hamburg Port (DE)*).
  - Live platform KPIs showing real database aggregates with the *"Demo network"* badge.
  - Role-guided onboarding tour popup.

### Step 2: Global Command Palette (1:30 - 2:30)
- **Action**: Press `Ctrl+K` or `Cmd+K` anywhere in the app.
- **Showcase**:
  - Instant modal appearance with keyboard navigation.
  - Type `rice` to see categorized quick matches across Products, Suppliers, and Navigation routes.
  - Select *Landed Cost Calculator* to jump directly to the tool.

### Step 3: Natural Language AI Search (2:30 - 4:00)
- **Action**: Navigate to `/ai-search` and input:
  `"I need 500 kg basmati rice for shipment to Hamburg under CIF"`
- **Showcase**:
  - **Understood Requirement Card**: Shows extracted entity (`basmati rice`), quantity (`500 kg`), destination (`Germany`), and Incoterm (`CIF`).
  - **Zero Hallucination Guarantee**: Note that supplier count strictly matches the distinct suppliers of matching products. Unstated criteria (like lead time) are shown as follow-up suggestions, not phantom filters.
  - **Live Inventory Check**: Product card verifies whether supplier's stock meets the requested 500 kg.
  - **Verification Tiers**: Gold and Silver verification badges with inspection credentials.

### Step 4: AI Mode & Copilot with Trade Knowledge RAG (4:00 - 6:00)
- **Action**: Navigate to `/ai-mode` and test:
  1. Product inquiry: `"I need 20 Apple mobiles"` -> Returns exact Apple electronics listings.
  2. Follow-up: `"I need more help"` -> Contextually prompts next steps (price comparison or RFQ drafting).
  3. Knowledge inquiry: `"Explain FOB vs CIF and required documents to export rice to USA"` -> RAG pipeline returns verified Incoterms guidance with source document chips and official compliance disclaimer.

### Step 5: RFQ Creation & Quote Comparison (6:00 - 7:30)
- **Action**: Click *"Create RFQ"* from the matched product card.
- **Showcase**:
  - Auto-drafted specifications populated by AI.
  - Navigate to `/quotes/compare/:rfq_id`.
  - Side-by-side comparison matrix of supplier quotes with unit prices, lead times, payment terms, and AI Deal Assist recommendation.
  - Click *"Share Comparison"* to generate a cryptographically signed public link (`/shared/quotes/:token`).

### Step 6: Landed Cost Calculator (7:30 - 8:30)
- **Action**: Navigate to `/landed-cost`.
- **Showcase**:
  - Input product cost, origin port (IN MUN), destination (DE HAM), and shipping mode.
  - Interactive breakdown of FOB base, ocean freight, customs tariff (HS Code based), marine insurance, and port handling.

### Step 7: Advanced Trade Analytics (8:30 - 10:00)
- **Action**: Navigate to `/analytics`.
- **Showcase**:
  - Monthly sourcing volume trends, landed cost distribution pie chart, and the Supplier Performance Scorecard.

---

## Part 3: 12-Slide Presentation Outline

1. **Slide 1: Title & Vision**: *TradeX AI: Enterprise AI-Powered Cross-Border Trade Platform*.
2. **Slide 2: The Problem**: $35T B2B market crippled by communication silos, customs hurdles, and directory spam.
3. **Slide 3: The Solution**: Hybrid Deterministic-RAG Architecture combining conversational intelligence with database truth.
4. **Slide 4: System Architecture**: Multi-container topology (Alpine Nginx, React 18, FastAPI, PostgreSQL 16 + pgvector, Celery).
5. **Slide 5: Zero-Hallucination AI Search**: How structured entity extraction separates database facts from LLM narrative.
6. **Slide 6: Trade Compliance RAG**: Verifiable Incoterms 2020 and customs intelligence with source citations.
7. **Slide 7: Complete Trade Lifecycle**: From AI Discovery to RFQ, Negotiation, Orders, and Logistics Milestones.
8. **Slide 8: Financial Intelligence**: Landed Cost Calculator & Public Shareable Quote Comparisons.
9. **Slide 9: Security & Governance**: Strict RBAC (Buyer, Supplier, Admin), object-level authorization, and secret scanning.
10. **Slide 10: Scalability & Performance**: 1,500 products, 60 suppliers, < 200ms SQL execution, and 50-user load test verification.
11. **Slide 11: Production Hardening & CI/CD**: 10-stage Jenkins pipeline, Prometheus metrics, and automated rollback fast-path.
12. **Slide 12: Roadmap & Conclusion**: Live banking API integration, blockchain bill of lading, and future expansion.

---

## Part 4: Viva Voce Q&A Sheet (Examiner & Evaluator Defense)

### Q1: Why didn't you just let an LLM search the database using text-to-SQL?
> **Answer**: *"Text-to-SQL on an open B2B platform presents severe security vulnerabilities (SQL injection, accidental schema leakage) and unpredictable query structures that can bypass tenant isolation. Furthermore, LLMs frequently hallucinate join logic or fabricate where-clauses for complex cross-border logistics. We adopted a deterministic parsing layer where the LLM extracts structured intent entities into a strict schema, and parameterized, indexed SQL queries execute the match with 100% predictability."*

### Q2: What happens if Groq API goes down or hits rate limits during live trade negotiations?
> **Answer**: *"TradeX incorporates an automated Circuit Breaker pattern (`CircuitBreaker` in `backend/app/ai/circuit_breaker.py`). If Groq returns 429, 500, or times out beyond 20 seconds, the circuit opens and requests seamlessly fail over to our local deterministic rule-based engine. The UI remains fully functional, sets the honest badge `meta.ai_mode = 'demo'`, and returns real database products without interrupting the user."*

### Q3: How do you prevent suppliers from seeing competitor RFQ quotes?
> **Answer**: *"We enforce Object-Level Authorization in FastAPI dependencies (`app/core/permissions.py`). An authenticated supplier can only query quotes submitted by their own organization ID. Any attempt to read or modify another supplier's quote returns an immediate HTTP 403 Forbidden. This is enforced at the database query level and verified by our automated security test suite (`test_auth_and_rbac.py`)."*

### Q4: Why use pgvector in PostgreSQL instead of a specialized vector DB like Pinecone?
> **Answer**: *"Pinecone introduces distributed state: synchronizing deletions, updates, and transaction rollbacks between two separate databases creates eventual consistency issues. With `pgvector`, embeddings live directly inside our `products` and `knowledge_chunks` tables. We can execute hybrid queries that combine vector cosine similarity with relational filters (e.g. `stock >= requested_qty AND verified = true`) in a single ACID transaction."*

### Q5: What aspects of the system are simulated versus production-ready?
> **Answer**: *"All application layers—multi-container orchestration, PostgreSQL schemas, JWT authentication, RBAC, search indexing, Groq LLM inference, RAG retrieval, and UI workflows—are fully functional and production-grade. The external carrier API integrations (e.g. live Maersk vessel telemetry) and international banking wire confirmations are simulated through our state machine tracking engine for demonstration repeatability."*
