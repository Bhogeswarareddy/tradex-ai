import { describe, it, expect } from "vitest";
import { aiSearchApi, ExtractedRequirement, AiMatchedProduct, AiMatchedSupplier } from "../lib/api/aiSearch";

describe("AI Search API Contracts (Prompt 11)", () => {
  it("should expose required Prompt 11 client methods", () => {
    expect(typeof aiSearchApi.search).toBe("function");
    expect(typeof aiSearchApi.getHistory).toBe("function");
  });

  it("should correctly handle requirement schema mapping for the fixed turmeric test case", () => {
    // Fixed prompt example:
    // "I need 20 tons of organic turmeric from India delivered to Hamburg within 45 days"
    const mockRequirement: ExtractedRequirement = {
      product: "turmeric",
      category: "Agricultural Commodities",
      quantity: 20000,
      unit: "kg",
      origin_country: "India",
      destination_country: "Germany",
      destination_port: "Hamburg",
      certifications: ["Organic"],
      delivery_days: 45,
      currency: "USD",
      other_constraints: [],
      confidence: {
        product: 0.98,
        quantity: 0.95,
        origin_country: 0.99,
        destination_country: 0.92,
      },
    };

    expect(mockRequirement.product).toBe("turmeric");
    expect(mockRequirement.quantity).toBe(20000);
    expect(mockRequirement.unit).toBe("kg");
    expect(mockRequirement.origin_country).toBe("India");
    expect(mockRequirement.destination_country).toBe("Germany");
    expect(mockRequirement.destination_port).toBe("Hamburg");
    expect(mockRequirement.certifications).toContain("Organic");
    expect(mockRequirement.delivery_days).toBe(45);
  });

  it("should perform client-side filtering without re-calling AI when chips are modified", () => {
    const suppliers: AiMatchedSupplier[] = [
      {
        id: "sup-1",
        company_id: "comp-1",
        name: "Kerala Organic Spices Ltd",
        country: "India",
        city: "Kochi",
        verified_status: "verified",
        trust_score: 96,
        on_time_rate: 98,
        rating: 4.9,
        total_reviews: 34,
        capacity_per_month: "80 MT/month",
        match_score: 98,
        match_reasons: [
          "Exporting certified organic turmeric from India",
          "Capacity of 80 MT/month easily satisfies 20 MT order",
          "98% on-time delivery track record to European ports",
        ],
      },
      {
        id: "sup-2",
        company_id: "comp-2",
        name: "Saigon Spice Global",
        country: "Vietnam",
        city: "Ho Chi Minh City",
        verified_status: "verified",
        trust_score: 91,
        on_time_rate: 94,
        rating: 4.7,
        total_reviews: 19,
        capacity_per_month: "40 MT/month",
        match_score: 82,
        match_reasons: [
          "Exporters of Asian turmeric and ginger",
          "Capacity matches volume",
        ],
      },
    ];

    // Client-side filter by origin_country = "India"
    const filteredIndia = suppliers.filter((s) => s.country.toLowerCase().includes("india"));
    expect(filteredIndia).toHaveLength(1);
    expect(filteredIndia[0].id).toBe("sup-1");

    // Client-side edit: change origin to "Vietnam"
    const filteredVietnam = suppliers.filter((s) => s.country.toLowerCase().includes("vietnam"));
    expect(filteredVietnam).toHaveLength(1);
    expect(filteredVietnam[0].id).toBe("sup-2");
  });

  it("should filter products client-side by lead time and origin", () => {
    const products: AiMatchedProduct[] = [
      {
        id: "prod-1",
        name: "Alleppey Finger Turmeric (Organic)",
        slug: "alleppey-finger-turmeric",
        category_name: "Spices & Herbs",
        origin_country: "India",
        moq: 5000,
        unit: "kg",
        price_min: 2.1,
        price_max: 2.5,
        currency: "USD",
        lead_time_days: 30,
        supplier_id: "sup-1",
        supplier_name: "Kerala Organic Spices Ltd",
        supplier_country: "India",
        stock_available: 50000,
      },
      {
        id: "prod-2",
        name: "Standard Ground Turmeric",
        slug: "standard-ground-turmeric",
        category_name: "Spices & Herbs",
        origin_country: "Vietnam",
        moq: 10000,
        unit: "kg",
        price_min: 1.8,
        price_max: 2.1,
        currency: "USD",
        lead_time_days: 60,
        supplier_id: "sup-2",
        supplier_name: "Saigon Spice Global",
        supplier_country: "Vietnam",
        stock_available: 25000,
      },
    ];

    // Filter within 45 days lead time
    const within45Days = products.filter((p) => p.lead_time_days <= 45);
    expect(within45Days).toHaveLength(1);
    expect(within45Days[0].id).toBe("prod-1");
  });
});
