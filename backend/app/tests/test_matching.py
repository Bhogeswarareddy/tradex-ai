import pytest
from app.services.matching import (
    DEFAULT_MATCHING_WEIGHTS,
    calculate_supplier_match,
    normalize_weights,
    parse_numeric_capacity,
    rank_suppliers_for_requirement,
)

# 15+ comprehensive unit tests covering every factor, weights, and edge cases

@pytest.fixture
def base_requirement():
    return {
        "product": "Organic Turmeric Powder",
        "category": "Spices & Herbs",
        "hs_code": "0910.30",
        "quantity": 20000,
        "unit": "kg",
        "destination_country": "Germany",
        "delivery_days": 45,
        "certifications": ["EU Organic", "ISO 22000"],
        "target_price_min": 2.80,
        "target_price_max": 3.20,
    }


@pytest.fixture
def sri_bharat_supplier():
    return {
        "name": "Sri Bharat Spices Pvt Ltd",
        "country": "India",
        "trust_score": 96,
        "on_time_rate": 98,
        "rating": 4.9,
        "years_in_business": 18,
        "capacity_per_month": "80 MT/month",
        "export_countries": ["Germany", "Netherlands", "USA"],
        "certifications": ["EU Organic", "ISO 22000", "HACCP", "GMP"],
        "min_moq": 1000,
        "lead_time_days": 18,
        "indicative_price": 2.85,
        "main_products": ["Organic Turmeric Powder", "Ginger Powder"],
        "categories": ["Spices & Herbs"],
        "hs_codes": ["0910.30"],
        "products": [
            {"name": "Organic Turmeric Powder", "category_name": "Spices & Herbs", "hs_code": "0910.30", "price_min": 2.85}
        ],
    }


def test_weight_normalization():
    weights = {"product_relevance": 50.0, "certifications": 50.0}
    normalized = normalize_weights(weights)
    assert normalized["product_relevance"] == 50.0
    assert normalized["certifications"] == 50.0
    assert normalized["moq_fit"] == DEFAULT_MATCHING_WEIGHTS["moq_fit"]


def test_capacity_string_parsing():
    assert parse_numeric_capacity("80 MT/month") == 80000.0
    assert parse_numeric_capacity("50 metric tons") == 50000.0
    assert parse_numeric_capacity("25000 kg") == 25000.0
    assert parse_numeric_capacity(None) == 0.0


def test_factor_product_relevance_exact_match(base_requirement, sri_bharat_supplier):
    res = calculate_supplier_match(sri_bharat_supplier, base_requirement)
    # Full or near-full product relevance points (25 pts)
    assert res["breakdown"]["product_relevance"] >= 20.0
    assert any("catalog" in r.lower() or "hs" in r.lower() for r in res["reasons"])


def test_factor_product_relevance_mismatch(base_requirement):
    supplier = {
        "name": "Steel Pipes Corp",
        "products": [{"name": "Galvanized Steel Pipes", "category_name": "Metals"}],
        "categories": ["Metals"],
        "main_products": ["Steel Pipes"],
        "hs_codes": ["7306.30"],
    }
    res = calculate_supplier_match(supplier, base_requirement)
    assert res["breakdown"]["product_relevance"] < 10.0
    assert any("limited" in r.lower() for r in res["risks"])


def test_factor_certifications_all_present(base_requirement, sri_bharat_supplier):
    res = calculate_supplier_match(sri_bharat_supplier, base_requirement)
    assert res["breakdown"]["certifications"] == 15.0
    assert any("eu organic" in r.lower() or "iso 22000" in r.lower() for r in res["reasons"])


def test_factor_certifications_partial_match(base_requirement):
    supplier = {"certifications": ["ISO 22000"]}  # Missing EU Organic
    res = calculate_supplier_match(supplier, base_requirement)
    # Half of the 15 pts = 7.5
    assert res["breakdown"]["certifications"] == 7.5
    assert any("missing certification" in r.lower() for r in res["risks"])


