# TradeX AI Inference Architecture and Setup Guide (Prompt 30)

This guide documents the enterprise AI inference infrastructure powering **AI Mode** (`/ai-mode`), **AI Search** (`/search`), and the **Trade Copilot** (`/copilot` and floating drawer).

---

## 1. Single Brain Architecture

All AI capabilities share a single unified orchestrator in `backend/app/ai/`:
- **Primary Inference Provider**: Groq Cloud High-Speed Inference (`AI_PROVIDER=groq`)
- **Configurable Models**:
  - `AI_MODEL`: Default platform model (e.g. `qwen/qwen3.8-27b`)
  - `AI_MODEL_INTENT`: Dedicated model for JSON intent & criteria extraction
  - `AI_MODEL_ANSWER`: Dedicated model for grounded answer generation
- **Prioritized Fallback Chain**: `AI_PROVIDER_PRIORITY=groq,ollama`
- **Real Health Probing**: Header badges query live inference probes cached for 30s (`Connected`, `Disconnected`, `Rate limited`, `Demo AI`).
- **Footer Observability**: Every response records `provider`, `model`, `is_demo`, `latency_ms`, and `fallback_reason`.

---

## 2. Groq Cloud Setup (Primary Provider)

### 2.1 Configuration in `.env`
Add the following variables to `.env` (never commit `.env` or expose the key):
```env
AI_PROVIDER=groq
GROQ_API_KEY=gsk_...
AI_MODEL=qwen/qwen3.8-27b
AI_MODEL_INTENT=qwen/qwen3.8-27b
AI_MODEL_ANSWER=qwen/qwen3.8-27b
AI_TIMEOUT_SECONDS=30.0
AI_PROVIDER_PRIORITY=groq,ollama
```

### 2.2 How to Pick a Current Model from Groq Console
Groq frequently updates active model IDs. To query the available models for your API key:
```bash
docker compose exec backend python -c "
import os, httpx, asyncio
async def list_models():
    async with httpx.AsyncClient() as c:
        r = await c.get('https://api.groq.com/openai/v1/models', headers={'Authorization': 'Bearer ' + os.getenv('GROQ_API_KEY')})
        for m in sorted([x['id'] for x in r.json().get('data', [])]):
            print(' -', m)
asyncio.run(list_models())
"
```
Select a fast, large instruction-tuned model currently listed in your console (e.g. `qwen/qwen3.8-27b`, `openai/gpt-oss-120b`).

### 2.3 Rate Limit Handling & Backoff
If Groq returns HTTP 429, TradeX AI performs a short exponential backoff (0.5s) and retries once. If rate limits persist, it gracefully falls back to the next priority provider (Ollama or Demo AI) and records `fallback_reason = "Groq rate limited (HTTP 429)"`.

---

## 3. Switching to OpenRouter

To route completions through OpenRouter:
1. Obtain an OpenRouter API key from [openrouter.ai](https://openrouter.ai).
2. Configure `.env`:
```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
AI_PROVIDER_PRIORITY=openrouter,groq,ollama
```
3. Restart containers:
```bash
docker compose up -d backend worker
```

---

## 4. Local Ollama (Emergency Fallback)

> [!WARNING]
> The small local model `qwen2.5:3b` is designed strictly as an **emergency offline fallback** when internet access is unavailable. It should not be used as the primary production provider due to limited reasoning capacity for complex trade finance.

### 4.1 Prerequisites
1. Install Ollama locally and pull the fallback model:
```bash
ollama run qwen2.5:3b
```
2. Verify available models:
```bash
ollama list
```
3. In Docker on Windows/macOS, access Ollama on the host via `http://host.docker.internal:11434`.

---

## 5. Model Evaluation (`make ai-eval`)

TradeX AI includes an automated benchmark evaluating intent classification across 32 trade utterances in `tests/fixtures/ai_utterances.json`:
- Greetings & small talk
- Laptops & electronics
- Mobile phones
- Tractors & agricultural machinery
- Spices (chilli, turmeric, cardamom)
- Typo and trade synonym queries
- Multi-turn follow-ups ("only from China", "compare the first two")
- Authoritative stock questions ("is it in stock?", "units available?")
- Absent products ("OPPO phones", "diamond rings")

### Running the Evaluation
```bash
make ai-eval
```
The model must achieve at least **90% accuracy** to pass acceptance criteria.
