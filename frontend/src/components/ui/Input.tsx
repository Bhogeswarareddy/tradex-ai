import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  helperText?: string;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helper,
  helperText,
  icon,
  leftIcon,
  rightIcon,
  className = "",
  id,
  ...props
}) => {
  const inputId = id || props.name;
  const startIcon = icon || leftIcon;
  const guidance = helper || helperText;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {startIcon && (
          <div className="absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
            {startIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`w-full rounded-lg border bg-white dark:bg-slate-800 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 ${
            startIcon ? "pl-9" : ""
          } ${rightIcon ? "pr-9" : ""} ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-400"
              : "border-slate-300 dark:border-slate-700 focus:border-[#2563EB] focus:ring-[#2563EB]"
          } ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 text-slate-400 dark:text-slate-500 flex items-center">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
      {!error && guidance && <p className="text-xs text-slate-500 dark:text-slate-400">{guidance}</p>}
    </div>
  );
};
