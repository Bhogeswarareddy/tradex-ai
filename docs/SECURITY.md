# TradeX AI Security Architecture & Hardening Guide

## 1. Overview & Threat Model
TradeX AI is designed for mission-critical cross-border B2B trade, handling international letters of credit, customs documents, high-value trade quotations, and enterprise procurement intelligence. The platform enforces defense-in-depth across the entire request lifecycle.

### Threat Model & Mitigations
| Threat Vector | Attack Scenario | Mitigation in TradeX AI |
|---|---|---|
| **Insecure Direct Object Reference (IDOR)** | Attacker changes UUID in URL to access competitor quotes, orders, or customs docs | Object-level counterparty verification: verified against user's company profile and counterparty contracts |
| **Privilege Escalation** | Buyer or Supplier calls `/api/v1/admin/*` directly or modifies their user role | Strict `require_role("admin")` dependency on all administrative endpoints; role cannot be modified by user |
| **Cross-Tenant Data Leakage** | Multitenancy leak between buyer and supplier organizations | Strict scoping by `buyer_id`, `supplier_id`, or participant thread membership |
| **Credential Stuffing & Brute Force** | High-velocity login attacks | Per-IP sliding-window rate limit: 5 req/min on `/auth/login` and `/auth/register` with `Retry-After` header |
| **AI Resource Exhaustion & Scraping** | Scripted queries to expensive LLM endpoints | Per-user rate limiting: 10 req/min on `/ai/*` and `/copilot/*` endpoints |
| **Denial of Service via File Bomb** | Uploading gigabyte files to fill disk/memory | Enforced maximum file upload ceiling (10 MB) via `upload_limiter` and Content-Length validation |
| **SQL Injection & XSS** | Malicious characters in search queries, messages, or RFQ specs | SQLAlchemy parameterized queries (asyncpg), Pydantic input sanitization, HTML entity escaping, and strict CSP |
| **Prompt Injection** | User input attempting to override AI system instructions | Delimited wrapping (`<untrusted_input>`), strict schema validation via Pydantic |

---

## 2. Role-Based Access Control (RBAC) Matrix

| Endpoint Group | Method & Path | Anonymous | Buyer | Supplier | Admin | Authorization Check |
|---|---|:---:|:---:|:---:|:---:|---|
| **Auth** | `POST /auth/register`, `POST /auth/login` | Allow | Allow | Allow | Allow | Rate limited (5/min) |
| **Products (Public)** | `GET /products`, `GET /products/{id}` | Allow | Allow | Allow | Allow | Public read-only |
| **Supplier Products** | `POST, PUT, DELETE /supplier/products/*` | Deny (401) | Deny (403) | Allow | Allow | Owned by supplier company |
| **RFQs** | `POST /rfqs`, `PUT /rfqs/{id}` | Deny (401) | Allow | Deny (403) | Allow | Only creating buyer or admin |
| **RFQs (Marketplace)**| `GET /rfqs`, `GET /rfqs/{id}` | Deny (401) | Allow | Allow | Allow | Authenticated access |
| **Quotes** | `POST /rfqs/{id}/quotes` | Deny (401) | Deny (403) | Allow | Allow | Supplier role required |
| **Quote Comparison** | `GET /rfqs/{id}/comparison` | Deny (401) | Allow (Owner) | Deny (403) | Allow | Buyer must own RFQ |
| **Orders** | `GET /orders/{id}` | Deny (401) | Allow (Buyer) | Allow (Supplier) | Allow | Must be counterparty on order |
| **Shipments** | `GET /shipments/{id}` | Deny (401) | Allow (Buyer) | Allow (Supplier) | Allow | Counterparty on linked order |
| **Documents** | `GET /documents/{id}/download` | Deny (401) | Conditional | Conditional | Allow | Owner, counterparty order, or admin |
| **Messages / Threads** | `GET /threads/{id}/messages` | Deny (401) | Conditional | Conditional | Allow | Must be thread participant |
| **Admin Console** | `* /api/v1/admin/*` | Deny (401) | **Deny (403)** | **Deny (403)** | **Allow** | `require_role("admin")` |

