# TradeX AI Architecture & Codebase Audit

**Date:** October 2026  
**Branch:** fix/integration  
**Scope:** Frontend Routes, API Client, Auth Refresh Flow, Database Seeds, Models, UI States

---

## 1. Executive Summary

This audit catalogs the architecture, verified paths, known gaps, and repair roadmap for TradeX AI across all 14 prompts. The shared foundation (API client, authentication interceptors, seed idempotency, and design system components) has been unified to eliminate runtime regressions and broken session states.

---

## 2. Route & View Audit

| Route | Page Component | Protected / Role | Current State | Notes & Fixes Applied |
|---|---|---|---|---|
| / | HomePage | Public / Role Aware | Working | Hero, market highlights, KPI cards |
| /login | LoginPage | Public | Working | Session cookie + JWT storage |
| /register | RegisterPage | Public | Working | Role selection (buyer / supplier) |
| /forgot-password | ForgotPasswordPage | Public | Working | Password reset simulation |
| /products | ProductsPage | Public | Working | 60 seeded products, filter & pagination |
| /products/:slug | ProductDetailPage | Public | Working | HS codes, specifications, supplier card |
| /suppliers | SuppliersPage | Public | Working | Supplier listing, verification badges |
| /suppliers/:id | SupplierDetailPage | Public | Working | Trust score, catalog, certifications |
| /supplier/* | SupplierPortalPage | Supplier, Admin | Working | Supplier quotes, orders, catalog mgmt |
| /search / /ai-search | AiSearchPage | Public | Working | Natural language intent extraction & matching |
| /rfqs / /rfq | RfqsPage | Public / Auth | Working | RFQ wizard, marketplace feed |
| /rfqs/:id | RfqDetailPage | Public / Auth | Working | Quotation submission & AI comparison |
| /orders | OrdersPage | Buyer, Supplier | Working | Active orders list, order tracking |
| /orders/:id | OrderDetailPage | Buyer, Supplier | Working | Payment simulation, timeline |
| /shipments | ShipmentsPage | Buyer, Supplier | Working | Maritime shipment tracker |
| /shipments/:id | ShipmentDetailPage | Buyer, Supplier | Working | Waypoint GPS tracker & AI summary |
| /trade-finance | TradeFinancePage | Buyer, Supplier | Working | Simulated escrow & credit facility |
| /documents | DocumentsPage | Buyer, Supplier | Working | OCR extraction, verification drawer |
| /analytics | AnalyticsPage | Buyer, Supplier, Admin | Working | Market intelligence, top products, AI insights |
| /messages | MessagesPage | Buyer, Supplier | Working | RFQ / Order negotiation chat |
| /admin | AdminPage | Admin only | Working | RBAC enforced, user & platform metrics |
| /saved | ModulePlaceholderPage | Public / Auth | Placeholder | Clean placeholder with description |
| /settings | ModulePlaceholderPage | Public / Auth | Placeholder | Clean placeholder with description |

---

## 3. API & Authentication Architecture

### Central API Client (rontend/src/lib/api/client.ts)
- **Bearer Token Injection:** Automatically attaches Authorization: Bearer <token> from in-memory cache and localStorage.
- **401 Silent Refresh:** Catches HTTP 401 on private routes, triggers a single mutex-guarded refresh call to /api/v1/auth/refresh, updates the stored token, and replays the original request.
- **Fail-Safe Session Recovery:** When the refresh token cookie expires or is invalid, the client clears the access token and safely redirects the user to /login.
- **Error Normalization:** Standardizes error objects into ApiError with { status, code, message, details }.

---

## 4. Database & Seed Idempotency

- **Target Engine:** PostgreSQL 16 + pgvector.
- **Seed Script (ackend/app/seed.py):**
  - Confirmed idempotent. Can be executed repeatedly without causing duplicate unique-key collisions or orphaned rows.
  - Seeds 60 structured commodities and products, default buyers, suppliers, and admin credentials.
- **Demo Accounts:**
  - Buyer: hogeswara@tradex.ai / uyer123
  - Supplier: supplier@sribharat.com / supplier123
  - Admin: dmin@tradex.ai / dmin123

---

## 5. Shared UI Design System & Component Health

- Skeleton: Reusable pulse loader (rontend/src/components/ui/Skeleton.tsx).
- EmptyState: Standardized empty view with icon and action button (rontend/src/components/EmptyState.tsx).
- ErrorState: Error alert container with retry callback (rontend/src/components/ErrorState.tsx).
- ConfirmDialog: Reusable confirmation modal with danger/warning/info variants (rontend/src/components/common/ConfirmDialog.tsx).
- DataTable: Generic sortable, paginated data table with loading skeleton and empty state (rontend/src/components/ui/DataTable.tsx).
