# TradeX AI REST API Reference & Specification

## Base URLs
- **Production API Gateway**: `https://api.tradex.ai`
- **Local Environment**: `https://localhost` (or `http://localhost:8000`)
- **Interactive OpenAPI Documentation**: `http://localhost:8000/docs` (Swagger UI) / `http://localhost:8000/redoc`

---

## Authentication & Headers
TradeX uses standard OAuth2 Password Bearer flow with JSON Web Tokens (JWT).

### Request Headers
```http
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
```

---

## Core API Tags & Endpoints

### 1. Authentication & Identity (`/api/v1/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Authenticate user credentials, returns JWT `access_token` and user profile. | No |
| `POST` | `/api/v1/auth/register` | Register new Buyer or Supplier account. | No |
| `GET` | `/api/v1/auth/me` | Retrieve currently authenticated user context and role. | Yes |

#### Example Login Request
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "buyer@speisekammer.de", "password": "Password123!"}'
```

---

### 2. Catalogue & Deterministic Search (`/api/v1/products`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/products` | Paginated product search with keyword, category, price, country filters. | No |
| `GET` | `/api/v1/products/{id_or_slug}` | Detailed product attributes, price tiers, stock, supplier profile. | No |
| `GET` | `/api/v1/products/{id_or_slug}/ai-summary` | LLM-generated executive summary of product specifications. | No |

---

### 3. AI Sourcing Engine & Search (`/api/v1/ai`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/ai/search` | Natural language sourcing query parsed into structured filters and matched against real catalogue products. | Yes |
| `POST` | `/api/v1/ai-search/orchestrate` | Unified multi-turn conversational orchestrator for AI Mode & Copilot. | Yes |
| `GET` | `/api/v1/ai/palette/search` | Quick-search endpoint powering the Cmd+K global command palette. | Yes |

#### Example AI Search Request
```json
POST /api/v1/ai/search
{
  "query": "I need 500 kg basmati rice for shipment to Hamburg"
}
```

#### Response Structure
```json
{
  "parsed_intent": {
    "product": "basmati rice",
    "quantity": 500.0,
    "unit": "kg",
    "destination_country": "Germany",
    "stated_filters": { "quantity": "500 kg" }
  },
  "products": [
    {
      "id": "prod_01h8a...",
      "title": "Premium Traditional Basmati Rice",
      "price": 1.45,
      "currency": "USD",
      "moq": 100.0,
      "stock_quantity": 25000.0,
      "supplier_name": "Punjab Heritage Grains",
      "country": "India",
      "verification_tier": "gold",
      "match_explanation": "Direct match for traditional basmati rice with 25,000 kg verified stock."
    }
  ],
  "suppliers_count": 1,
  "meta": {
    "ai_mode": "live",
    "model": "llama-3.1-8b-instant"
  }
}
```

---

### 4. RFQ Lifecycle & Procurement (`/api/v1/rfqs`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/rfqs` | List active RFQs filtered by role (buyer sees own RFQs, suppliers see open/invited). | Yes |
| `POST` | `/api/v1/rfqs` | Draft or submit a new RFQ with specifications, deadline, and target Incoterm. | Buyer |
| `GET` | `/api/v1/rfqs/{id}` | Detailed RFQ view with received quotes and line items. | Yes |
| `POST` | `/api/v1/rfqs/{id}/quotes` | Submit supplier bid/quotation on active RFQ. | Supplier |

---

### 5. Orders & Logistics (`/api/v1/orders`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/orders` | List purchase orders and contract commitments. | Yes |
| `GET` | `/api/v1/orders/{id}` | Detailed order status, payment milestones, and milestone events. | Yes |
| `POST` | `/api/v1/orders/{id}/tracking-event` | Record logistics tracking updates (departure, customs, delivery). | Supplier / Admin |

---

### 6. Landed Cost Calculator (`/api/v1/analytics/landed-cost`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/analytics/landed-cost/estimate` | Compute total landed cost Breakdown (FOB, Ocean Freight, Customs Duty, Insurance, Port Handling). | Yes |

#### Example Landed Cost Calculation Payload
```json
{
  "product_id": "prod_01h8a...",
  "quantity": 1000,
  "unit_price": 12.50,
  "origin_country": "IN",
  "destination_country": "DE",
  "incoterm": "CIF",
  "shipping_mode": "ocean_fcl"
}
```

---

### 7. Observability & Health (`/api/health`, `/metrics`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Application status, PostgreSQL connectivity, AI provider state, and uptime. | No |
| `GET` | `/metrics` | Prometheus exposition endpoint for scraping scrapable runtime metrics. | No |
