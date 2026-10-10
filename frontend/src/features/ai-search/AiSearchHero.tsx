import React, { useState, useEffect } from "react";
import { Search, Sparkles, History, ArrowRight, X } from "lucide-react";

interface AiSearchHeroProps {
  initialQuery?: string;
  isLoading: boolean;
  onSearch: (query: string) => void;
  onOpenHistory: () => void;
  historyCount?: number;
}

const EXAMPLE_QUERIES = [
  "I need 20 tons of organic turmeric from India delivered to Hamburg within 45 days",
  "10,000 meters of combed cotton yarn 30s count from India",
  "5 metric tons of premium saffron from Iran to Dubai",
  "500 kW bifacial tier-1 solar panels from China to Rotterdam",
];

export const AiSearchHero: React.FC<AiSearchHeroProps> = ({
  initialQuery = "",
  isLoading,
  onSearch,
  onOpenHistory,
  historyCount = 0,
}) => {
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSearch(query.trim());
  };

  const handleChipClick = (example: string) => {
    setQuery(example);
    onSearch(example);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#070e27] via-[#0d1d4d] to-[#0a1438] text-white p-6 sm:p-10 shadow-2xl border border-slate-800">
      {/* Decorative background glow */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto space-y-6">
        {/* Top Badges & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Natural-Language B2B Trade Engine</span>
          </div>

          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all shadow-sm"
          >
            <History className="w-3.5 h-3.5 text-blue-400" />
            <span>Search History</span>
            {historyCount > 0 && (
              <span className="bg-blue-600/40 text-blue-200 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {historyCount}
              </span>
            )}
          </button>
        </div>

        {/* Headlines */}
        <div className="text-center sm:text-left space-y-2">
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            Ask for anything in{" "}
            <span className="text-[#38BDF8] drop-shadow-[0_0_20px_rgba(56,189,248,0.4)]">
              Plain English
            </span>
            .
          </h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl">
            Our AI trade parser extracts quantity, specs, origin, destination, HS codes, and incoterms to match verified global suppliers.
          </p>
        </div>

        {/* Big Search Input Form */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-center rounded-2xl bg-slate-900/90 border-2 border-slate-700 focus-within:border-[#38BDF8] shadow-2xl transition-all duration-300 backdrop-blur-xl">
            <div className="pl-4 sm:pl-5 text-slate-400">
              <Search className="w-5 h-5 text-[#38BDF8]" />
            </div>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. I need 20 tons of organic turmeric from India delivered to Hamburg within 45 days..."
              className="w-full py-4 pl-3 pr-24 sm:pr-36 text-sm sm:text-base text-white placeholder-slate-400 bg-transparent focus:outline-none"
              disabled={isLoading}
            />

            {query && !isLoading && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="p-1.5 mr-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Clear query"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute right-2 sm:right-3 px-4 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Processing...</span>
                </>
              ) : (
                <>
                  <span>Search</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Example Query Chips */}
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            Try these example queries:
          </span>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => handleChipClick(example)}
                disabled={isLoading}
                className="text-left text-xs bg-slate-800/80 hover:bg-slate-700/80 hover:border-blue-400/60 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-300 hover:text-white transition-all duration-200"
              >
                &ldquo;{example}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
