import React from "react";
import { Check } from "lucide-react";

export interface StepItem {
  id: string;
  label: string;
  description?: string;
}

export interface ProgressStepperProps {
  steps: StepItem[];
  currentStep: number;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({
  steps,
  currentStep,
  orientation = "horizontal",
  className = "",
}) => {
  if (orientation === "vertical") {
    return (
      <div className={`space-y-4 ${className}`}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={step.id} className="flex items-start">
              <div className="flex flex-col items-center mr-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs transition-colors ${
                    isCompleted
                      ? "bg-[#2563EB] text-white"
                      : isCurrent
                      ? "border-2 border-[#2563EB] text-[#2563EB] bg-blue-50"
                      : "border-2 border-slate-300 text-slate-400 bg-white"
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-0.5 h-10 my-1 ${
                      isCompleted ? "bg-[#2563EB]" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
              <div className="pt-1">
                <p
                  className={`text-sm font-semibold ${
                    isCurrent
                      ? "text-[#2563EB]"
                      : isCompleted
                      ? "text-slate-900"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal orientation
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between relative">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-medium text-xs transition-all ${
                    isCompleted
                      ? "bg-[#2563EB] text-white shadow"
                      : isCurrent
                      ? "border-2 border-[#2563EB] text-[#2563EB] bg-blue-50 ring-4 ring-blue-100"
                      : "border-2 border-slate-300 text-slate-400 bg-white"
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : index + 1}
                </div>
                <div className="text-center mt-2">
                  <p
                    className={`text-xs font-semibold ${
                      isCurrent
                        ? "text-[#2563EB]"
                        : isCompleted
                        ? "text-slate-900"
                        : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-[10px] text-slate-500 hidden sm:block mt-0.5">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 -mt-6 transition-colors ${
                    index < currentStep ? "bg-[#2563EB]" : "bg-slate-200"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