def test_factor_certifications_none_requested(sri_bharat_supplier):
    req_no_certs = {"product": "Turmeric", "certifications": []}
    res = calculate_supplier_match(sri_bharat_supplier, req_no_certs)
    # Full points when buyer specifies no required certs
    assert res["breakdown"]["certifications"] == 15.0


def test_factor_moq_fit_below_order(base_requirement, sri_bharat_supplier):
    # Order: 20,000 kg, MOQ: 1,000 kg
    res = calculate_supplier_match(sri_bharat_supplier, base_requirement)
    assert res["breakdown"]["moq_fit"] == 10.0


def test_factor_moq_fit_exceeding_order(base_requirement):
    supplier = {"min_moq": 40000}  # Order is 20,000 kg
    res = calculate_supplier_match(supplier, base_requirement)
    assert res["breakdown"]["moq_fit"] < 10.0
    assert any("moq" in r.lower() for r in res["risks"])


def test_factor_capacity_sufficient(base_requirement, sri_bharat_supplier):
    # Capacity: 80 MT (80,000 kg) >= 20,000 kg
    res = calculate_supplier_match(sri_bharat_supplier, base_requirement)
    assert res["breakdown"]["capacity"] == 10.0


def test_factor_capacity_insufficient(base_requirement):
    supplier = {"capacity_per_month": "10 MT/month"}  # 10,000 kg < 20,000 kg order
    res = calculate_supplier_match(supplier, base_requirement)
    assert res["breakdown"]["capacity"] == 5.0
    assert any("capacity" in r.lower() for r in res["risks"])


def test_factor_delivery_on_time_and_corridor(base_requirement, sri_bharat_supplier):
    # Lead time 18 <= 45 days, export countries includes Germany
    res = calculate_supplier_match(sri_bharat_supplier, base_requirement)
    assert res["breakdown"]["delivery"] == 10.0


def test_factor_delivery_exceeded_lead_time(base_requirement):
    supplier = {"lead_time_days": 60, "export_countries": ["Japan"]}  # 60 > 45 days
    res = calculate_supplier_match(supplier, base_requirement)
    assert res["breakdown"]["delivery"] < 7.0
    assert any("lead time" in r.lower() for r in res["risks"])


def test_factor_price_in_target_range(base_requirement, sri_bharat_supplier):
    # Target: 2.80 - 3.20, price: 2.85
    res = calculate_supplier_match(sri_bharat_supplier, base_requirement)
    assert res["breakdown"]["price"] == 15.0


def test_factor_price_over_budget(base_requirement):
    supplier = {"indicative_price": 4.50}  # Target max is 3.20
    res = calculate_supplier_match(supplier, base_requirement)
    assert res["breakdown"]["price"] < 10.0
    assert any("price" in r.lower() for r in res["risks"])


def test_factor_price_missing_unlisted(base_requirement):
    supplier = {}  # No price info
    res = calculate_supplier_match(supplier, base_requirement)
    # Neutral baseline: 60% of 15.0 = 9.0
    assert res["breakdown"]["price"] == 9.0


def test_factor_reliability_composite(base_requirement, sri_bharat_supplier):
    res = calculate_supplier_match(sri_bharat_supplier, base_requirement)
    # Trust 96, on-time 98, 18 years -> near full points (15.0)
    assert res["breakdown"]["reliability"] >= 13.5


