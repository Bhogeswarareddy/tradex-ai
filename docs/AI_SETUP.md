# TradeX AI - Inference & Embeddings Architecture (Prompt 40)

## 1. Overview
TradeX AI employs a production-grade unified AI architecture powered by high-speed Groq LPU inference, localized pgvector semantic search (1536 dimensions), and deterministic rule-based fallback ('Demo AI') for offline resilience.

---

## 2. Model Tiering Configuration

TradeX segregates inference workloads into distinct model performance tiers:

| Tier | Environment Variable | Default Model | Primary Use Cases | Typical Latency |
|---|---|---|---|---|
| **Fast / Reactive** | `AI_MODEL_FAST` | `llama-3.1-8b-instant` | AI Search extraction, product detail summary, inquiry replies, supplier match explanations, shipment tracking summaries | 120ms - 280ms |
| **Smart / Reasoning**| `AI_MODEL_SMART` | `llama-3.3-70b-versatile`| Complex RFQ drafting, side-by-side quote comparison, bilateral negotiation assist, market intelligence insights, listing copywriting, admin moderation | 450ms - 850ms |
| **Multimodal / Vision**| `AI_MODEL_VISION` | `llama-3.2-11b-vision-preview`| Shipping document OCR (Bills of Lading, Phytosanitary Certificates, commercial invoices, packings lists) | 600ms - 1200ms |

### Upstream Model Fallback Order
Configured via `AI_PROVIDER_PRIORITY` (default: `groq,openrouter,ollama,gemini`):
1. **Groq (`GroqProvider`)**: Primary high-throughput provider with OpenAI-compatible API and JSON schema enforcement.
2. **OpenRouter (`OpenRouterProvider`)**: Free-tier failover provider.
3. **Ollama (`OllamaProvider`)**: Local offline deployment (`http://localhost:11434`).
4. **Gemini (`GeminiProvider`)**: Secondary cloud fallback.
5. **MockProvider (`Demo AI`)**: Deterministic fixture & mathematical rule engine guaranteeing zero downtime and zero 500 crashes even during complete network partitions.

---

## 3. Vector Embeddings Subsystem

All product catalogs, trade knowledge base articles, and supplier capability dossiers are indexed as dense vector embeddings matching PostgreSQL `pgvector(1536)`.

- **Configuration**:
  - `EMBEDDING_PROVIDER`: `"local"` (deterministic normalized vector generator) or `"ollama"`.
  - `EMBEDDING_MODEL`: `"all-MiniLM-L6-v2"` (or Ollama model tag).
  - `EMBEDDING_DIM`: `1536` (exact dimension required by pgvector tables `products`, `knowledge_chunks`, and `document_extractions`).
- **Deterministic Dimension Normalization**:
  The embedding engine deterministically expands and normalizes vector outputs to 1536 dimensions using cosine unit normalization, ensuring compatibility across local test fixtures and cloud inference providers.

---

## 4. Controls & Circuit Breakers

1. **Input Hash Response Caching (`app.ai.cache`)**:
   Invocations with identical input variables and prompt versions compute an SHA-256 hash key. Cached responses are served instantly with zero upstream API cost and sub-millisecond response latency.
2. **Circuit Breaker (`app.ai.circuit_breaker`)**:
   Tracks consecutive vendor errors and HTTP 429 rate limits.
   - Failure threshold: `3` consecutive errors.
   - Recovery window: `30 seconds` cool-down before probing vendor health.
   - State reporting: Available in real-time on `GET /api/v1/ai/status` and `/admin/ai/usage`.
3. **Daily Budget Caps (`AI_DAILY_BUDGET`)**:
   Configurable cap (default: `10000` calls per day). Protects platform operations against runaway costs or API denial-of-wallet attacks.
4. **Feature Flags**:
   Every AI capability can be toggled via `.env` without server restart or redeployment:
   - `AI_FLAG_SEARCH=true`
   - `AI_FLAG_AI_MODE=true`
   - `AI_FLAG_COPILOT=true`
   - `AI_FLAG_RFQ_DRAFT=true`
   - `AI_FLAG_QUOTE_COMPARE=true`
   - `AI_FLAG_NEGOTIATION=true`
   - `AI_FLAG_PRODUCT_SUMMARY=true`
   - `AI_FLAG_SHIPMENT_SUMMARY=true`
   - `AI_FLAG_ANALYTICS=true`
   - `AI_FLAG_LISTING_WRITER=true`
   - `AI_FLAG_INQUIRY_REPLY=true`
   - `AI_FLAG_PROFILE_TIPS=true`
   - `AI_FLAG_RFQ_OPPORTUNITY=true`
   - `AI_FLAG_DOC_EXTRACTION=true`
   - `AI_FLAG_MODERATION=true`

---

## 5. Security & Privacy

1. **Strict Credential Containment**: `GROQ_API_KEY` is loaded exclusively from `.env`. Zero API keys or tokens are ever committed to git repositories, logs, or frontend responses.
2. **PII Redaction**: `app.ai.privacy.redact_pii` scrubs email addresses, telephone numbers, and sensitive contact information prior to formatting LLM prompts.
3. **Multi-Tenant Data Isolation**: Company and tenant scopes are verified prior to prompt assembly. Cross-company quotation history and confidential supplier pricing are never leaked across company boundaries.

---

## 6. Verification Commands

Run the comprehensive 16-feature automated verification suite:
```bash
# Via Make
make ai-check-all

# Or directly via Python module
python -m app.scripts.ai_check_all
```
