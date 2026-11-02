#!/usr/bin/env bash
set -euo pipefail

echo "==> 1. Inserting test product before reboot..."
echo "INSERT INTO products (id, supplier_id, category_id, name, slug, description, origin_country, status, is_active, created_at, updated_at) VALUES (gen_random_uuid(), (SELECT id FROM suppliers LIMIT 1), (SELECT id FROM categories LIMIT 1), 'Persistence Test Product - Premium Organic Cardamom', 'persistence-test-cardamom-prod', 'Reboot persistence verification item', 'India', 'published', true, now(), now());" | docker exec -i pg_db psql -U tradex_user -d tradex

echo "==> 2. Verifying product was inserted..."
echo "SELECT name, status, created_at FROM products WHERE slug = 'persistence-test-cardamom-prod';" | docker exec -i pg_db psql -U tradex_user -d tradex
