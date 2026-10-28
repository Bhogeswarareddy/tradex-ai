import React from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  className = "",
  id,
  ...props
}) => {
  const selectId = id || props.name;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={`w-full appearance-none rounded-lg border bg-white dark:bg-slate-800 dark:border-slate-700 px-3 py-2 pr-9 text-sm text-slate-900 dark:text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-400"
              : "border-slate-300 dark:border-slate-700 focus:border-[#2563EB] focus:ring-[#2563EB]"
          } ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
    </div>
  );
};
