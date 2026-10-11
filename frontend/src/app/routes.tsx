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
  MessagesPage,
  OrdersPage,
  OrderDetailPage,
  TradeFinancePage,
  ShipmentsPage,
  ShipmentDetailPage,
  DocumentsPage,
  CopilotPage,
  AnalyticsPage,
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
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/shipments" element={<ShipmentsPage />} />
        <Route path="/shipments/:id" element={<ShipmentDetailPage />} />
        <Route path="/trade-finance" element={<TradeFinancePage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/negotiations" element={<MessagesPage />} />
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
        <Route path="/copilot" element={<CopilotPage />} />
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