---

## 3. Object-Level Authorization (IDOR Mitigation)

Every API route accepting an entity ID (`product_id`, `rfq_id`, `quote_id`, `order_id`, `shipment_id`, `document_id`, `thread_id`) enforces explicit counterparty ownership:

1. **Documents (`/api/v1/documents/{doc_id}`)**:
   - Access is restricted to the creating user, users belonging to the owner company, counterparties on the linked RFQ or Order, or administrators.
2. **Quote Comparison & Shortlisting (`/api/v1/rfqs/{rfq_id}/comparison`)**:
   - Explicitly verifies that `rfq.buyer_id` matches the authenticated buyer's profile ID.
   - Competitor suppliers or unauthorized buyers receive `403 Forbidden`.
3. **Shipments (`/api/v1/shipments/{shipment_id}`)**:
   - Resolves linked `Order` and verifies that the requester is either the buyer, the supplier, or an admin.
4. **Communication Threads (`/api/v1/threads/{thread_id}/messages`)**:
   - Verifies `thread.buyer_id` or `thread.supplier_id` against the caller's active profile. Cross-tenant access is rejected with `403 Forbidden`.

---

## 4. Multi-Tier Rate Limiting

Rate limiting is enforced in-memory with sliding time-window counters (`app.core.rate_limit`):

| Limiter | Target Routes | Quota | Key Strategy | Exceeded Code |
|---|---|---|---|---|
| `auth_limiter` | `POST /auth/login`, `POST /auth/register` | 5 req / min | Client IP | HTTP 429 Too Many Requests |
| `ai_limiter` | `POST /ai/copilot/chat`, `POST /ai/search`, `/ai/*` | 10 req / min | User ID or IP | HTTP 429 Too Many Requests |
| `upload_limiter` | `POST /documents`, `POST /documents/upload` | 10 req / min | User ID or IP | HTTP 429 Too Many Requests |

When a rate limit is exceeded, the server responds with:
- `HTTP 429 Too Many Requests`
- `Retry-After: <seconds>` response header
- Standard JSON envelope:
  ```json
  {
    "error": {
      "code": "RATE_LIMIT_EXCEEDED",
      "message": "Rate limit exceeded. Maximum 5 attempts per minute.",
      "details": { "retry_after_seconds": 47 }
    }
  }
  ```

---

## 5. HTTP Security Headers (Defense-in-Depth)

Configured via `SecurityHeadersMiddleware` on all responses:

- **Strict-Transport-Security (HSTS)**: `max-age=31536000; includeSubDomains; preload`
- **X-Content-Type-Options**: `nosniff` (mitigates MIME-confusion attacks)
- **X-Frame-Options**: `DENY` (prevents UI redress and clickjacking)
- **X-XSS-Protection**: `1; mode=block`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: `camera=(), microphone=(), geolocation=()`
- **Content-Security-Policy (CSP)**: `default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';`

---

## 6. Admin Console Hardening & Append-Only Audit Logging

All administrative capabilities reside under `/api/v1/admin/*` and require the `admin` role:

1. **User Management**: Search, suspend (`is_active=False`), reactivate, and role transition.
2. **Supplier Verification Queue**: Approve, reject with reason note, or request additional KYC/AML information (`request_info`).
3. **Content Moderation**: Moderate flagged products and RFQs (approve, flag, suspend/close).
4. **Document Review Queue**: Inspect and verify supplier compliance certifications.
5. **Reported Accounts & Abuse Handling**: Investigate and take punitive action on user-reported entities.
6. **Matching-Score Configuration**: Real-time tuning of algorithmic weights (price, lead time, rating, compliance, capacity) ensuring validation sum equals 1.0.
7. **Immutable Audit Trails**:
   Every state-altering admin action automatically inserts an append-only row into `audit_logs`:
   ```sql
   INSERT INTO audit_logs (id, user_id, action, target_entity, target_id, details, created_at)
   VALUES (uuid_generate_v4(), :admin_id, 'SUSPEND_USER', 'users', :target_id, :metadata, NOW());
   ```
   Audit logs can be queried with action/date filters and exported to CSV via `GET /api/v1/admin/audit-logs/export`.

