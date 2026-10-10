import React from "react";

interface SimulatedBadgeProps {
  label?: string;
  tooltip?: string;
}

export const SimulatedBadge: React.FC<SimulatedBadgeProps> = ({
  label = "Simulated",
  tooltip = "This workflow is simulated for demonstration and sandboxed execution.",
}) => {
  return (
    <span
      title={tooltip}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 tracking-wide select-none cursor-help"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
      {label}
    </span>
  );
};
