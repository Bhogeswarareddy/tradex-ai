import React, { Suspense, lazy } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import { AppLayout } from "../components/layout";
import { RoleGuard } from "../features/auth";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages for bundle code-splitting and performance
const HomePage = lazy(() => import("../pages/HomePage").then(m => ({ default: m.HomePage })));
const LoginPage = lazy(() => import("../pages/LoginPage").then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("../pages/RegisterPage").then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import("../pages/ForgotPasswordPage").then(m => ({ default: m.ForgotPasswordPage })));
const ProfilePage = lazy(() => import("../pages/ProfilePage").then(m => ({ default: m.ProfilePage })));
const DesignSystemPage = lazy(() => import("../pages/DesignSystemPage").then(m => ({ default: m.DesignSystemPage })));
const ProductsPage = lazy(() => import("../pages/ProductsPage").then(m => ({ default: m.ProductsPage })));
const ProductDetailPage = lazy(() => import("../pages/ProductDetailPage").then(m => ({ default: m.ProductDetailPage })));
const SuppliersPage = lazy(() => import("../pages/SuppliersPage").then(m => ({ default: m.SuppliersPage })));
const SupplierDetailPage = lazy(() => import("../pages/SupplierDetailPage").then(m => ({ default: m.SupplierDetailPage })));
const SupplierPortalPage = lazy(() => import("../pages/SupplierPortalPage").then(m => ({ default: m.SupplierPortalPage })));
const AiSearchPage = lazy(() => import("../pages/AiSearchPage").then(m => ({ default: m.AiSearchPage })));
const RfqsPage = lazy(() => import("../pages/RfqsPage").then(m => ({ default: m.RfqsPage })));
const RfqDetailPage = lazy(() => import("../pages/RfqDetailPage").then(m => ({ default: m.RfqDetailPage })));
const MessagesPage = lazy(() => import("../pages/MessagesPage").then(m => ({ default: m.MessagesPage })));
const OrdersPage = lazy(() => import("../pages/OrdersPage").then(m => ({ default: m.OrdersPage })));
const OrderDetailPage = lazy(() => import("../pages/OrderDetailPage").then(m => ({ default: m.OrderDetailPage })));
const TradeFinancePage = lazy(() => import("../pages/TradeFinancePage").then(m => ({ default: m.TradeFinancePage })));
const ShipmentsPage = lazy(() => import("../pages/ShipmentsPage").then(m => ({ default: m.ShipmentsPage })));
const ShipmentDetailPage = lazy(() => import("../pages/ShipmentDetailPage").then(m => ({ default: m.ShipmentDetailPage })));
const DocumentsPage = lazy(() => import("../pages/DocumentsPage").then(m => ({ default: m.DocumentsPage })));
const CopilotPage = lazy(() => import("../pages/CopilotPage").then(m => ({ default: m.CopilotPage })));
const AnalyticsPage = lazy(() => import("../pages/AnalyticsPage").then(m => ({ default: m.AnalyticsPage })));
const AdminPage = lazy(() => import("../pages/AdminPage").then(m => ({ default: m.AdminPage })));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage").then(m => ({ default: m.NotFoundPage })));
const ModulePlaceholderPage = lazy(() => import("../pages/ModulePlaceholderPage").then(m => ({ default: m.ModulePlaceholderPage })));

const RouteLoadingFallback: React.FC = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center" role="status" aria-label="Loading page">
    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Loading Trade Workspace...</span>
  </div>
);

const LayoutWrapper: React.FC = () => {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
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
                <AdminPage />
              </RoleGuard>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
};
