# TradeX AI - Provider Setup & Configuration Guide (\docs/AI_SETUP.md\)

This guide outlines setup instructions for running TradeX AI completely free or with local inference on standard developer hardware. **No paid API keys are required to run the full application.**

---

## 1. Zero-Cost Architecture Overview

TradeX AI supports a multi-provider pluggable inference layer with automatic fallback:

| Provider | Type | Memory / Hardware | Cost | Best For |
| :--- | :--- | :--- | :--- | :--- |
| **Demo AI (\mock\)** | In-Memory Deterministic | 0 MB overhead | \.00 | Immediate onboarding, offline CI, zero dependencies |
| **Ollama (\ollama\)** | Local Offline Inference | 2GB - 4GB RAM | \.00 | Complete data privacy, edge deployments, offline testing |
| **OpenRouter (\openrouter\)**| Free Cloud Tier | Cloud | \.00 | Llama 3.1 8B, Qwen 2.5 7B free-tier access |
| **Groq (\groq\)** | High-Speed Cloud | Cloud | Free Tier | Ultra-low latency responses with rate-limit tracking |
| **Gemini (\gemini\)** | Google Cloud AI | Cloud | Free Quota | Google Gemini 1.5 Flash models (optional) |
| **Anthropic (\nthropic\)** | Claude 3.5 Sonnet | Cloud | Commercial | Enterprise production deployments (optional) |

---

## 2. Option A: Default Demo AI (No Setup Required)

TradeX AI defaults to \AI_PROVIDER=mock\.
- **Requires zero keys or downloads.**
- Generates realistic, domain-grounded B2B procurement data, landed cost matrices, shipment tracking telemetry, and RAG answers.
- Every response generated via this mode is transparently badged with \Demo AI\.

---

## 3. Option B: Local Inference with Ollama (Recommended Free & Offline)

Run open-source models completely offline with zero data leaving your machine.

### Step 1: Install Ollama
- **Windows / macOS**: Download and install the native installer from [ollama.com](https://ollama.com/download).
- **Linux / WSL**:
  \\ash
  curl -fsSL https://ollama.com/install.sh | sh
  \
### Step 2: Download Recommended Low-Footprint Models
For laptops and machines with 8 GB to 16 GB of RAM, the \qwen2.5:3b\ or \qwen2.5:1.5b\ models deliver exceptional B2B trade understanding:
\\ash
# Pull Qwen 2.5 3B (requires ~2.2 GB VRAM / RAM)
ollama pull qwen2.5:3b

# Optionally pull local embedding model
ollama pull nomic-embed-text
\
### Step 3: Configure Environment Variables
Set the following in your \.env\:
\\env
AI_PROVIDER=ollama
AI_MODEL=qwen2.5:3b
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_PROVIDER=mock
EMBEDDING_DIM=1536
\
If Ollama is stopped or unavailable, the built-in **Circuit Breaker** automatically transitions to \MockProvider (Demo AI)\ so the application never crashes.

---

## 4. Option C: OpenRouter Free Models

Access open models hosted in the cloud with free tier quotas.

1. Create a free account at [openrouter.ai](https://openrouter.ai/).
2. Obtain your free API key at \https://openrouter.ai/keys\.
3. Configure \.env\:
   \\env
   AI_PROVIDER=openrouter
   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx
   OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
   \
---

## 5. Option D: Groq High-Speed Inference

Groq provides free developer rate limits with near-instant token generation.

1. Sign up at [console.groq.com](https://console.groq.com/).
2. Create an API key in the API Keys section.
3. Configure \.env\:
   \\env
   AI_PROVIDER=groq
   GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
   GROQ_MODEL=llama-3.1-8b-instant
   \
---

## 6. Option E: Google Gemini Free Tier

1. Generate a free API key at [Google AI Studio](https://aistudio.google.com/).
2. Configure \.env\:
   \\env
   AI_PROVIDER=gemini
   GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxx
   GEMINI_MODEL=gemini-1.5-flash
   \
---

## 7. Vector Database & Embedding Dimensions

TradeX AI stores vector embeddings in PostgreSQL using the \pgvector\ extension:
- Column dimension: \Vector(1536)- \EMBEDDING_DIM=1536- The default \MockProvider\ and \OllamaProvider\ normalize vectors to exactly 1536 dimensions, ensuring clean database indexing and cosine distance calculations (\<->\).

---

## 8. Admin Diagnostics & Telemetry

Platform administrators can verify the live AI setup at \/admin\ under the **AI Diagnostics** tab:
- **Active Provider & Model**: Confirms runtime engine without leaking secrets.
- **Circuit Breaker Telemetry**: Live tracker for success, failure, and HTTP 429 rate-limit counts.
- **Live Ping Test**: Click **Test AI Connection** to test round-trip latency.

---

## 9. Multi-Provider Priority & Automatic Fallback (Prompt 21)

TradeX AI supports automatic multi-provider fallback using AI_PROVIDER_PRIORITY. The system tries configured providers in order, handling timeouts, bounded retries (up to 2), rate limits (HTTP 429), and circuit breaker failures before falling back to next provider, and finally to mock (Demo AI):

`env
AI_PROVIDER_PRIORITY=groq,openrouter,ollama,gemini
`

### Docker Ollama Configuration
When running backend inside Docker Compose and Ollama natively on Windows or macOS host:
`env
OLLAMA_BASE_URL=http://host.docker.internal:11434
`

### Verification with make ai-check
Test active provider connectivity and latency from the terminal:
`ash
make ai-check
# or inside docker:
docker compose exec backend python -m app.cli ai-check
# or reindex RAG catalogue:
make reindex
`
