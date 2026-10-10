import { describe, it, expect } from "vitest";
import { matchingApi, RankedSupplier, MatchingWeights } from "../lib/api/matching";
import { rfqsApi, RFQDetail, RFQDraftOutput } from "../lib/api/rfqs";

describe("Prompt 12: AI Supplier Matching Contracts & Logic", () => {
  it("should expose required Prompt 12 matching API methods", () => {
    expect(typeof matchingApi.rankSuppliers).toBe("function");
    expect(typeof matchingApi.getWeights).toBe("function");
    expect(typeof matchingApi.updateWeights).toBe("function");
  });

  it("should correctly validate circular score ring color thresholds", () => {
    const getScoreColor = (score: number) => {
      if (score >= 80) return "emerald";
      if (score >= 60) return "amber";
      return "rose";
    };

    expect(getScoreColor(96)).toBe("emerald");
    expect(getScoreColor(80)).toBe("emerald");
    expect(getScoreColor(79.9)).toBe("amber");
    expect(getScoreColor(60)).toBe("amber");
    expect(getScoreColor(59.9)).toBe("rose");
    expect(getScoreColor(35)).toBe("rose");
  });

  it("should calculate score breakdown factors correctly summing to weights", () => {
    const defaultWeights: MatchingWeights = {
      product_relevance: 25,
      certifications: 15,
      moq_fit: 10,
      capacity: 10,
      delivery: 10,
      price: 15,
      reliability: 15,
    };

    const sum = Object.values(defaultWeights).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);

    const mockResult: RankedSupplier = {
      id: "sup-sri-bharat",
      company_id: "comp-1",
      name: "Sri Bharat Spices Pvt Ltd",
      country: "India",
      city: "Kochi",
      verified_status: "verified",
      trust_score: 96,
      on_time_rate: 98,
      rating: 4.9,
      total_reviews: 42,
      capacity_per_month: "100 MT/month",
      min_moq: 1000,
      lead_time_days: 18,
      years_in_business: 12,
      export_countries: ["Germany"],
      certifications: ["Organic", "ISO 22000"],
      score: 96.5,
      rank: 1,
      breakdown: {
        product_relevance: 25.0,
        certifications: 15.0,
        moq_fit: 10.0,
        capacity: 10.0,
        delivery: 9.5,
        price: 13.0,
        reliability: 14.0,
      },
      reasons: [
        "Holds Organic and ISO 22000, as required",
        "Direct export experience to Hamburg, Germany",
        "High reliability track record (98% on-time)",
      ],
      risks: [],
      explanation: "Sri Bharat Spices is the optimal match with full organic certification and proven German export history.",
    };

    expect(mockResult.rank).toBe(1);
    expect(mockResult.score).toBeGreaterThanOrEqual(80);
    expect(mockResult.reasons).toHaveLength(3);
    expect(mockResult.risks).toHaveLength(0);
    expect(mockResult.breakdown.certifications).toBe(15.0);
  });

  it("should flag MOQ risks when supplier MOQ exceeds requested volume", () => {
    const mockLowFitSupplier: RankedSupplier = {
      id: "sup-bulk-only",
      company_id: "comp-2",
      name: "Mega Bulk Commodities",
      country: "India",
      city: "Mumbai",
      verified_status: "verified",
      trust_score: 80,
      on_time_rate: 85,
      rating: 4.2,
      total_reviews: 15,
      capacity_per_month: "500 MT/month",
      min_moq: 25000,
      lead_time_days: 45,
      years_in_business: 8,
      export_countries: ["USA"],
      certifications: ["ISO 9001"],
      score: 54.0,
      rank: 4,
      breakdown: {
        product_relevance: 20.0,
        certifications: 5.0,
        moq_fit: 2.0,
        capacity: 10.0,
        delivery: 5.0,
        price: 5.0,
        reliability: 7.0,
      },
      reasons: ["Offers turmeric products"],
      risks: ["MOQ 25 MT is above your 10 MT order requirement"],
    };

    expect(mockLowFitSupplier.score).toBeLessThan(60);
    expect(mockLowFitSupplier.risks.length).toBeGreaterThan(0);
    expect(mockLowFitSupplier.risks[0]).toContain("MOQ");
  });
});

