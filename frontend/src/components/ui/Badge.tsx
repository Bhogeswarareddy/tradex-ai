import React from "react";
import { CheckCircle2 } from "lucide-react";

export type BadgeVariant =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "verified"
  | "simulated"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "gray";

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  size = "sm",
  className = "",
}) => {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  if (variant === "verified") {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-full bg-emerald-50 text-[#16A34A] border border-emerald-200/80 ${sizeClasses} ${className}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
        {children || "Verified"}
      </span>
    );
  }

  if (variant === "simulated") {
    return (
      <span
        title="Simulated workflow for demonstration and sandboxed execution."
        className={`inline-flex items-center gap-1 font-semibold rounded-full bg-amber-50 text-[#F59E0B] border border-amber-300 ${sizeClasses} ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
        {children || "Simulated"}
      </span>
    );
  }

  const variants: Record<string, string> = {
    primary: "bg-blue-50 text-[#2563EB] border border-blue-200",
    blue: "bg-blue-50 text-[#2563EB] border border-blue-200",
    success: "bg-emerald-50 text-[#16A34A] border border-emerald-200",
    green: "bg-emerald-50 text-[#16A34A] border border-emerald-200",
    warning: "bg-amber-50 text-[#F59E0B] border border-amber-200",
    amber: "bg-amber-50 text-[#F59E0B] border border-amber-200",
    danger: "bg-rose-50 text-[#EF4444] border border-rose-200",
    red: "bg-rose-50 text-[#EF4444] border border-rose-200",
    neutral: "bg-slate-100 text-slate-700 border border-slate-200",
    gray: "bg-slate-100 text-slate-700 border border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${
        variants[variant] || variants.neutral
      } ${sizeClasses} ${className}`}
    >
      {children}
    </span>
  );
};
