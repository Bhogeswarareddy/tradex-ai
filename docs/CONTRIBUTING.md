# Contributing to TradeX AI

Thank you for your interest in contributing to TradeX AI, the enterprise-grade AI-powered B2B cross-border trade platform!

## Code of Conduct
We adhere to professional standards of mutual respect, code excellence, and rigorous verification. Every contribution must include deterministic tests, documentation, and zero hardcoded secrets.

---

## Local Development Workflow

### Prerequisites
- Docker Engine 24+ & Docker Compose v2+
- Node.js 20+ & npm 10+
- Python 3.12+
- Git

### 1. Setup & Environment
```bash
git clone https://github.com/Bhogeswarareddy/tradex-ai.git
cd tradex-ai

# Setup environment configuration
cp .env.example .env

# Boot local containers & run migrations
make demo
```

### 2. Frontend Development
```bash
cd frontend
npm install
npm run dev      # Starts Vite dev server at http://localhost:5173
npm test         # Runs Vitest test suite
npm run lint     # Runs ESLint checks
npm run build    # Type-check and production bundle build
```

### 3. Backend Development
```bash
# Execute backend commands inside the Docker container
docker compose exec backend pytest app/tests/ -v
docker compose exec backend ruff check app
docker compose exec backend mypy app
```

---

## Branching & Commit Guidelines
- Use descriptive branch names: `feature/landed-cost-calculator`, `fix/supplier-matching-null-check`.
- Conventional Commits format:
  - `feat: add landed cost calculation engine`
  - `fix: resolve division by zero in quote comparison`
  - `docs: add ADR 0004 for single source of truth`
  - `test: add 50-user load testing script`

---

## Testing & Quality Gates
Every Pull Request must pass the following checks before merging:
1. **Frontend**: `npm test` (all Vitest suites pass) and `npm run build` (0 TypeScript / ESLint errors).
2. **Backend**: `pytest app/tests/` passes with >= 70% coverage.
3. **Security**: Zero secrets in commits; dependencies audited.
4. **End-to-End**: Playwright acceptance tests pass against the live containers.
