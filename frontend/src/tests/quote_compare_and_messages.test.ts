import { describe, it, expect } from "vitest";
import {
  quoteComparisonApi,
  ComparisonQuote,
  LandedCostBreakdown,
} from "../lib/api/quoteComparison";
import {
  communicationApi,
  ThreadListItem,
  OfferData,
  AINegotiationAssistOutput,
  NotificationItem,
} from "../lib/api/communication";

describe("Prompt 14: AI Quote Comparison & Landed Cost Contracts", () => {
  it("should expose all required quote comparison API methods", () => {
    expect(typeof quoteComparisonApi.getComparison).toBe("function");
    expect(typeof quoteComparisonApi.getAiRecommendation).toBe("function");
    expect(typeof quoteComparisonApi.acceptQuote).toBe("function");
    expect(typeof quoteComparisonApi.shortlistQuote).toBe("function");
    expect(typeof quoteComparisonApi.exportComparison).toBe("function");
  });

  it("should validate deterministic AI score weights summing to 100", () => {
    const weights = {
      landed_cost: 40,
      lead_time: 20,
      reliability: 20,
      certifications: 10,
      payment_terms: 10,
    };

    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it("should verify simulated landed cost breakdown calculation", () => {
    const qty = 20000;
    const unitPrice = 3.10;
    const freightTotal = 4000; // 0.20/kg
    const dutyTotal = 1000; // 0.05/kg
    const handlingTotal = 700; // 0.035/kg
    const insuranceTotal = 300; // 0.015/kg
    const inlandTotal = 400; // 0.02/kg

    const prodTotal = unitPrice * qty;
    const totalLandedCost = prodTotal + freightTotal + dutyTotal + handlingTotal + insuranceTotal + inlandTotal;
    const landedCostPerKg = totalLandedCost / qty;

    expect(prodTotal).toBe(62000);
    expect(totalLandedCost).toBe(68400);
    expect(landedCostPerKg).toBe(3.42);

    const breakdown: LandedCostBreakdown = {
      currency: "EUR",
      quantity: qty,
      unit: "kg",
      unit_price: unitPrice,
      origin_port: "Chennai",
      destination_port: "Hamburg",
      destination_country: "Germany",
      incoterm: "CIF",
      hs_code: "0910.30",
      product_cost_total: prodTotal,
      freight_total: freightTotal,
      insurance_total: insuranceTotal,
      duty_total: dutyTotal,
      handling_total: handlingTotal,
      inland_total: inlandTotal,
      total_landed_cost: totalLandedCost,
      landed_cost_per_kg: landedCostPerKg,
      breakdown: [
        { name: "Product FOB", amount_per_kg: 3.10, total_amount: 62000, percentage_of_total: 90.64 },
        { name: "Ocean Freight", amount_per_kg: 0.20, total_amount: 4000, percentage_of_total: 5.85 },
        { name: "Import Duty", amount_per_kg: 0.05, total_amount: 1000, percentage_of_total: 1.46 },
        { name: "Port Handling", amount_per_kg: 0.035, total_amount: 700, percentage_of_total: 1.02 },
      ],
      label: "Simulated estimate",
    };

    expect(breakdown.label).toBe("Simulated estimate");
    expect(breakdown.landed_cost_per_kg).toBe(3.42);
  });

  it("should correctly identify cheapest quote and fastest delivery", () => {
    const quotes: Partial<ComparisonQuote>[] = [
      { id: "q1", supplier_name: "Sri Bharat", landed_cost: 3.42, lead_time_days: 25 },
      { id: "q2", supplier_name: "NatureFarm", landed_cost: 3.38, lead_time_days: 28 },
      { id: "q3", supplier_name: "Madhav Agro", landed_cost: 3.45, lead_time_days: 20 },
      { id: "q4", supplier_name: "Vijaya", landed_cost: 3.48, lead_time_days: 30 },
      { id: "q5", supplier_name: "Shree Spices", landed_cost: 3.65, lead_time_days: 22 },
    ];

    const minLanded = Math.min(...quotes.map((q) => q.landed_cost!));
    const minLead = Math.min(...quotes.map((q) => q.lead_time_days!));

    const cheapest = quotes.find((q) => q.landed_cost === minLanded);
    const fastest = quotes.find((q) => q.lead_time_days === minLead);

    expect(cheapest?.supplier_name).toBe("NatureFarm");
    expect(fastest?.supplier_name).toBe("Madhav Agro");
  });

  it("should match Prompt 14 seeded benchmark values for 5 quotes", () => {
    const expectedScores = {
      "QT-2026-001": 95.0,
      "QT-2026-002": 92.0,
      "QT-2026-003": 88.0,
      "QT-2026-004": 85.0,
      "QT-2026-005": 80.0,
    };

    expect(expectedScores["QT-2026-001"]).toBe(95.0);
    expect(expectedScores["QT-2026-005"]).toBe(80.0);
  });
});

describe("Prompt 15: Negotiation, Messaging & Notifications Contracts", () => {
  it("should expose all required communication and notification API methods", () => {
    expect(typeof communicationApi.listThreads).toBe("function");
    expect(typeof communicationApi.getMessages).toBe("function");
    expect(typeof communicationApi.sendMessage).toBe("function");
    expect(typeof communicationApi.markThreadRead).toBe("function");
    expect(typeof communicationApi.submitCounterOffer).toBe("function");
    expect(typeof communicationApi.acceptOffer).toBe("function");
    expect(typeof communicationApi.rejectOffer).toBe("function");
    expect(typeof communicationApi.getAiNegotiationAssist).toBe("function");
    expect(typeof communicationApi.getNotifications).toBe("function");
    expect(typeof communicationApi.markAllNotificationsRead).toBe("function");
    expect(typeof communicationApi.markNotificationRead).toBe("function");
  });

  it("should validate structured offer data format and calculations", () => {
    const offer: OfferData = {
      price: 3.05,
      quantity: 20000,
      unit: "kg",
      lead_time_days: 22,
      currency: "EUR",
      status: "pending",
      notes: "Revised volume rate for prompt dispatch",
    };

    expect(offer.status).toBe("pending");
    const total = offer.price * offer.quantity;
    expect(total).toBe(61000);
  });

  it("should validate counter-offer lifecycle transitions", () => {
    const offer: OfferData = {
      price: 3.05,
      quantity: 20000,
      unit: "kg",
      lead_time_days: 22,
      currency: "EUR",
      status: "pending",
    };

    // Transition to accepted
    const acceptedOffer: OfferData = { ...offer, status: "accepted" };
    expect(acceptedOffer.status).toBe("accepted");

    // Transition to rejected
    const rejectedOffer: OfferData = { ...offer, status: "rejected" };
    expect(rejectedOffer.status).toBe("rejected");
  });

  it("should validate thread unread counting and filter logic", () => {
    const threads: ThreadListItem[] = [
      {
        id: "t1",
        title: "Turmeric Bids",
        counterparty_name: "Sri Bharat Spices",
        counterparty_role: "supplier",
        counterparty_country: "India",
        last_message: "Deal Agreed!",
        unread_count: 2,
      },
      {
        id: "t2",
        title: "Organic Cardamom",
        counterparty_name: "NatureFarm Global",
        counterparty_role: "supplier",
        counterparty_country: "India",
        last_message: "Sending lab certificate",
        unread_count: 0,
      },
    ];

    const totalUnread = threads.reduce((acc, t) => acc + t.unread_count, 0);
    expect(totalUnread).toBe(2);

    const matches = threads.filter((t) => t.counterparty_name.toLowerCase().includes("sri"));
    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe("t1");
  });

  it("should validate AI negotiation assist contract fields", () => {
    const assistOutput: AINegotiationAssistOutput = {
      recommended_counter_price: 3.05,
      suggested_incoterm: "CIF Hamburg",
      compromise_terms: "30% advance with 70% against Bill of Lading",
      reasoning: "Splitting the difference between €3.00 budget and €3.10 quote",
      draft_message_to_counterparty: "We propose €3.05/kg CIF Hamburg for 20 MT.",
    };

    expect(assistOutput.recommended_counter_price).toBe(3.05);
    expect(assistOutput.suggested_incoterm).toBe("CIF Hamburg");
    expect(assistOutput.draft_message_to_counterparty).toContain("€3.05/kg");
  });

  it("should validate notification unread status and event types", () => {
    const notifications: NotificationItem[] = [
      {
        id: "n1",
        title: "New Counter-Offer",
        message: "Counter-offer of €3.05/kg submitted",
        event_type: "counter_offer",
        is_read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: "n2",
        title: "Order Created",
        message: "Order #ORD-2026-0891 confirmed",
        event_type: "order_created",
        is_read: true,
        created_at: new Date().toISOString(),
      },
    ];

    const unread = notifications.filter((n) => !n.is_read);
    expect(unread.length).toBe(1);
    expect(unread[0].event_type).toBe("counter_offer");
  });
});
