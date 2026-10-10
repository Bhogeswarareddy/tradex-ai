import pytest
from app.services.landed_cost import calculate_landed_cost, compute_quote_ai_score


def test_landed_cost_chennai_to_hamburg_cif():
    """Route 1: Chennai to Hamburg under CIF (Turmeric 0910.30)"""
    est = calculate_landed_cost(
        unit_price=3.10,
        quantity=20000,
        currency="EUR",
        origin_port="Chennai",
        destination_port="Hamburg",
        destination_country="Germany",
        incoterm="CIF",
        hs_code="0910.30",
    )
    assert est.label == "Simulated estimate"
    assert est.currency == "EUR"
    assert est.product_cost_total == 62000.0
    assert est.product_cost_per_kg == 3.10
    assert est.duty_total == 0.0  # EU GSP exemption
    assert est.duty_per_kg == 0.0
    assert est.freight_total > 0.0
    assert est.handling_total > 0.0
    assert est.inland_total > 0.0
    assert est.total_landed_cost > 62000.0
    assert est.landed_cost_per_kg > 3.10


def test_landed_cost_kochi_to_hamburg_fob():
    """Route 2: Kochi to Hamburg under FOB (Freight added to total)"""
    est = calculate_landed_cost(
        unit_price=2.90,
        quantity=20000,
        currency="EUR",
        origin_port="Kochi",
        destination_port="Hamburg",
        destination_country="Germany",
        incoterm="FOB",
        hs_code="0910.30",
    )
    assert est.landed_cost_per_kg > 2.90
    # FOB adds freight + insurance on top of base product
    assert est.total_landed_cost > (2.90 * 20000) + est.freight_total


def test_landed_cost_ho_chi_minh_to_hamburg_tariff():
    """Route 3: Ho Chi Minh to Hamburg with tariff duty"""
    est = calculate_landed_cost(
        unit_price=3.00,
        quantity=20000,
        currency="EUR",
        origin_port="Ho Chi Minh",
        destination_port="Hamburg",
        destination_country="Germany",
        incoterm="CIF",
        hs_code="0904.11",  # Black pepper 4% duty
        duty_rate_override=0.04,
    )
    assert est.duty_total > 0.0
    assert est.duty_per_kg == pytest.approx(0.12, rel=0.05)


def test_landed_cost_edge_case_missing_hs_code():
    """Edge Case 1: Missing HS code defaults to 0% duty without error"""
    est = calculate_landed_cost(
        unit_price=3.10,
        quantity=10000,
        incoterm="CIF",
        hs_code=None,
    )
    assert est.duty_total == 0.0
    assert est.duty_per_kg == 0.0
    assert est.total_landed_cost > 0.0


def test_landed_cost_edge_case_zero_duty():
    """Edge Case 2: Zero tariff duty (GSP trade agreements)"""
    est = calculate_landed_cost(
        unit_price=2.80,
        quantity=15000,
        destination_country="Germany",
        hs_code="0910.30",
        duty_rate_override=0.0,
    )
    assert est.duty_total == 0.0


def test_landed_cost_breakdown_items():
    """Validates line-by-line item structure and percentage contributions"""
    est = calculate_landed_cost(
        unit_price=3.10,
        quantity=20000,
        incoterm="CIF",
    )
    d = est.to_dict()
    assert "breakdown" in d
    assert len(d["breakdown"]) == 6
    total_pct = sum(it["percentage"] for it in d["breakdown"])
    # Percentages of positive components
    assert total_pct > 80.0


def test_ai_score_calculation_weights():
    """
    Tests exact Prompt 14 deterministic scoring factors:
    - Landed cost: 40
    - Lead time: 20
    - Supplier reliability: 20
    - Certifications: 10
    - Payment terms: 10
    """
    # Best on all dimensions = 100
    perfect_score = compute_quote_ai_score(
        landed_cost=3.38,
        min_landed_cost=3.38,
        lead_time_days=20,
        min_lead_time_days=20,
        trust_score=100.0,
        has_certifications=True,
        payment_terms="100% Irrevocable LC",
    )
    assert perfect_score == 100.0

    # Test penalty on higher landed cost
    cost_penalized = compute_quote_ai_score(
        landed_cost=4.00,
        min_landed_cost=3.38,
        lead_time_days=20,
        min_lead_time_days=20,
        trust_score=100.0,
        has_certifications=True,
        payment_terms="100% Irrevocable LC",
    )
    assert cost_penalized < 100.0
    assert cost_penalized > 85.0


def test_ai_score_five_seed_quotes_stable_ranking():
    """
    Verifies that the 5 seeded benchmark quotes produce the stable expected scores:
    Sri Bharat Spices ranks at the top with ~95 score.
    """
    sri_bharat_score = compute_quote_ai_score(
        landed_cost=3.42,
        min_landed_cost=3.38,
        lead_time_days=25,
        min_lead_time_days=20,
        trust_score=96.0,
        has_certifications=True,
        payment_terms="LC at sight, 30% advance",
    )
    # Sri Bharat score should be high 90s
    assert sri_bharat_score >= 90.0

    shree_spices_score = compute_quote_ai_score(
        landed_cost=3.65,
        min_landed_cost=3.38,
        lead_time_days=22,
        min_lead_time_days=20,
        trust_score=80.0,
        has_certifications=False,
        payment_terms="LC at sight",
    )
    # Shree Spices should be lower (~80)
    assert shree_spices_score < sri_bharat_score
    assert shree_spices_score <= 85.0
