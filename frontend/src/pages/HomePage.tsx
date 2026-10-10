import React from "react";
import { Link } from "react-router-dom";
import {
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
  Server,
  Database,
  Cpu,
} from "lucide-react";
import { useHealth } from "../hooks/useHealth";
import { LoadingSpinner, ErrorState, SimulatedBadge } from "../components";

export const HomePage: React.FC = () => {
  const { data: health, loading, error, refetch } = useHealth();

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-6 sm:p-10 shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-semibold mb-4 border border-indigo-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered B2B Trade & Discovery Platform
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Discover Verified Suppliers & Streamline Global B2B Commerce
          </h1>
          <p className="mt-4 text-sm sm:text-base text-indigo-100 leading-relaxed">
            Eliminate supplier fragmentation with natural-language AI discovery, automated
            RFQ quote comparisons, intelligent negotiation support, and document processing.
          </p>
        </div>
      </section>

      {/* Backend & AI System Health Status Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-indigo-600" />
          System Health & Environment Status
        </h2>

        {loading && <LoadingSpinner message="Checking backend and AI services..." />}

        {error && (
          <ErrorState
            title="Backend Service Connection"
            message={`Unable to reach API server: ${error}`}
            onRetry={refetch}
          />
        )}

        {health && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">FastAPI Core</p>
                <p className="text-lg font-bold text-emerald-900 mt-1 capitalize">{health.status}</p>
                <p className="text-xs text-emerald-600 mt-0.5">v{health.version} ({health.environment})</p>
              </div>
              <Server className="w-8 h-8 text-emerald-600" />
            </div>

            <div className="p-4 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-sky-800 uppercase tracking-wider">PostgreSQL + pgvector</p>
                <p className="text-lg font-bold text-sky-900 mt-1 capitalize">{health.database || "Ready"}</p>
                <p className="text-xs text-sky-600 mt-0.5">Vector search ready</p>
              </div>
              <Database className="w-8 h-8 text-sky-600" />
            </div>

            <div className="p-4 rounded-lg bg-violet-50 border border-violet-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-violet-800 uppercase tracking-wider">AI Intelligence Layer</p>
                <p className="text-lg font-bold text-violet-900 mt-1 capitalize">{health.ai_provider}</p>
                <p className="text-xs text-violet-600 mt-0.5">Claude 3.5 & Fallback Engine</p>
              </div>
              <Cpu className="w-8 h-8 text-violet-600" />
            </div>
          </div>
        )}
      </section>

      {/* Module Overview Grid */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Platform Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: "Marketplace & AI Search",
              desc: "Vector-powered natural language supplier and product discovery.",
              icon: Compass,
              href: "/",
              simulated: false,
            },
            {
              title: "Supplier Profiles",
              desc: "Verified supplier capabilities, compliance certifications, and auditing.",
              icon: Building2,
              href: "/suppliers",
              simulated: false,
            },
            {
              title: "Product Catalog",
              desc: "Multi-tier categories, specifications, and volume pricing tiers.",
              icon: Package,
              href: "/products",
              simulated: false,
            },
            {
              title: "RFQ & AI Quote Comparison",
              desc: "Automated RFQ distribution and multi-supplier bid matrix comparison.",
              icon: FileText,
              href: "/rfqs",
              simulated: false,
            },
            {
              title: "Negotiation Chat",
              desc: "Real-time communication with automated counter-offer guidance.",
              icon: MessageSquare,
              href: "/negotiations",
              simulated: false,
            },
            {
              title: "Orders & Shipment Tracking",
              desc: "Milestone contract generation and multi-modal shipment timeline.",
              icon: Truck,
              href: "/orders",
              simulated: false,
            },
            {
              title: "AI Trade Copilot",
              desc: "Retrieval-Augmented Generation (RAG) assistant for international trade.",
              icon: Sparkles,
              href: "/copilot",
              simulated: false,
            },
            {
              title: "Analytics & Performance",
              desc: "Spend analytics, supplier fulfillment reliability, and trade metrics.",
              icon: BarChart3,
              href: "/analytics",
              simulated: false,
            },
            {
              title: "Admin & Governance",
              desc: "Role-based access, audit logging, and platform administration.",
              icon: ShieldCheck,
              href: "/admin",
              simulated: false,
            },
            {
              title: "Payments & Escrow",
              desc: "Simulated milestone escrow releases and multi-currency transactions.",
              icon: CreditCard,
              href: "/simulated/finance",
              simulated: true,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    {card.simulated && <SimulatedBadge />}
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base">{card.title}</h3>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{card.desc}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-600">Explore Module &rarr;</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
