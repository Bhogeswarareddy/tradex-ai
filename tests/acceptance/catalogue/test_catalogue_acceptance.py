"""
TradeX AI Catalogue Acceptance Test Suite
Prompt 17: Role-Based Screens and Catalogue Acceptance Tests (12 Test Cases)

1. Supplier creates a product and saves valid data
2. Draft is not public
3. After publish and Ready indexing, AI retrieves its description
4. AI states price and availability from current database records
5. Updating price changes next AI answer without relying on vector content
6. Updating specifications triggers index update
7. Unpublishing or removing product removes it from results and vectors
8. Buyer cannot access another buyer's private data
9. Supplier cannot modify another supplier's products or read private documents
10. Normal user gets 403 on admin endpoints even knowing URL or admin email
11. Valid admin can manage platform records and every sensitive action appears in audit log
12. Provider or indexing failures show honest error status, never false success
"""

import sys
from pathlib import Path

# Ensure backend package can be imported
backend_dir = Path(__file__).resolve().parent.parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.tests.test_catalogue_acceptance import (
    test_case_01_supplier_creates_product_saves_valid_data,
    test_case_02_draft_product_is_not_public,
    test_case_03_publish_and_ready_indexing_retrieves_description,
    test_case_04_ai_states_price_and_availability_from_current_db_records,
    test_case_05_updating_price_changes_ai_answer_without_vector_reindex,
    test_case_06_updating_specifications_triggers_index_update,
    test_case_07_unpublishing_removes_from_results_and_vectors,
    test_case_08_buyer_cannot_access_another_buyer_private_data,
    test_case_09_supplier_cannot_modify_another_supplier_product_or_read_private_docs,
    test_case_10_normal_user_gets_403_on_admin_endpoints,
    test_case_11_valid_admin_can_manage_records_and_actions_appear_in_audit_log,
    test_case_12_provider_or_indexing_failures_show_honest_error_status,
)

__all__ = [
    "test_case_01_supplier_creates_product_saves_valid_data",
    "test_case_02_draft_product_is_not_public",
    "test_case_03_publish_and_ready_indexing_retrieves_description",
    "test_case_04_ai_states_price_and_availability_from_current_db_records",
    "test_case_05_updating_price_changes_ai_answer_without_vector_reindex",
    "test_case_06_updating_specifications_triggers_index_update",
    "test_case_07_unpublishing_removes_from_results_and_vectors",
    "test_case_08_buyer_cannot_access_another_buyer_private_data",
    "test_case_09_supplier_cannot_modify_another_supplier_product_or_read_private_docs",
    "test_case_10_normal_user_gets_403_on_admin_endpoints",
    "test_case_11_valid_admin_can_manage_records_and_actions_appear_in_audit_log",
    "test_case_12_provider_or_indexing_failures_show_honest_error_status",
]