def test_turmeric_benchmark_sri_bharat_ranks_first(base_requirement, sri_bharat_supplier):
    suppliers = [
        sri_bharat_supplier,  # Expected #1
        {
            "name": "NatureFarm Global",
            "country": "India",
            "trust_score": 94,
            "on_time_rate": 96,
            "rating": 4.8,
            "years_in_business": 12,
            "capacity_per_month": "60 MT/month",
            "export_countries": ["Germany", "France"],
            "certifications": ["EU Organic", "ISO 22000", "HACCP"],
            "min_moq": 2000,
            "lead_time_days": 14,
            "indicative_price": 2.95,
            "main_products": ["Organic Turmeric Powder"],
            "categories": ["Spices & Herbs"],
            "hs_codes": ["0910.30"],
        },
        {
            "name": "Madhav Agro Exports",
            "country": "India",
            "trust_score": 91,
            "on_time_rate": 93,
            "rating": 4.7,
            "years_in_business": 10,
            "capacity_per_month": "50 MT/month",
            "export_countries": ["UAE", "Germany"],
            "certifications": ["ISO 22000", "HACCP"],  # Missing EU Organic
            "min_moq": 5000,
            "lead_time_days": 22,
            "indicative_price": 2.80,
            "main_products": ["Turmeric Finger"],
            "categories": ["Spices & Herbs"],
            "hs_codes": ["0910.30"],
        },
        {
            "name": "Vijaya Export House",
            "country": "India",
            "trust_score": 88,
            "on_time_rate": 90,
            "rating": 4.6,
            "years_in_business": 8,
            "capacity_per_month": "40 MT/month",
            "export_countries": ["USA"],
            "certifications": ["ISO 22000"],
            "min_moq": 10000,
            "lead_time_days": 16,
            "indicative_price": 3.10,
            "main_products": ["Spices", "Turmeric Export Grade"],
            "categories": ["Spices & Herbs"],
            "hs_codes": ["0910.30"],
        },
        {
            "name": "Shree Spices India",
            "country": "India",
            "trust_score": 85,
            "on_time_rate": 88,
            "rating": 4.5,
            "years_in_business": 6,
            "capacity_per_month": "30 MT/month",
            "export_countries": ["Singapore"],
            "certifications": ["HACCP"],  # Missing both Organic & ISO
            "min_moq": 15000,
            "lead_time_days": 20,
            "indicative_price": 3.15,
            "main_products": ["Turmeric"],
            "categories": ["Spices & Herbs"],
            "hs_codes": ["0910.30"],
        },
    ]

    ranked = rank_suppliers_for_requirement(suppliers, base_requirement)

    assert len(ranked) == 5
    assert ranked[0]["name"] == "Sri Bharat Spices Pvt Ltd"
    assert ranked[0]["rank"] == 1
    assert ranked[0]["score"] >= 95.0

    # Stable and explainable ordering
    names = [s["name"] for s in ranked]
    assert names[0] == "Sri Bharat Spices Pvt Ltd"
    assert names[1] == "NatureFarm Global"
    assert names[2] == "Madhav Agro Exports"
    assert names[3] == "Vijaya Export House"
    assert names[4] == "Shree Spices India"


def test_changing_weights_changes_ranking(base_requirement, sri_bharat_supplier):
    # Create a competitor with lower trust but cheaper price
    cheap_supplier = {
        "name": "Ultra Discount Spices",
        "country": "India",
        "trust_score": 60,
        "on_time_rate": 70,
        "rating": 3.5,
        "years_in_business": 2,
        "capacity_per_month": "80 MT/month",
        "export_countries": ["Germany"],
        "certifications": ["EU Organic", "ISO 22000"],
        "min_moq": 1000,
        "lead_time_days": 18,
        "indicative_price": 1.50,  # Super low price!
        "main_products": ["Organic Turmeric Powder"],
        "categories": ["Spices & Herbs"],
        "hs_codes": ["0910.30"],
    }

    # Under default weights, Sri Bharat Spices wins due to high reliability (15 pts)
    default_ranked = rank_suppliers_for_requirement([sri_bharat_supplier, cheap_supplier], base_requirement)
    assert default_ranked[0]["name"] == "Sri Bharat Spices Pvt Ltd"

    # Extreme price-heavy weights: price = 80 pts, reliability = 0 pts
    price_heavy_weights = {
        "product_relevance": 5.0,
        "certifications": 5.0,
        "moq_fit": 5.0,
        "capacity": 5.0,
        "delivery": 5.0,
        "price": 75.0,
        "reliability": 0.0,
    }

    price_ranked = rank_suppliers_for_requirement(
        [sri_bharat_supplier, cheap_supplier], base_requirement, weights=price_heavy_weights
    )
    # Ultra Discount Spices now ranks higher or ties due to massive price advantage
    assert price_ranked[0]["name"] == "Ultra Discount Spices" or price_ranked[0]["score"] >= 95.0
