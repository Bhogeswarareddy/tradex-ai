# TradeX AI: AI-Powered Cloud-Based B2B Trade and Supplier Discovery Platform

> **Problem Statement:**  
> B2B buyers struggle to discover, evaluate and compare suppliers because product data, capabilities, pricing, certifications and documents are fragmented. The platform lets buyers and suppliers manage products, supplier profiles, RFQs/inquiries and trade documents in a web app, with an AI layer that understands natural-language requirements, finds products and suppliers, extracts data from uploaded documents and recommends suppliers. It runs as a secure multi-container system with Docker and Nginx on AWS EC2, with Jenkins and Amazon ECR CI/CD, persistent storage, HTTPS, monitoring and secure configuration.

---

## 🚀 Tech Stack

- **Frontend:** React 18, TypeScript (strict mode), Vite, Tailwind CSS, Lucide Icons
- **Backend:** FastAPI, Python 3.12, SQLAlchemy 2 (async), Alembic, Pydantic v2
- **Database & Vector Search:** PostgreSQL 16 with `pgvector` extension
- **AI Layer:** Provider interface with Claude 3.5 Sonnet support and zero-config deterministic fallback (operates with or without API keys)
- **Proxy & Web Server:** Nginx (Reverse Proxy, SSL termination, static routing)
- **Containerization & Orchestration:** Docker, Docker Compose
- **Cloud Infrastructure & CI/CD:** AWS EC2, Amazon ECR, Jenkins

---

## 📁 Repository Structure

```text
tradex-ai/
├── frontend/             # React 18 + Vite + Tailwind frontend application
│   └── src/
│       ├── app/          # Core application configuration and providers
│       ├── components/   # Reusable UI components
│       ├── features/     # Domain feature modules (auth, rfq, marketplace, etc.)
│       ├── hooks/        # Custom React hooks
│       ├── lib/api/      # API clients and typing
│       ├── pages/        # Route page views
│       ├── styles/       # Global CSS and Tailwind definitions
│       └── tests/        # Frontend unit and component tests
├── backend/              # FastAPI Python 3.12 application
│   └── app/
│       ├── api/v1/       # Versioned API routes
│       ├── core/         # Config, security, database session management
│       ├── models/       # SQLAlchemy 2 declarative models
│       ├── schemas/      # Pydantic v2 validation schemas
│       ├── services/     # Business logic layer
│       ├── repositories/ # Database persistence and queries
│       ├── ai/           # AI provider interface, deterministic fallback, embeddings
│       ├── tasks/        # Background processing and async tasks
│       └── tests/        # Pytest test suite
├── nginx/                # Nginx reverse proxy configuration & Dockerfiles
├── jenkins/              # Jenkinsfile pipeline definitions for CI/CD
├── scripts/              # Development setup, database wait, and utility scripts
├── docs/                 # System architecture and design documentation
├── docker-compose.yml    # Local development multi-container orchestration
├── docker-compose.prod.yml # Production multi-container orchestration
├── Makefile              # Project workflow shortcuts
├── RULES.md              # 10 standing architectural and coding rules
├── ARCHITECTURE.md       # Full architecture diagram, module table, and 25-step plan
├── .env.example          # Environment variable template
└── .gitignore            # Git exclusion rules
```

---

## ⚡ Quick Start

### Prerequisites
- Docker & Docker Compose (or Docker via WSL2 on Windows)
- Node.js 18+ and Python 3.12 (optional for local non-container development)

### Running with Docker Compose

1. Clone the repository and configure environment variables:
   ```bash
   cp .env.example .env
   ```

2. Start the multi-container stack:
   ```bash
   docker compose up --build
   ```

3. Access the services:
   - **Web Application:** [http://localhost](http://localhost) (via Nginx) or [http://localhost:5173](http://localhost:5173) (Vite dev)
   - **API Documentation (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
   - **PostgreSQL Database:** `localhost:5432`

---

## 🔒 Security & Standing Rules

Refer to [RULES.md](file:///c:/Users/HP/Downloads/PlayerValuatorPro-main%20%281%29/PlayerValuatorPro-main/tradex-ai/RULES.md) for core development invariants:
1. Strict typing everywhere (TypeScript strict mode, strict Pydantic schemas, no `any`).
2. Absolute secret isolation (zero credentials in code, strict `.gitignore`).
3. Mandatory pagination on all collection endpoints.
4. Comprehensive test coverage for all endpoints and features.
5. Graceful UI states (loading, empty, error, and responsive mobile layout).
