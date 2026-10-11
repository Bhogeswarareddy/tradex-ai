# TradeX AI Security Architecture & Hardening Guide

## 1. Overview
TradeX AI is designed for mission-critical cross-border B2B trade, requiring defense-in-depth protection across network transport, authentication, tenant isolation, and administrative controls.

---

## 2. Security Headers (Defense-in-Depth)
All inbound and outbound HTTP traffic passes through `SecurityHeadersMiddleware` which attaches the following mandatory security headers:

- **Strict-Transport-Security (HSTS)**: `max-age=31536000; includeSubDomains; preload`
- **X-Content-Type-Options**: `nosniff` (mitigates MIME-sniffing attacks)
- **X-Frame-Options**: `DENY` (prevents clickjacking attacks)
- **X-XSS-Protection**: `1; mode=block`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: `camera=(), microphone=(), geolocation=()`
- **Content-Security-Policy (CSP)**: `default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';`

---

## 3. Rate Limiting & Abuse Prevention
- **Authentication Route Protection**: Login and sensitive identity endpoints are restricted via `InMemoryRateLimiter` (`auth_limiter`) to **5 attempts per minute per IP**.
- **Standardized Response**: Exceeded quotas return **HTTP 429 Too Many Requests** accompanied by a standard `Retry-After: <seconds>` response header and a clear error envelope:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Maximum 5 attempts per minute.",
    "details": {
      "retry_after_seconds": 58
    }
  }
}
```

---

## 4. Role-Based Access Control (RBAC) & IDOR Mitigation
- **Role Hierarchy**: Strict separation among `buyer`, `supplier`, and `admin` roles via `require_role(...)` FastAPI dependencies.
- **Tenant Isolation**:
  - Buyers cannot access supplier performance metrics or internal quotes.
  - Suppliers cannot view other suppliers' quotes or confidential buyer procurement data.
  - Documents and contracts require entity-level authorization: access is restricted to the document owner company, the counterparties on the linked RFQ/Order, or administrators.
- **IDOR Safeguards**: Direct entity lookups (e.g. `/orders/{id}`, `/documents/{id}/download`, `/quotes/{id}`) enforce ownership verification against the authenticated user's associated company IDs.

---

## 5. Input Sanitization & Anti-Prompt Injection
- **Untrusted Input Wrapping**: All untrusted external inputs fed into LLM prompts are sanitized against markdown control characters and wrapped inside strict `<untrusted_input>...</untrusted_input>` delimiter tags.
- **Strict Structured Outputs**: AI responses are parsed through Pydantic schemas using JSON schema validation to guarantee no executable or unsanitized content leaks into the application layer.

---

## 6. Immutable Append-Only Audit Logging
- **Audit Trails**: Critical security and governance operations (role updates, account suspensions, supplier verification approvals/rejections, and system configuration modifications) automatically insert immutable records into the `audit_logs` table.
- **CSV Export**: Administrators can export audit trails via `GET /api/v1/admin/audit-logs/export` for regulatory compliance, KYC audits, and forensic review.
