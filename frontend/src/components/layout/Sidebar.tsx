import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Sparkles,
  Package,
  Building2,
  FileText,
  ShoppingCart,
  Truck,
  CreditCard,
  FolderOpen,
  BarChart3,
  MessageSquare,
  Bookmark,
  Settings,
  Bot,
  Hexagon,
} from "lucide-react";

export interface NavItem {
  id: string;
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeColor?: string;
  simulated?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "home", name: "Home", href: "/", icon: LayoutDashboard },
  { id: "search", name: "AI Search", href: "/search", icon: Sparkles },
  { id: "products", name: "Products", href: "/products", icon: Package },
  { id: "suppliers", name: "Suppliers", href: "/suppliers", icon: Building2 },
  { id: "rfq", name: "RFQ Marketplace", href: "/rfq", icon: FileText },
  { id: "orders", name: "Orders", href: "/orders", icon: ShoppingCart },
  { id: "shipments", name: "Shipments", href: "/shipments", icon: Truck },
  { id: "finance", name: "Trade Finance", href: "/trade-finance", icon: CreditCard, simulated: true },
  { id: "documents", name: "Documents", href: "/documents", icon: FolderOpen },
  { id: "analytics", name: "Analytics", href: "/analytics", icon: BarChart3 },
  { id: "messages", name: "Messages", href: "/messages", icon: MessageSquare, badge: 3, badgeColor: "bg-red-500" },
  { id: "saved", name: "Saved", href: "/saved", icon: Bookmark },
  { id: "settings", name: "Settings", href: "/settings", icon: Settings },
];

export interface SidebarProps {
  onNavClick?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavClick, className = "" }) => {
  const location = useLocation();

  return (
    <aside
      className={`w-60 min-h-screen bg-gradient-to-b from-[#0A1230] to-[#0F1B4A] text-white flex flex-col justify-between shrink-0 select-none shadow-xl border-r border-slate-800/60 ${className}`}
    >
      {/* Top Section */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Hexagon Brand Logo Header */}
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <div className="relative flex items-center justify-center text-[#2563EB]">
            <Hexagon className="w-9 h-9 fill-[#2563EB] text-blue-400/30" />
            <span className="absolute inset-0 flex items-center justify-center font-black text-white text-base">
              X
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-white">TradeX</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wider">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">B2B Trade Discovery</p>
          </div>
        </div>

        {/* 13 Ordered Navigation Links */}
        <nav className="p-3 space-y-1 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-white/10">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.href ||
              (item.href !== "/" && location.pathname.startsWith(item.href));

            return (
              <Link
                key={item.id}
                to={item.href}
                onClick={onNavClick}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group ${
                  isActive
                    ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20 font-semibold"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {item.simulated && (
                    <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Sim
                    </span>
                  )}
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${
                        item.badgeColor || "bg-[#2563EB]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: AI Trade Copilot Card */}
      <div className="p-3 border-t border-white/10">
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-950/60 to-slate-900/80 border border-blue-500/30 shadow-lg">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <Bot className="w-4 h-4 text-blue-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-tight">AI Trade Copilot</p>
              <p className="text-[10px] text-blue-200/70">Find suppliers & draft RFQs</p>
            </div>
          </div>
          <Link
            to="/copilot"
            onClick={onNavClick}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            <span>Chat with AI</span>
          </Link>
        </div>
      </div>
    </aside>
  );
};
