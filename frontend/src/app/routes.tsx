import React from "react";
import { Routes, Route } from "react-router-dom";
import { HomePage, ModulePlaceholderPage, NotFoundPage } from "../pages";

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/suppliers"
        element={
          <ModulePlaceholderPage
            title="Supplier Profiles & Verification"
            description="Verified supplier capabilities, compliance certifications, and auditing."
          />
        }
      />
      <Route
        path="/products"
        element={
          <ModulePlaceholderPage
            title="Product Catalog & Specifications"
            description="Multi-tier categories, specifications, and volume pricing tiers."
          />
        }
      />
      <Route
        path="/rfqs"
        element={
          <ModulePlaceholderPage
            title="RFQs & AI Quote Comparison"
            description="Automated RFQ distribution and multi-supplier bid matrix comparison."
          />
        }
      />
      <Route
        path="/negotiations"
        element={
          <ModulePlaceholderPage
            title="Negotiation Chat & Counter-Offer Engine"
            description="Real-time communication with automated counter-offer guidance."
          />
        }
      />
      <Route
        path="/orders"
        element={
          <ModulePlaceholderPage
            title="Orders & Milestone Tracking"
            description="Milestone contract generation and multi-modal shipment timeline."
          />
        }
      />
      <Route
        path="/copilot"
        element={
          <ModulePlaceholderPage
            title="AI Trade Copilot (RAG)"
            description="Retrieval-Augmented Generation assistant for international trade."
          />
        }
      />
      <Route
        path="/analytics"
        element={
          <ModulePlaceholderPage
            title="Analytics & Spend Reporting"
            description="Spend analytics, supplier fulfillment reliability, and trade metrics."
          />
        }
      />
      <Route
        path="/admin"
        element={
          <ModulePlaceholderPage
            title="Admin & Platform Governance"
            description="Role-based access, audit logging, and platform administration."
          />
        }
      />
      <Route
        path="/simulated/finance"
        element={
          <ModulePlaceholderPage
            title="Trade Finance & Milestone Escrow"
            description="Simulated payments, escrow hold & release, customs tariffs, and freight."
            simulated={true}
          />
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
