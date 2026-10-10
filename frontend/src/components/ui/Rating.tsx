import React from "react";
import { Star } from "lucide-react";

export interface RatingProps {
  score: number;
  maxScore?: number;
  showNumber?: boolean;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}

export const Rating: React.FC<RatingProps> = ({
  score,
  maxScore = 5,
  showNumber = true,
  count,
  size = "sm",
  className = "",
}) => {
  const starSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center text-amber-400">
        {Array.from({ length: maxScore }).map((_, idx) => {
          const filled = idx + 1 <= Math.round(score);
          return (
            <Star
              key={idx}
              className={`${starSize} ${filled ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
            />
          );
        })}
      </div>
      {showNumber && (
        <span className="text-xs font-bold text-slate-700">
          {score.toFixed(1)}
        </span>
      )}
      {count !== undefined && (
        <span className="text-xs text-slate-400">({count})</span>
      )}
    </div>
  );
};
