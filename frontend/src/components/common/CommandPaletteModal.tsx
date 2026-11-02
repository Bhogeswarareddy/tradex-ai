import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Package,
  Building2,
  FileText,
  Truck,
  Compass,
  Sparkles,
  Clock,
  ArrowRight,
  X,
  CornerDownLeft,
} from "lucide-react";
import { apiClient } from "../../lib/api";

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  type: "product" | "supplier" | "rfq" | "order" | "page";
  url: string;
  badge?: string;
  is_demo?: boolean;
}

const STATIC_PAGES: PaletteItem[] = [
  { id: "p-home", title: "Home Dashboard", subtitle: "Global trade routes, corridor metrics & insights", type: "page", url: "/" },
  { id: "p-ai-search", title: "AI Search", subtitle: "Natural language procurement & multi-criteria matching", type: "page", url: "/ai-search" },
  { id: "p-ai-mode", title: "AI Mode", subtitle: "Interactive product discovery & supplier recommendations", type: "page", url: "/ai-mode" },
  { id: "p-copilot", title: "Trade Copilot", subtitle: "Trade documentation, Incoterms & export intelligence", type: "page", url: "/copilot" },
  { id: "p-landed-cost", title: "Landed Cost Calculator", subtitle: "Line-by-line duty, freight, insurance & port fees", type: "page", url: "/landed-cost" },
  { id: "p-rfqs", title: "RFQs & Quotes", subtitle: "Create inquiries and compare competitive supplier bids", type: "page", url: "/rfqs" },
  { id: "p-orders", title: "Orders & Escrow", subtitle: "Procurement lifecycle, digital payments & milestones", type: "page", url: "/orders" },
  { id: "p-shipments", title: "Shipments & Tracking", subtitle: "Live container AIS tracking & port arrival dates", type: "page", url: "/shipments" },
  { id: "p-analytics", title: "Analytics & Intelligence", subtitle: "Buyer spend, supplier scorecards & commodity demand", type: "page", url: "/analytics" },
  { id: "p-settings", title: "Platform Settings", subtitle: "Preferences, currency conversion & active themes", type: "page", url: "/settings" },
];

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "product" | "supplier" | "rfq" | "order" | "page">("all");
  const [results, setResults] = useState<PaletteItem[]>([]);
  const [recentItems, setRecentItems] = useState<PaletteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load recent items
  useEffect(() => {
    try {
      const stored = localStorage.getItem("tradex_command_palette_recent");
      if (stored) {
        setRecentItems(JSON.parse(stored));
      }
    } catch {
      // Ignore
    }
  }, [isOpen]);

  // Focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Fetch search results
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    let active = true;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.get<any>(`/ai/palette/search?q=${encodeURIComponent(query.trim())}`);
        if (!active) return;

        const data = res?.data || res || {};
        const combined: PaletteItem[] = [
          ...(data.products || []),
          ...(data.suppliers || []),
          ...(data.rfqs || []),
          ...(data.orders || []),
        ];

        // Also search static pages
        const qLower = query.toLowerCase();
        const matchedPages = STATIC_PAGES.filter(
          (p) => p.title.toLowerCase().includes(qLower) || p.subtitle.toLowerCase().includes(qLower)
        );

        setResults([...matchedPages, ...combined]);
        setSelectedIndex(0);
      } catch (err) {
        console.error("Command palette search error:", err);
      } finally {
        if (active) setLoading(false);
      }
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Filter items by tab
  const displayedItems = (query.trim() ? results : (recentItems.length ? recentItems : STATIC_PAGES.slice(0, 6)))
    .filter((item) => activeTab === "all" || item.type === activeTab);

  const handleSelect = (item: PaletteItem) => {
    // Add to recent
    try {
      const updated = [item, ...recentItems.filter((r) => r.id !== item.id)].slice(0, 8);
      setRecentItems(updated);
      localStorage.setItem("tradex_command_palette_recent", JSON.stringify(updated));
    } catch {
      // Ignore
    }

    onClose();
    navigate(item.url);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (displayedItems.length > 0 ? (prev + 1) % displayedItems.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (displayedItems.length > 0 ? (prev - 1 + displayedItems.length) % displayedItems.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (displayedItems[selectedIndex]) {
        handleSelect(displayedItems[selectedIndex]);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "product":
        return <Package className="w-4 h-4 text-emerald-500" />;
      case "supplier":
        return <Building2 className="w-4 h-4 text-blue-500" />;
      case "rfq":
        return <FileText className="w-4 h-4 text-amber-500" />;
      case "order":
        return <Truck className="w-4 h-4 text-purple-500" />;
      case "page":
        return <Compass className="w-4 h-4 text-indigo-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 sm:px-6">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal Card */}
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all z-10 flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 text-base focus:outline-none"
            placeholder="Type a product, supplier, RFQ, order, or jump to page... (e.g. 'rice', 'ORD', 'laptop')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 rounded border border-slate-300 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40 text-xs overflow-x-auto">
          {[
            { id: "all", label: "All" },
            { id: "product", label: "Products" },
            { id: "supplier", label: "Suppliers" },
            { id: "rfq", label: "RFQs" },
            { id: "order", label: "Orders" },
            { id: "page", label: "Pages" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeTab === tab.id
                  ? "bg-emerald-500 text-white font-medium"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {loading && <span className="ml-auto text-xs text-slate-400 animate-pulse">Searching catalog...</span>}
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/40">
          {!query.trim() && recentItems.length > 0 && (
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Recent Searches & Views
            </div>
          )}

          {displayedItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No results found for "{query}"</p>
              <p className="text-xs text-slate-400 mt-1">Try searching for products (e.g. 'turmeric'), suppliers, or order numbers.</p>
            </div>
          ) : (
            displayedItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shrink-0">
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{item.title}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                            {item.badge}
                          </span>
                        )}
                        {item.is_demo && (
                          <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-semibold rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            Demo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSelected && (
                      <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                        <CornerDownLeft className="w-3 h-3" /> Select
                      </span>
                    )}
                    <ArrowRight className="w-4 h-4 text-slate-400 opacity-60" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono font-semibold">↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono font-semibold">↵</kbd> Open</span>
            <span><kbd className="font-mono font-semibold">ESC</kbd> Close</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span>TradeX Global Catalog</span>
            <span>• 2,100+ items</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CommandPaletteModal;
