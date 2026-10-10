import React from "react";
import { AlertCircle, SlidersHorizontal, ArrowRight } from "lucide-react";

interface FilterRelaxationSuggestionsProps {
  suggestions: string[];
  onApplySuggestion: (suggestion: string) => void;
}

export const FilterRelaxationSuggestions: React.FC<FilterRelaxationSuggestionsProps> = ({
  suggestions,
  onApplySuggestion,
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <h4 className="text-sm font-semibold text-amber-900">
          Limited Matches Found &mdash; AI Relaxation Suggestions:
        </h4>
      </div>

      <p className="text-xs text-amber-800">
        Broadening your trade criteria can unlock more verified suppliers and lower procurement lead times.
      </p>

      <div className="flex flex-wrap gap-2 pt-1">
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onApplySuggestion(suggestion)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 text-xs font-medium shadow-xs transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
            <span>{suggestion}</span>
            <ArrowRight className="w-3 h-3 text-amber-500" />
          </button>
        ))}
      </div>
    </div>
  );
};
