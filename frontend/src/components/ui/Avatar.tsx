import React from "react";

export interface AvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  status?: "online" | "offline";
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = "md",
  status,
  className = "",
}) => {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };

  const statusDotSizes = {
    sm: "w-2 h-2 ring-1",
    md: "w-2.5 h-2.5 ring-2",
    lg: "w-3 h-3 ring-2",
  };

  const getInitials = (n: string) => {
    return n
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="relative inline-block shrink-0">
      {src ? (
        <img
          src={src}
          alt={name}
          className={`rounded-full object-cover border border-slate-200 ${sizeClasses[size]} ${className}`}
        />
      ) : (
        <div
          className={`rounded-full bg-blue-100 text-[#2563EB] font-bold flex items-center justify-center border border-blue-200 select-none ${sizeClasses[size]} ${className}`}
        >
          {getInitials(name || "User")}
        </div>
      )}

      {status && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-white ${statusDotSizes[size]} ${
            status === "online" ? "bg-emerald-500" : "bg-slate-400"
          }`}
          aria-label={status}
        />
      )}
    </div>
  );
};
