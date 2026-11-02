# TradeX AI Engineering Changelog

All notable changes, architectural milestones, and prompt deliverables are documented here.

---

## [v2.4.0] - Prompt 43: Production Hardening, Documentation & Demo Package
### Added
- Comprehensive 50-user concurrency load testing harness (`scripts/load_test.py`) with empirical results in `docs/LOAD_TEST_RESULTS.md`.
- Automated chaos failure drills documented in `docs/FAILURE_DRILLS.md` (Groq API outage circuit breaker, PostgreSQL container reboot, worker stoppage, disk capacity).
- Prometheus alert definitions in `monitoring/prometheus/alert_rules.yml`.
- Architecture Decision Records (`docs/adr/0001-why-rag.md`, `0002-why-pgvector.md`, `0003-deterministic-matching-plus-llm-explanations.md`, `0004-database-source-of-truth.md`).
- OpenAPI specification guide in `docs/API.md`.
- Production developer contribution guidelines in `docs/CONTRIBUTING.md`.
- Complete Demo Package with Viva Q&A, 10-minute presentation path, and 2-minute elevator pitch in `docs/DEMO_SCRIPT.md`.
- Complete Prompt 0-43 status matrix in `docs/FINAL_REPORT.md`.

### Security
- Re-verified secret sanitization across all git-tracked files (Groq API key exclusively in `.env`).
- 30/30 security, RBAC, and authorization tests verified green.

---

## [v2.3.0] - Prompt 42: Real Scale & High-Value Professional Features
### Added
- Scale seeder CLI (`python -m app.cli seed-scale`) generating 1,500 products, 60 suppliers, 150 buyers, 300 RFQs, 200 orders across 15 categories and 25 countries.
- Global Command Palette (Cmd+K / Ctrl+K) for instant keyboard navigation and cross-entity searching.
- International Landed Cost Calculator (`/landed-cost`) with breakdown of FOB, freight, duties, and insurance.
- Supplier Verification Tier system (Gold, Silver, Basic) with required criteria, inspection reports, and badges.
- Advanced Trade Analytics page (`/analytics`) featuring dynamic charts for volume, landed costs, and supplier performance scorecards.
- Public Shareable Quote Comparison links (`/shared/quotes/:token`) with secure HMAC token verification.

---

## [v2.2.0] - Prompt 41: Professional Home Dashboard & Interface Polish
### Added
- Interactive SVG World Trade Map (`TradeMapSvg.tsx`) with animated glowing shipping routes and coordinate pins (USA, Germany, UAE, India, Singapore).
- Role-Guided Interactive Tour modal for first-time onboarding of Buyers, Suppliers, and Admins.
- Polished Live Trade Corridor ticker strip.
- Responsive dashboard layouts verified across mobile (390px), tablet (768px), laptop (1024px), desktop (1440px), and ultrawide (1586px).
- Custom branded 404 Not Found and 500 Server Error pages.

---

## [v2.1.0] - Prompt 40: Connect LLM Everywhere It Is Needed
### Added
- Unified Groq LLM integration across all buyer and supplier AI touchpoints.
- Buyer AI summary generation for product detail pages (`/api/v1/products/{id}/ai-summary`).
- Supplier AI listing writer, RFQ opportunity scanner, and inquiry responder.
- Comprehensive AI audit and mapping report in `docs/AI_FEATURE_MAP.md`.

---

## [v2.0.0] - Part 5 (Prompts 35-39): Unified Sourcing Engine
### Added
- Unified deterministic `SourcingEngine` shared across AI Search, AI Mode, and Trade Copilot.
- Strict entity extraction, negative token filtering, and inventory comparison.
- Verified test suite (`test_prompt39_full_acceptance.py`) covering all 20 canonical trade scenarios.

---

## [v1.0.0] - Parts 1-4 (Prompts 0-34): Core Platform Foundation
### Added
- Multi-container Docker architecture (Nginx, React, FastAPI, PostgreSQL + pgvector, Celery Worker).
- Complete B2B trade lifecycle: Auth, Catalog, RFQ bidding, Quote comparison, Purchase Orders, and Milestone tracking.
- Jenkins CI/CD pipeline, SSL/TLS automation, and Prometheus/Grafana monitoring.
