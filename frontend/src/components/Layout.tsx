import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  Compass,
  Building2,
  Package,
  FileText,
  MessageSquare,
  Truck,
  Sparkles,
  BarChart3,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { SimulatedBadge } from "./SimulatedBadge";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  simulated?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Marketplace", href: "/", icon: Compass },
  { name: "Suppliers", href: "/suppliers", icon: Building2 },
  { name: "Products", href: "/products", icon: Package },
  { name: "RFQs & Quotes", href: "/rfqs", icon: FileText },
  { name: "Negotiation", href: "/negotiations", icon: MessageSquare },
  { name: "Orders & Tracking", href: "/orders", icon: Truck },
  { name: "Trade Copilot", href: "/copilot", icon: Sparkles },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Admin", href: "/admin", icon: ShieldCheck },
  { name: "Escrow & Finance", href: "/simulated/finance", icon: CreditCard, simulated: true },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
            T
          </div>
          <span className="font-bold text-slate-900 tracking-tight">TradeX AI</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-md focus:outline-none"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Desktop Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-0 md:block hidden"
        }`}
      >
        <div className="p-5 border-b border-slate-100 hidden md:flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
            T
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-base leading-none">TradeX AI</h1>
            <p className="text-xs text-slate-400 mt-1">B2B Trade & Discovery</p>
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`h-4 w-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                  <span>{item.name}</span>
                </div>
                {item.simulated && <SimulatedBadge label="Sim" />}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
};
