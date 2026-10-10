# TradeX AI: Standing Engineering Rules

These 10 rules are non-negotiable standing principles that govern every implementation step of TradeX AI.

---

### Rule 1: Strict Typing Everywhere (No `any`)
- **TypeScript:** Strict mode enabled in `tsconfig.json`. Explicit interfaces and types for all props, state, API responses, and hooks. The `any` type is strictly prohibited.
- **Python:** Strict type hints on every function argument, return type, and variable definition. No untyped parameters.

### Rule 2: No Secrets in Code
- Never commit secrets, tokens, private keys, or passwords.
- All secrets and credentials must be injected via environment variables (`.env`, Docker environment, or Jenkins secrets).
- Ensure `.env` is always listed in `.gitignore`.

### Rule 3: Every List Endpoint Must Be Paginated
- Every collection API endpoint (`GET /items`, `GET /products`, `GET /rfqs`, etc.) must accept pagination parameters (`page`, `page_size` or `limit`, `offset`).
- Every collection response must adhere to a standard paginated envelope containing `items`, `total`, `page`, `page_size`, and `total_pages`.

### Rule 4: Every Endpoint Has a Pydantic Schema and an Automated Test
- All requests and responses must be validated with explicit Pydantic v2 models.
- No raw dict responses from API handlers.
- Every API endpoint must have automated Pytest test coverage testing happy path, validation failures, and edge cases.

### Rule 5: Every Page Has Loading, Empty, Error, and Mobile States
- Every frontend page and view must gracefully handle all four UI states:
  1. **Loading:** Clear spinner, skeleton, or progress indicator.
  2. **Empty:** Informative empty state message with actionable call-to-action.
  3. **Error:** Helpful error display with retry capability.
  4. **Mobile:** Fully responsive layout tested for smaller viewports.

### Rule 6: Every AI Call Goes Through `backend/app/ai`
- All AI operations (Claude 3.5 Sonnet, embeddings, RAG, prompt extraction) must be routed exclusively through the provider interface in `backend/app/ai`.
- Direct unencapsulated HTTP requests to third-party AI APIs from arbitrary endpoints or services are forbidden.
- Always provide a deterministic fallback implementation so the entire platform functions predictably without external API keys.

### Rule 7: Simulated Features Must Show a Visible 'Simulated' Label
- Mocked or simulated domains (Payments, Escrow, Trade Finance, Customs Clearance, Freight Rates) must visibly render a prominent badge: `[Simulated]`.
- All simulated API responses must explicitly include a `"simulated": true` metadata field.

### Rule 8: Validate with Docker Compose After Each Step
- After completing any step, verify the multi-container configuration builds cleanly:
  ```bash
  docker compose up --build
  ```
- Resolve any container startup, healthcheck, or compilation failures before proceeding.

### Rule 9: One Clear Git Commit Per Step
- Every completed prompt must be committed cleanly with a descriptive commit message formatted as:
  ```bash
  git commit -m "Prompt X: <feature/scope description>"
  ```
- Push updates to the upstream repository systematically.

### Rule 10: Never Break Earlier Features — Run All Tests Before Finishing
- Regression prevention is mandatory.
- Before concluding any step, execute the full backend and frontend test suites.
- All existing tests must pass 100% without regression.
