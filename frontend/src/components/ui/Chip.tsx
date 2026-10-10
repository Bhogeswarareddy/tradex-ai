import React from "react";
import { X } from "lucide-react";

export interface ChipProps {
  label: string;
  icon?: React.ReactNode;
  selected?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  icon,
  selected = false,
  onRemove,
  onClick,
  className = "",
}) => {
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors select-none ${
        onClick ? "cursor-pointer" : ""
      } ${
        selected
          ? "bg-[#2563EB] text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      } ${className}`}
    >
      {icon}
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:text-red-500 rounded p-0.5 focus:outline-none"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};
