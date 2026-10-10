import React from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import {
  HomePage,
  ModulePlaceholderPage,
  NotFoundPage,
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ProfilePage,
  DesignSystemPage,
  ProductsPage,
  ProductDetailPage,
  SuppliersPage,
  SupplierDetailPage,
  SupplierPortalPage,
  AiSearchPage,
  RfqsPage,
  RfqDetailPage,
} from "../pages";
import { AppLayout } from "../components/layout";
import { RoleGuard } from "../features/auth";

const LayoutWrapper: React.FC = () => {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Standalone Authentication Pages (No sidebar layout) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Main Dashboard Pages (Inside AppLayout) */}
      <Route element={<LayoutWrapper />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<AiSearchPage />} />
        <Route path="/ai-search" element={<AiSearchPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:slug" element={<ProductDetailPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
        <Route
          path="/supplier/*"
          element={
            <RoleGuard allowedRoles={["supplier", "admin"]}>
              <SupplierPortalPage />
            </RoleGuard>
          }
        />
        <Route path="/rfq" element={<RfqsPage />} />
        <Route path="/rfqs" element={<RfqsPage />} />
        <Route path="/rfq/:id" element={<RfqDetailPage />} />
        <Route path="/rfqs/:id" element={<RfqDetailPage />} />
        <Route
          path="/orders"
          element={
            <ModulePlaceholderPage
              title="Orders & Milestone Tracking"
              description="Digital purchase contracts, escrow milestones, and fulfillment progress."
            />
          }
        />
        <Route
          path="/shipments"
          element={
            <ModulePlaceholderPage
              title="Shipments & Logistics"
              description="Container vessel tracking, Bill of Lading, and customs clearances."
            />
          }
        />
        <Route
          path="/trade-finance"
          element={
            <ModulePlaceholderPage
              title="Trade Finance & Escrow"
              description="Simulated Letter of Credit (LC), milestone escrow payments, and currency hedging."
              simulated={true}
            />
          }
        />
        <Route
          path="/simulated/finance"
          element={
            <ModulePlaceholderPage
              title="Trade Finance & Escrow"
              description="Simulated Letter of Credit (LC), milestone escrow payments, and currency hedging."
              simulated={true}
            />
          }
        />
        <Route
          path="/documents"
          element={
            <ModulePlaceholderPage
              title="Trade Documents Vault"
              description="OCR processed proforma invoices, packing lists, and origin certificates."
            />
          }
        />
        <Route
          path="/analytics"
          element={
            <ModulePlaceholderPage
              title="Trade Analytics & Reporting"
              description="Spend analytics, volume breakdown, and supplier fulfillment metrics."
            />
          }
        />
        <Route
          path="/messages"
          element={
            <ModulePlaceholderPage
              title="Trade Messages & Counter-Offers"
              description="Direct supplier-buyer negotiation chat with AI suggested counter-offers."
            />
          }
        />
        <Route
          path="/negotiations"
          element={
            <ModulePlaceholderPage
              title="Trade Messages & Counter-Offers"
              description="Direct supplier-buyer negotiation chat with AI suggested counter-offers."
            />
          }
        />
        <Route
          path="/saved"
          element={
            <ModulePlaceholderPage
              title="Saved Items & Suppliers"
              description="Your bookmarked products, preferred suppliers, and saved search filters."
            />
          }
        />
        <Route
          path="/settings"
          element={
            <ModulePlaceholderPage
              title="Account & Platform Settings"
              description="Preferences, notifications, API keys, and workspace customization."
            />
          }
        />
        <Route
          path="/copilot"
          element={
            <ModulePlaceholderPage
              title="AI Trade Copilot"
              description="Interactive AI assistant for trade discovery, HS code lookup, and RFQ generation."
            />
          }
        />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/design-system" element={<DesignSystemPage />} />

        {/* RBAC Protected Admin Route */}
        <Route
          path="/admin"
          element={
            <RoleGuard allowedRoles={["admin"]}>
              <ModulePlaceholderPage
                title="Admin Platform Governance"
                description="Platform user directory, verification auditing, and system logs."
              />
            </RoleGuard>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