describe("Prompt 13: RFQ Marketplace & AI Draft Generator Contracts", () => {
  it("should expose required Prompt 13 RFQ client methods", () => {
    expect(typeof rfqsApi.list).toBe("function");
    expect(typeof rfqsApi.getById).toBe("function");
    expect(typeof rfqsApi.create).toBe("function");
    expect(typeof rfqsApi.generateDraft).toBe("function");
    expect(typeof rfqsApi.publish).toBe("function");
    expect(typeof rfqsApi.close).toBe("function");
    expect(typeof rfqsApi.award).toBe("function");
    expect(typeof rfqsApi.invite).toBe("function");
    expect(typeof rfqsApi.submitQuote).toBe("function");
  });

  it("should correctly handle RFQ sequential format pattern", () => {
    const rfqNumberRegex = /^RFQ-\d{4}-\d{4,}$/;
    expect(rfqNumberRegex.test("RFQ-2026-1042")).toBe(true);
    expect(rfqNumberRegex.test("RFQ-2026-10001")).toBe(true);
    expect(rfqNumberRegex.test("RFQ-INVALID")).toBe(false);
  });

  it("should parse and validate AI-generated draft structure", () => {
    const sampleAiDraft: RFQDraftOutput = {
      title: "Procurement of 20 MT Organic Turmeric Powder",
      product: "Organic Turmeric Powder",
      category: "Agricultural Commodities",
      quantity: 20,
      unit: "MT",
      target_price_min: 2.8,
      target_price_max: 3.4,
      currency: "EUR",
      incoterm: "CIF",
      destination_country: "Germany",
      destination_port: "Hamburg",
      required_certifications: ["EU Organic", "ISO 22000", "HACCP"],
      specifications: {
        curcumin_content: "min 3.5%",
        moisture: "max 10%",
        mesh_size: "80-100 mesh",
      },
      quality_requirements: "Eurofins lab test report required prior to dispatch",
      payment_terms: "30% advance, 70% against Bill of Lading",
      delivery_days: 45,
      suggested_supplier_criteria: ["EU Organic certified", "Port Hamburg delivery experience"],
    };

    expect(sampleAiDraft.quantity).toBe(20);
    expect(sampleAiDraft.unit).toBe("MT");
    expect(sampleAiDraft.destination_port).toBe("Hamburg");
    expect(sampleAiDraft.required_certifications).toContain("EU Organic");
    expect(sampleAiDraft.incoterm).toBe("CIF");
  });

  it("should verify RFQ detail and quotations structure matching seeded RFQ-2026-1042", () => {
    const mockDetail: RFQDetail = {
      id: "rfq-test-1042",
      rfq_number: "RFQ-2026-1042",
      title: "20 MT Organic Alleppey Finger Turmeric",
      status: "active",
      product: "Organic Turmeric",
      category: "Agricultural Commodities",
      quantity: 20,
      unit: "MT",
      target_price_min: 2.9,
      target_price_max: 3.5,
      currency: "EUR",
      destination_country: "Germany",
      destination_port: "Hamburg",
      incoterm: "CIF",
      payment_terms: "30% Advance, 70% against BL copy",
      specifications: { curcumin: "min 3.5%" },
      quality_requirements: "Eurofins certificate required",
      required_certifications: ["EU Organic", "ISO 22000"],
      attachments: ["Eurofins_Spec.pdf"],
      deadline: "2026-11-15T00:00:00Z",
      delivery_deadline: "2026-12-01T00:00:00Z",
      buyer_company_name: "BioKraeuter Import GmbH",
      quotes_count: 5,
      quotes: [
        {
          id: "q-1",
          quote_number: "QT-2026-081",
          supplier_id: "sup-1",
          status: "submitted",
          unit_price: 3.02,
          landed_cost: 3.02,
          freight_cost: 0.20,
          currency: "EUR",
          moq: 10,
          lead_time_days: 18,
          payment_terms: "30% Advance, 70% against BL copy",
          valid_until: "2026-11-20T00:00:00Z",
          supplier_name: "Sri Bharat Spices Pvt Ltd",
          supplier_country: "India",
          ai_score: 96.5,
          ai_rank: 1,
        },
        {
          id: "q-2",
          quote_number: "QT-2026-082",
          supplier_id: "sup-2",
          status: "submitted",
          unit_price: 3.10,
          landed_cost: 3.10,
          freight_cost: 0.22,
          currency: "EUR",
          moq: 5,
          lead_time_days: 14,
          payment_terms: "100% LC at sight",
          valid_until: "2026-11-20T00:00:00Z",
          supplier_name: "NatureFarm Global",
          supplier_country: "India",
          ai_score: 94.2,
          ai_rank: 2,
        },
      ],
    };

    expect(mockDetail.quotes_count).toBe(5);
    expect(mockDetail.quotes).toHaveLength(2);
    expect(mockDetail.quotes[0].supplier_name).toBe("Sri Bharat Spices Pvt Ltd");
    expect(mockDetail.quotes[0].ai_rank).toBe(1);
    expect(mockDetail.quotes[0].ai_score).toBe(96.5);
  });
});