---

## 7. Automated Security Test Suite

The security posture is continuously verified via `backend/app/tests/test_authorization_and_security.py`.

### Test Suite Execution
```bash
pytest app/tests/test_authorization_and_security.py -v
```

### Coverage Overview (16 Tests, 100% Passing)
1. `test_security_headers_present`: Verifies HSTS, CSP, nosniff, DENY, Referrer-Policy on API responses.
2. `test_admin_endpoints_strictly_forbid_buyer`: Confirms non-admin calling `/admin/users` returns HTTP 403.
3. `test_admin_endpoints_strictly_forbid_supplier`: Confirms supplier calling `/admin/audit-logs` returns HTTP 403.
4. `test_privilege_escalation_blocked`: Confirms standard user cannot modify their role or other users' roles.
5. `test_quote_comparison_idor_protection`: Confirms competitor buyer cannot access another buyer's RFQ quote comparison.
6. `test_document_download_idor_protection`: Confirms unauthorized user cannot download another company's trade document.
7. `test_order_idor_counterparty_verification`: Confirms non-counterparty cannot access order details.
8. `test_shipment_idor_counterparty_verification`: Confirms non-counterparty cannot inspect shipment tracking.
9. `test_message_thread_idor_verification`: Confirms non-participant cannot read private trade messages.
10. `test_rfq_modification_idor`: Confirms another user cannot modify or cancel someone else's RFQ.
11. `test_sql_injection_payloads_in_search`: Tests 5+ classic SQLi strings (`' OR '1'='1`, `'; DROP TABLE...`) without leaking or crashing.
12. `test_xss_payload_in_rfq_and_chat`: Tests script injection strings (`<script>alert(1)</script>`) safely handled without execution.
13. `test_expired_or_invalid_tokens_rejected`: Confirms expired or forged JWT tokens strictly return HTTP 401.
14. `test_oversized_upload_rejection`: Confirms uploads exceeding 10MB are rejected with HTTP 413 / 422.
15. `test_rate_limiting_auth_endpoint`: Confirms exceeding 5 requests/min on auth endpoints yields HTTP 429 with `Retry-After`.
16. `test_admin_moderation_and_weights_endpoints`: Confirms moderation workflows and matching-score weight updates with sum validation.

---

## 8. Incident Response & Vulnerability Playbook

### Severity Classification
- **P0 - Critical**: Cross-tenant data leakage, remote code execution, unauthenticated admin bypass.
  - *Response SLA*: Immediate response (< 1 hour), hotfix deployment within 4 hours.
- **P1 - High**: IDOR between authenticated buyers/suppliers, broken authorization on financial quotes.
  - *Response SLA*: 4 hours, patch deployment within 24 hours.
- **P2 - Medium**: Rate limit bypass, informational leakage, non-exploitable XSS.
  - *Response SLA*: 24 hours, patch in next sprint cycle.

### Incident Containment Procedure
1. **Immediate Account Isolation**: Admin invokes `PATCH /api/v1/admin/users/{user_id}` setting `is_active=False`.
2. **Audit Forensics**: Admin filters `audit_logs` for suspicious IP addresses, compromised entity IDs, and export logs to CSV.
3. **Session Revocation**: Invalidate active JWT tokens and revoke refresh credentials.
4. **Hotfix & Test Verification**: Implement fix, add regression test to `test_authorization_and_security.py`, and run the automated test suite.
