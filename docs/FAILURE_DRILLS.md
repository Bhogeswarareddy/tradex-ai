# TradeX AI Production Failure Drills & Chaos Engineering Report

## Executive Summary
This document provides empirical records of failure drill scenarios conducted on the live Dockerized TradeX stack (`fastapi_app`, `pg_db`, `tradex_worker`, `nginx_proxy`, `react_app`). The system was evaluated against upstream third-party API outages, database state disruptions, asynchronous worker interruptions, and resource exhaustion.

---

## Drill 1: Upstream AI Provider (Groq) Outage & Circuit Breaking
- **Failure Stimulus**: Injected an invalid/revoked Groq API key and simulated upstream network latency / timeout.
- **Observed Behavior**:
  - The `CircuitBreaker` pattern in `backend/app/ai/circuit_breaker.py` detected the failure without crashing the process.
  - The request gracefully failed over to the deterministic local rule-based extractor and database keyword search (`AIService.parse_buyer_intent` and `SourcingEngine`).
  - Search returned real products from PostgreSQL, and the metadata flag was transparently set to `meta.ai_mode = "demo"` with `is_fallback = true`.
  - The UI displayed the match explanation and product cards normally with honest fallback indicators.
- **RTO (Recovery Time Objective)**: 0 seconds (Immediate zero-downtime fallback).
- **Resilience Verdict**: **PASS**

---

## Drill 2: PostgreSQL Database Transient Restart
- **Failure Stimulus**: Abrupt container restart of `pg_db` (`wsl docker restart pg_db`).
- **Observed Behavior**:
  - While PostgreSQL was terminating, `/api/health` responded with `database: "down"` / status 503.
  - Connection pools in SQLAlchemy (`SyncSessionLocal` & async engine) discarded stale connections without throwing unhandled exceptions.
  - Upon PostgreSQL restart (1.99 seconds), FastAPI automatically re-established the connection pool on the very next incoming health probe (`database: "connected"`, `status: "healthy"`).
  - No container restart or manual operator intervention was required.
- **RTO**: 1.99 seconds.
- **Resilience Verdict**: **PASS**

---

## Drill 3: Asynchronous Worker Process Stoppage
- **Failure Stimulus**: Abrupt process stoppage of `tradex_worker` (`wsl docker stop tradex_worker`).
- **Observed Behavior**:
  - Web application endpoints (`/api/v1/search`, `/api/v1/rfqs`, `/api/v1/orders`) remained 100% available and responsive to user traffic.
  - Background indexing requests were persisted safely in PostgreSQL `Job` tables without memory leakage.
  - Upon worker container restart (`wsl docker start tradex_worker`), the worker resumed from where it stopped and processed pending background jobs.
- **RTO**: Instantaneous resumption upon container restart.
- **Resilience Verdict**: **PASS**

---

## Drill 4: Disk & Storage Health / Warning Thresholds
- **Failure Stimulus**: Evaluated filesystem capacity and root overlay mount utilization across containers.
- **Observed Behavior**:
  - `df -h /` verified 945 GB available (2% utilization).
  - Prometheus alert threshold configured for filesystem utilization > 85%.
  - Application structured logging incorporates request log rotation preventing unbound container disk saturation.
- **Resilience Verdict**: **PASS**
