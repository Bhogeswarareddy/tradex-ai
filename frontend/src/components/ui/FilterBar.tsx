import React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Chip } from "./Chip";

export interface FilterChipOption {
  id: string;
  label: string;
  active?: boolean;
}

export interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  chips?: FilterChipOption[];
  onChipToggle?: (id: string) => void;
  onClearFilters?: () => void;
  filterCount?: number;
  onFilterClick?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  chips = [],
  onChipToggle,
  onClearFilters,
  filterCount = 0,
  onFilterClick,
  actions,
  className = "",
}) => {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[240px]">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-9 py-2 text-sm bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter button */}
        {onFilterClick && (
          <button
            type="button"
            onClick={onFilterClick}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            <span>Filters</span>
            {filterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-xs font-semibold flex items-center justify-center">
                {filterCount}
              </span>
            )}
          </button>
        )}

        {/* Custom Actions */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Filter chips toolbar */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {chips.map((chip) => (
            <Chip
              key={chip.id}
              label={chip.label}
              selected={chip.active}
              onClick={() => onChipToggle && onChipToggle(chip.id)}
            />
          ))}

          {onClearFilters && chips.some((c) => c.active) && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs text-[#2563EB] hover:underline font-medium ml-1"
            >
              Reset all
            </button>
          )}
        </div>
      )}
    </div>
  );
};
