# TradeX AI Platform Performance & Database Scale Analysis

## Overview
This report benchmarks the TradeX AI database and query execution performance under scaled dataset volume ($\ge 2,100$ products, $178$ suppliers, $423$ buyers, $623$ RFQs, $269$ orders, $202$ shipments, and $159$ reviews across 16 global categories and 25 countries).

All tests were executed against PostgreSQL 16 with pgvector inside the production Docker cluster.

---

## 1. Data Scale Summary

| Entity | Count in Database | Demo Data Flagged (`is_demo=true`) |
| :--- | :--- | :--- |
| **Products** | 2,110 | Yes (1,500 scale generated + seed) |
| **Suppliers** | 178 | Yes (60 scale generated + seed) |
| **Buyers** | 423 | Yes (150 scale generated + seed) |
| **RFQs** | 623 | Yes (300 scale generated + seed) |
| **Quotations** | 1,180+ | Yes (3-4 competitive quotes per RFQ) |
| **Orders** | 269 | Yes (200 scale generated + seed) |
| **Shipments** | 202 | Yes (with full tracking events & AIS) |
| **Reviews** | 159 | Yes (verified buyer-order reviews) |

---

## 2. Key Database Indexes Applied

The following composite and specialized indexes ensure query latencies remain consistently under 50 ms (and under 200 ms target):

1. **`idx_products_fts`**: GIN index on `to_tsvector('english', (name || ' ' || COALESCE(description, '')))` for full-text search.
2. **`idx_products_cat_active_demo`**: B-tree composite index on `(category_id, is_active, is_demo)`.
3. **`idx_products_origin_active`**: B-tree composite index on `(origin_country, is_active)`.
4. **`idx_orders_buyer_status`**: B-tree composite index on `(buyer_id, status)`.
5. **`idx_orders_supplier_status`**: B-tree composite index on `(supplier_id, status)`.
6. **`idx_shipments_order_status`**: B-tree composite index on `(order_id, status)`.
7. **`idx_reviews_order_supplier`**: B-tree composite index on `(order_id, supplier_id, status)`.

---

## 3. Query Execution Plans (EXPLAIN ANALYZE)

### Query 1: Catalogue Search with Multi-table Join & Sorting
```sql
EXPLAIN ANALYZE 
SELECT p.id, p.name, p.currency, p.origin_country, c.name as category_name, co.name as company_name 
FROM products p 
JOIN categories c ON p.category_id = c.id 
JOIN suppliers s ON p.supplier_id = s.id 
JOIN companies co ON s.company_id = co.id 
WHERE p.deleted_at IS NULL 
  AND p.is_active = TRUE 
  AND p.status = 'published' 
  AND (p.name ILIKE '%rice%' OR p.description ILIKE '%rice%') 
ORDER BY p.created_at DESC 
LIMIT 20;
```

**Execution Result**:
- **Planning Time**: 25.082 ms
- **Execution Time**: **13.896 ms**
- **Memory**: Top-N Heapsort (33 kB)
- **Status**: PASSED ($\ll 200\text{ ms}$)

---

### Query 2: Full-Text GIN Index Search
```sql
EXPLAIN ANALYZE 
SELECT p.id, p.name, p.currency, p.origin_country 
FROM products p 
WHERE p.deleted_at IS NULL 
  AND p.is_active = TRUE 
  AND p.status = 'published' 
  AND to_tsvector('english', (p.name || ' ' || COALESCE(p.description, ''))) @@ to_tsquery('english', 'rice') 
ORDER BY p.created_at DESC 
LIMIT 20;
```

**Execution Result**:
- **Planning Time**: 19.790 ms
- **Execution Time**: **25.011 ms**
- **Scan Type**: Bitmap Index Scan on `idx_products_fts`
- **Status**: PASSED ($\ll 200\text{ ms}$)

---

### Query 3: Origin & Filter Index Scan
```sql
EXPLAIN ANALYZE 
SELECT p.id, p.name 
FROM products p 
WHERE p.origin_country = 'India' 
  AND p.is_active = TRUE 
  AND p.status = 'published' 
LIMIT 20;
```

**Execution Result**:
- **Planning Time**: 1.401 ms
- **Execution Time**: **0.068 ms**
- **Status**: PASSED ($\ll 200\text{ ms}$)

---

## 4. Idempotency Verification
The scale generator command:
```bash
python -m app.cli seed-scale --suppliers 60 --buyers 150 --products 1500 --rfqs 300 --orders 200
```
was executed in succession:
- **First Run**: Populated 16 categories, 60 suppliers, 150 buyers, 1500 products, 300 RFQs, 200 orders.
- **Second Run**: Verified existing records by deterministic UUIDs and unique business keys. 0 duplicates generated, 0 integrity violations, 100% idempotent.
