import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export interface KpiDeltaObject {
  value: string;
  isPositive?: boolean;
  period?: string;
}

export interface KpiCardProps {
  icon?: React.ReactNode;
  label?: string;
  title?: string;
  value: string | number;
  delta?: string | KpiDeltaObject;
  isPositive?: boolean;
  description?: string;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  icon,
  label,
  title,
  value,
  delta,
  isPositive = true,
  description,
  className = "",
}) => {
  const cardTitle = title || label || "Metric";

  const renderDelta = () => {
    if (!delta) return null;

    if (typeof delta === "string") {
      return (
        <div className="flex items-center gap-1.5 mt-2 text-xs">
          <span
            className={`inline-flex items-center font-semibold ${
              isPositive ? "text-[#16A34A]" : "text-[#EF4444]"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
            )}
            {delta}
          </span>
          {description && <span className="text-slate-400">{description}</span>}
        </div>
      );
    }

    const pos = delta.isPositive !== false;
    return (
      <div className="flex items-center gap-1.5 mt-2 text-xs">
        <span
          className={`inline-flex items-center font-semibold ${
            pos ? "text-[#16A34A]" : "text-[#EF4444]"
          }`}
        >
          {pos ? (
            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
          )}
          {delta.value}
        </span>
        {(delta.period || description) && (
          <span className="text-slate-400">{delta.period || description}</span>
        )}
      </div>
    );
  };

  return (
    <div
      className={`bg-white rounded-[12px] border border-slate-200/80 p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] flex flex-col justify-between ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {cardTitle}
        </span>
        {icon && (
          <div className="p-2.5 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
        {renderDelta()}
      </div>
    </div>
  );
};
