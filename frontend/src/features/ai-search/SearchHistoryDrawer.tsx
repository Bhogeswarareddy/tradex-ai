import React from "react";
import { X, History, Search, ArrowRight, Clock, CheckCircle2 } from "lucide-react";
import { AiSearchHistoryItem } from "../../lib/api/aiSearch";

interface SearchHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  historyItems: AiSearchHistoryItem[];
  onSelectQuery: (query: string) => void;
  isLoading: boolean;
}

export const SearchHistoryDrawer: React.FC<SearchHistoryDrawerProps> = ({
  isOpen,
  onClose,
  historyItems,
  onSelectQuery,
  isLoading,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2 text-slate-800">
              <History className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold">Search History</h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                {historyItems.length}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Loading search history...
              </div>
            ) : historyItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Search className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm">No recent AI searches found.</p>
                <p className="text-xs text-slate-500">
                  Searches you perform will be saved here for quick re-use.
                </p>
              </div>
            ) : (
              historyItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectQuery(item.query);
                    onClose();
                  }}
                  className="group p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-blue-600 line-clamp-2">
                      &ldquo;{item.query}&rdquo;
                    </p>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5" />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {new Date(item.created_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      {item.results_count} results
                      {item.execution_time_ms ? ` (${Math.round(item.execution_time_ms)}ms)` : ""}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 text-center text-xs text-slate-400">
            Last 20 searches stored in your trade profile
          </div>
        </div>
      </div>
    </div>
  );
};
