import React from "react";
import { useCurrency } from "../../features/settings/SettingsContext";

export interface PriceDisplayProps {
  amount: number | null | undefined;
  baseCurrency?: string;
  className?: string;
  subtextClassName?: string;
  showOriginalSubtitle?: boolean;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  amount,
  baseCurrency = "USD",
  className = "",
  subtextClassName = "text-[11px] text-slate-400 block font-normal",
  showOriginalSubtitle = false,
}) => {
  const { formatPrice } = useCurrency();
  const res = formatPrice(amount, baseCurrency);

  return (
    <span
      className={`inline-block ${className}`}
      title={res.approx ? `Original: ${res.originalFormatted}` : undefined}
    >
      <span>{res.formatted}</span>
      {res.approx && showOriginalSubtitle && (
        <span className={subtextClassName}>
          (Orig: {res.originalFormatted})
        </span>
      )}
    </span>
  );
};
