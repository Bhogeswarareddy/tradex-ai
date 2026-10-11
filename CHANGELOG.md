# Changelog

All notable changes to the **TradeX AI** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-11

### Added
- **Prompt 1: Project Setup & Foundation**: Repository topology, standing architecture rules, Docker compose dev config, FastAPI async setup, React 19 SPA foundation.
- **Prompt 2: Design System & Branding**: B2B design tokens, Tailwind configuration, responsive layout components, typography, accessible color palette.
- **Prompt 3: Authentication & Multi-Tenant RBAC**: JWT access tokens, Argon2id password hashing, user registration, role guards (Buyer, Supplier, Admin).
- **Prompt 4: Database Models & Seed Data**: SQLAlchemy 2 declarative schema, Alembic migration framework, seeded dataset (5 suppliers, 60 products).
- **Prompt 5: Homepage & Discovery Dashboard**: Enterprise dashboard layout, stats overview, quick actions, recommended suppliers.
- **Prompt 6: Supplier Directory & Profiles**: Comprehensive supplier directory with search, filtering, verified storefronts, trust badges, and factory audit tabs.
- **Prompt 7: Product Catalog & Detail View**: Multi-category product catalog with pagination, chemical specs (curcumin, moisture), and packaging parameters.
- **Prompt 8: AI Provider Interface & Zero-Key Fallback**: Dual-mode AI system supporting Anthropic Claude / OpenAI with deterministic offline fallback.
- **Prompt 9: Natural Language AI Search**: Semantic search parsing complex multi-clause trade prompts into structured vector parameters using `pgvector`.
- **Prompt 10: Multi-Attribute Supplier Matching**: Recommendation algorithm calculating composite match scores based on cosine similarity, trust scores, and licenses.
- **Prompt 11: RFQ Management & Creation**: RFQ submission lifecycle, chemical specifications, multi-item bill of quantities, and instant generation from AI search.
- **Prompt 12: Supplier Portal & Quote Submission**: Dedicated portal for suppliers to review RFQs, calculate freight, and submit binding quotations.
- **Prompt 13: AI Quote Comparison & Landed Cost**: Multi-quote side-by-side benchmarking matrix with automatic landed cost calculation (CIF, duties, insurance, port fees).
- **Prompt 14: Messaging & Negotiation**: Real-time supplier-buyer negotiation threads with quote revision counter-proposals.
- **Prompt 15: Real-Time WebSockets**: Asynchronous `/ws` notification channel for quote updates, order transitions, and tracking alerts.
- **Prompt 16: Orders, Procurement & Payment Simulator**: Order state machine and multi-stage simulated trade finance escrow milestones (advance, balance, delivery release).
- **Prompt 17: Maritime Tracking & Route Simulator**: Interactive 14-waypoint nautical tracking map (Chennai to Hamburg) with background vessel coordinate simulation.
- **Prompt 18: Document Intelligence & AI OCR**: Multi-format document upload (PDF, PNG, DOCX), secure storage interface (`StorageBackend`), and structured AI field extraction.
- **Prompt 19: AI Trade Copilot & RAG Knowledge Engine**: Grounded copilot backed by 15 ICC/WCO international trade compliance guides with clickable source citations.
- **Prompt 20: Market Intelligence & Analytics**: 24 months of commodity time-series analytics (price trends, demand indices) with AI macroeconomic narrative summaries.
- **Prompt 21: Admin Governance, Security & Audit Logs**: Platform administration console, sanctions review, tamper-evident audit logs, rate-limiting, and CSP headers.
- **Prompt 22: Production Multi-Container Docker Stack (Problem 20 Core)**: Nginx reverse proxy, HTTPS/TLS 1.2/1.3, internal-only PostgreSQL port 5432, healthchecks, and volume persistence.
- **Prompt 23: AWS EC2, ECR & Production Deployment**: Production compose stack, AWS SSM Parameter Store zero-secret integration, ECR push automation, and automated rollback scripts.
- **Prompt 24: Jenkins CI/CD & Prometheus Monitoring**: Multi-tool Jenkins controller, 11-stage declarative `Jenkinsfile`, Prometheus `/metrics` endpoint, Grafana dashboard, and operations runbook.
- **Prompt 25: Final Integration, Testing & Portfolio Polish**: Single-command `make demo`, Playwright e2e test suite, lazy-loaded routes with `React.lazy`, ErrorBoundary, and 25-Prompt Compliance Audit.
