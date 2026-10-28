import React from "react";

export interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  description,
  action,
  footer,
  children,
  className = "",
  bodyClassName = "",
}) => {
  const desc = description || subtitle;

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-[12px] border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] overflow-hidden transition-colors ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            {typeof title === "string" ? (
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            ) : (
              title
            )}
            {desc && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children && <div className={`p-5 ${bodyClassName}`}>{children}</div>}
      {footer && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          {footer}
        </div>
      )}
    </div>
  );
};
