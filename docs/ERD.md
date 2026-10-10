# TradeX AI: Entity Relationship Diagram (ERD)

This document visualizes the complete database schema for the TradeX AI platform, covering Identity, Catalog, Trade, Content, and AI/Ops domains.

---

## Mermaid ER Diagram

```mermaid
erDiagram
    ROLES ||--o{ USERS : "assigned_to"
    USERS ||--o{ BUYERS : "owns"
    USERS ||--o{ SUPPLIERS : "owns"
    COMPANIES ||--o{ BUYERS : "has"
    COMPANIES ||--o{ SUPPLIERS : "has"

    CATEGORIES ||--o{ CATEGORIES : "parent_of"
    CATEGORIES ||--o{ PRODUCTS : "categorizes"
    SUPPLIERS ||--o{ PRODUCTS : "manufactures"
    PRODUCTS ||--o{ PRODUCT_IMAGES : "has"
    PRODUCTS ||--o{ PRICE_TIERS : "offers"

    CERTIFICATIONS ||--o{ SUPPLIER_CERTIFICATIONS : "granted_via"
    SUPPLIERS ||--o{ SUPPLIER_CERTIFICATIONS : "holds"

    BUYERS ||--o{ RFQS : "issues"
    RFQS ||--o{ RFQ_ITEMS : "contains"
    PRODUCTS ||--o{ RFQ_ITEMS : "referenced_in"

    RFQS ||--o{ QUOTATIONS : "receives"
    SUPPLIERS ||--o{ QUOTATIONS : "submits"

    BUYERS ||--o{ ORDERS : "places"
    SUPPLIERS ||--o{ ORDERS : "fulfills"
    RFQS ||--o| ORDERS : "originates"
    QUOTATIONS ||--o| ORDERS : "confirms"
    ORDERS ||--o{ ORDER_ITEMS : "contains"
    ORDERS ||--o{ PAYMENTS : "billed_by"
    ORDERS ||--o{ SHIPMENTS : "dispatched_as"
    SHIPMENTS ||--o{ SHIPMENT_EVENTS : "tracked_by"

    USERS ||--o{ DOCUMENTS : "uploads"
    DOCUMENTS ||--o{ DOCUMENT_EXTRACTIONS : "parsed_into"

    USERS ||--o{ MESSAGES : "sends"
    USERS ||--o{ NOTIFICATIONS : "receives"
    BUYERS ||--o{ REVIEWS : "writes"
    SUPPLIERS ||--o{ REVIEWS : "reviewed_in"
    USERS ||--o{ SAVED_ITEMS : "bookmarks"

    USERS ||--o{ AI_SEARCHES : "executes"
    USERS ||--o{ AI_RECOMMENDATIONS : "recommended_to"
    USERS ||--o{ AUDIT_LOGS : "triggered_by"

    ROLES {
        uuid id PK
        varchar name UK
        varchar description
        timestamp created_at
        timestamp updated_at
    }

    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar role
        uuid role_id FK
        boolean is_active
        boolean email_verified
        varchar full_name
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    COMPANIES {
        uuid id PK
        varchar name
        varchar country
        varchar city
        varchar website
        varchar logo_url
        text description
        integer years_in_business
        varchar verified_status
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    BUYERS {
        uuid id PK
        uuid company_id FK
        uuid user_id FK
        array import_destinations
        timestamp created_at
        timestamp updated_at
    }

    SUPPLIERS {
        uuid id PK
        uuid company_id FK
        uuid user_id FK
        float trust_score
        float on_time_rate
        varchar capacity_per_month
        array export_countries
        float response_time_hours
        timestamp created_at
        timestamp updated_at
    }

    CATEGORIES {
        uuid id PK
        varchar name
        varchar slug UK
        text description
        uuid parent_id FK
        timestamp created_at
        timestamp updated_at
    }

    PRODUCTS {
        uuid id PK
        uuid supplier_id FK
        uuid category_id FK
        varchar name
        varchar slug UK
        text description
        varchar hs_code
        integer moq
        varchar unit
        varchar origin_country
        integer lead_time_days
        boolean is_active
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    PRODUCT_IMAGES {
        uuid id PK
        uuid product_id FK
        varchar image_url
        boolean is_primary
        integer display_order
        timestamp created_at
        timestamp updated_at
    }

    PRICE_TIERS {
        uuid id PK
        uuid product_id FK
        integer min_qty
        integer max_qty
        numeric unit_price
        varchar currency
        timestamp created_at
        timestamp updated_at
    }

    CERTIFICATIONS {
        uuid id PK
        varchar name
        varchar code UK
        varchar issuing_body
        text description
        timestamp created_at
        timestamp updated_at
    }

    SUPPLIER_CERTIFICATIONS {
        uuid id PK
        uuid supplier_id FK
        uuid certification_id FK
        varchar certificate_no
        date issued_at
        date expires_at
        uuid document_id
        timestamp created_at
        timestamp updated_at
    }

    RFQS {
        uuid id PK
        varchar rfq_number UK
        uuid buyer_id FK
        varchar title
        varchar status
        integer quantity
        varchar unit
        numeric target_price_min
        numeric target_price_max
        varchar currency
        varchar destination_country
        varchar destination_port
        date deadline
        varchar incoterm
        text notes
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    RFQ_ITEMS {
        uuid id PK
        uuid rfq_id FK
        uuid product_id FK
        varchar item_name
        integer quantity
        varchar unit
        numeric target_price
        jsonb specifications
        timestamp created_at
        timestamp updated_at
    }

    QUOTATIONS {
        uuid id PK
        varchar quote_number UK
        uuid rfq_id FK
        uuid supplier_id FK
        numeric unit_price
        numeric landed_cost
        numeric freight_cost
        integer lead_time_days
        varchar payment_terms
        date valid_until
        varchar status
        float ai_score
        text notes
        timestamp created_at
        timestamp updated_at
    }

    ORDERS {
        uuid id PK
        varchar order_number UK
        uuid rfq_id FK
        uuid quotation_id FK
        uuid buyer_id FK
        uuid supplier_id FK
        numeric total_amount
        varchar currency
        varchar status
        varchar incoterm
        timestamp created_at
        timestamp updated_at
    }

    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        varchar name
        integer quantity
        varchar unit
        numeric unit_price
        numeric total_price
        timestamp created_at
        timestamp updated_at
    }

    PAYMENTS {
        uuid id PK
        uuid order_id FK
        numeric amount
        varchar currency
        varchar status
        varchar payment_method
        boolean simulated
        varchar transaction_ref
        timestamp created_at
        timestamp updated_at
    }

    SHIPMENTS {
        uuid id PK
        varchar shipment_number UK
        uuid order_id FK
        varchar carrier
        varchar tracking_number
        varchar origin
        varchar destination
        date estimated_delivery
        date actual_delivery
        varchar status
        timestamp created_at
        timestamp updated_at
    }

    SHIPMENT_EVENTS {
        uuid id PK
        uuid shipment_id FK
        varchar event_type
        varchar status
        varchar location
        varchar description
        timestamp occurred_at
        timestamp created_at
        timestamp updated_at
    }

    DOCUMENTS {
        uuid id PK
        uuid user_id FK
        varchar title
        varchar file_path
        integer file_size
        varchar mime_type
        varchar doc_type
        timestamp created_at
        timestamp updated_at
    }

    DOCUMENT_EXTRACTIONS {
        uuid id PK
        uuid document_id FK
        jsonb extracted_json
        float confidence_score
        varchar status
        timestamp created_at
        timestamp updated_at
    }

    MESSAGES {
        uuid id PK
        uuid thread_id
        uuid sender_id FK
        text body
        array attachments
        boolean is_read
        timestamp created_at
        timestamp updated_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        varchar title
        text message
        boolean is_read
        varchar link
        timestamp created_at
        timestamp updated_at
    }

    REVIEWS {
        uuid id PK
        uuid supplier_id FK
        uuid buyer_id FK
        integer rating
        varchar title
        text comment
        timestamp created_at
        timestamp updated_at
    }

    SAVED_ITEMS {
        uuid id PK
        uuid user_id FK
        varchar item_type
        uuid item_id
        timestamp created_at
        timestamp updated_at
    }

    AI_SEARCHES {
        uuid id PK
        uuid user_id FK
        text query
        jsonb filters
        integer results_count
        float execution_time_ms
        timestamp created_at
        timestamp updated_at
    }

    AI_RECOMMENDATIONS {
        uuid id PK
        uuid user_id FK
        varchar entity_type
        uuid entity_id
        float score
        text reasoning
        timestamp created_at
        timestamp updated_at
    }

    KNOWLEDGE_CHUNKS {
        uuid id PK
        varchar entity_type
        uuid entity_id
        varchar title
        text content
        vector_1536 embedding
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }

    MARKET_INSIGHTS {
        uuid id PK
        varchar commodity
        varchar region
        varchar price_trend
        text commentary
        varchar source
        timestamp published_at
        timestamp created_at
        timestamp updated_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        varchar action
        varchar entity_type
        varchar entity_id
        varchar ip_address
        jsonb details
        timestamp created_at
        timestamp updated_at
    }

    SYSTEM_SETTINGS {
        uuid id PK
        varchar key UK
        jsonb value
        varchar description
        timestamp created_at
        timestamp updated_at
    }
```
