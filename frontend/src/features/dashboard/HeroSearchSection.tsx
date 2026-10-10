import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles, ChevronDown } from "lucide-react";
import { TradeMapSvg } from "./TradeMapSvg";
import { HeroStatsPanel } from "./HeroStatsPanel";
import { HeroStats } from "../../lib/api/dashboard";

interface HeroSearchSectionProps {
  stats?: HeroStats;
  isLoading?: boolean;
}

export const HeroSearchSection: React.FC<HeroSearchSectionProps> = ({ stats, isLoading }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("all");
  const [selectedOrigin, setSelectedOrigin] = useState("all");
  const [selectedDestination, setSelectedDestination] = useState("all");
  const [selectedQty, setSelectedQty] = useState("all");
  const [selectedCert, setSelectedCert] = useState("all");

  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim() || "organic turmeric India Germany";
    // Navigate to ai-search / products search with params
    const params = new URLSearchParams();
    params.set("q", query);
    if (selectedProduct !== "all") params.set("category", selectedProduct);
    if (selectedOrigin !== "all") params.set("country", selectedOrigin);
    if (selectedCert !== "all") params.set("certifications", selectedCert);
    navigate(`/ai-search?${params.toString()}`);
  };

  return (
    <section className="relative bg-gradient-to-br from-[#0A1230] via-[#0D1B4D] to-[#09112B] text-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl overflow-hidden border border-slate-800">
      {/* Background World Map Graphic */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <TradeMapSvg />
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Headlines, AI Search Bar, Dropdowns */}
        <div className="lg:col-span-7 space-y-6">
          {/* Tag badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>AI Discovery & Autonomous B2B Trade Engine</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight sm:leading-none">
            Global Trade,{" "}
            <span className="text-[#38BDF8] drop-shadow-[0_0_20px_rgba(56,189,248,0.4)]">
              Smarter
            </span>{" "}
            with AI.
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
            Find verified suppliers, compare quotes, manage shipments and trade globally with confidence.
          </p>

          {/* Large AI Search Bar */}
          <form onSubmit={handleSearch} className="space-y-3 pt-1">
            <div className="relative flex items-center bg-white rounded-2xl shadow-2xl p-1.5 border border-slate-200/80 focus-within:ring-4 focus-within:ring-[#2563EB]/30 transition-all">
              <div className="pl-3.5 text-slate-400 pointer-events-none flex items-center">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="I need 20 tons of organic turmeric from India to Germany..."
                className="w-full px-3 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
              />
              <button
                type="submit"
                className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/30 transition-all select-none"
              >
                <Sparkles className="w-4 h-4 text-blue-200" />
                <span>Search with AI</span>
              </button>
            </div>

            {/* 5 Dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-xs">
              {/* 1. Products */}
              <div className="relative">
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full appearance-none bg-slate-900/80 text-slate-200 border border-slate-700/80 rounded-xl px-3 py-2 pr-7 text-xs font-medium focus:outline-none focus:border-blue-400"
                >
                  <option value="all">Products: All</option>
                  <option value="spices-herbs">Spices & Herbs</option>
                  <option value="agri-commodities">Agri Commodities</option>
                  <option value="textiles-apparel">Textiles & Yarn</option>
                  <option value="machinery-tools">Machinery Parts</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* 2. Supplier Country */}
              <div className="relative">
                <select
                  value={selectedOrigin}
                  onChange={(e) => setSelectedOrigin(e.target.value)}
                  className="w-full appearance-none bg-slate-900/80 text-slate-200 border border-slate-700/80 rounded-xl px-3 py-2 pr-7 text-xs font-medium focus:outline-none focus:border-blue-400"
                >
                  <option value="all">Origin: Any</option>
                  <option value="India">India (🇮🇳)</option>
                  <option value="Vietnam">Vietnam (🇻🇳)</option>
                  <option value="Germany">Germany (🇩🇪)</option>
                  <option value="UAE">UAE (🇦🇪)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* 3. Destination */}
              <div className="relative">
                <select
                  value={selectedDestination}
                  onChange={(e) => setSelectedDestination(e.target.value)}
                  className="w-full appearance-none bg-slate-900/80 text-slate-200 border border-slate-700/80 rounded-xl px-3 py-2 pr-7 text-xs font-medium focus:outline-none focus:border-blue-400"
                >
                  <option value="all">Destination: Any</option>
                  <option value="Germany">Germany (DE)</option>
                  <option value="USA">USA (US)</option>
                  <option value="UAE">UAE (AE)</option>
                  <option value="Netherlands">Netherlands (NL)</option>
                  <option value="Singapore">Singapore (SG)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* 4. Quantity */}
              <div className="relative">
                <select
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(e.target.value)}
                  className="w-full appearance-none bg-slate-900/80 text-slate-200 border border-slate-700/80 rounded-xl px-3 py-2 pr-7 text-xs font-medium focus:outline-none focus:border-blue-400"
                >
                  <option value="all">Quantity: Any</option>
                  <option value="1-5mt">1 - 5 MT</option>
                  <option value="5-20mt">5 - 20 MT</option>
                  <option value="20-50mt">20 - 50 MT</option>
                  <option value="50mt+">50+ MT (FCL)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* 5. Certifications */}
              <div className="relative">
                <select
                  value={selectedCert}
                  onChange={(e) => setSelectedCert(e.target.value)}
                  className="w-full appearance-none bg-slate-900/80 text-slate-200 border border-slate-700/80 rounded-xl px-3 py-2 pr-7 text-xs font-medium focus:outline-none focus:border-blue-400"
                >
                  <option value="all">Cert: Any</option>
                  <option value="Organic">Organic Certified</option>
                  <option value="ISO 22000">ISO 22000</option>
                  <option value="FSSAI">FSSAI Approved</option>
                  <option value="HACCP">HACCP Standard</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: High-level Stats Panel */}
        <div className="lg:col-span-5">
          <HeroStatsPanel stats={stats} isLoading={isLoading} />
        </div>
      </div>
    </section>
  );
};
