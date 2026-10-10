import React from "react";

export interface SkeletonProps {
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = "text",
  width,
  height,
  className = "",
}) => {
  const baseClasses = "animate-pulse bg-slate-200";

  const variantClasses = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  const style: React.CSSProperties = {
    width: width !== undefined ? (typeof width === "number" ? `${width}px` : width) : undefined,
    height: height !== undefined ? (typeof height === "number" ? `${height}px` : height) : undefined,
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};
