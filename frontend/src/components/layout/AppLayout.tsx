import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Drawer } from "../ui/Drawer";
import { useAuth } from "../../features/auth/AuthContext";
import { useLocation } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { CopilotDrawer } from "../../features/copilot";

export interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const isSimulatedRoute =
    location.pathname.startsWith("/simulated") ||
    location.pathname.startsWith("/trade-finance");

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-row">
      {/* Desktop Sidebar (hidden below 1024px) */}
      <div className="hidden lg:block shrink-0">
        <Sidebar className="sticky top-0 h-screen" />
      </div>

      {/* Mobile / Tablet Drawer Sidebar (screens < 1024px) */}
      <Drawer
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        position="left"
        size="sm"
        className="p-0 bg-[#0A1230] text-white border-r border-slate-800"
      >
        <Sidebar
          onNavClick={() => setMobileSidebarOpen(false)}
          className="w-full min-h-full border-none shadow-none"
        />
      </Drawer>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          onToggleSidebar={() => setMobileSidebarOpen(true)}
          currentUser={
            user
              ? {
                  id: user.id,
                  email: user.email,
                  fullName: user.full_name,
                  role: user.role,
                  companyName: user.company_name,
                }
              : null
          }
          onLogout={logout}
        />

        {/* Sandbox / Simulated Notice if on simulated routes */}
        {isSimulatedRoute && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-center gap-2 text-xs font-semibold text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              [Simulated Environment] All trade finance and escrow transactions in this section are sandbox-simulated.
            </span>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Global AI Trade Copilot Floating Drawer */}
        <CopilotDrawer />
      </div>
    </div>
  );
};
