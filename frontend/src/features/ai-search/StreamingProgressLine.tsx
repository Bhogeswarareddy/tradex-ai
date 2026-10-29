import React, { useEffect, useState } from "react";
import { Sparkles, Brain, Search, CheckCircle2 } from "lucide-react";

export type SearchStage = "understanding" | "searching" | "ranking";

interface StreamingProgressLineProps {
  isLoading: boolean;
  stage?: SearchStage;
}

const STEPS = [
  { id: "understanding", label: "Understanding requirement...", icon: Brain },
  { id: "searching", label: "Searching verified suppliers & products...", icon: Search },
  { id: "ranking", label: "Ranking matches & evaluating logistics fit...", icon: Sparkles },
];

export const StreamingProgressLine: React.FC<StreamingProgressLineProps> = ({ isLoading, stage }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(20);

  useEffect(() => {
    if (!isLoading) {
      setCurrentStep(0);
      setProgress(20);
      return;
    }

    if (stage) {
      if (stage === "understanding") {
        setCurrentStep(0);
        setProgress(30);
      } else if (stage === "searching") {
        setCurrentStep(1);
        setProgress(65);
      } else if (stage === "ranking") {
        setCurrentStep(2);
        setProgress(92);
      }
      return;
    }

    // Dynamic progression while waiting for server response
    const t1 = setTimeout(() => {
      setCurrentStep(1);
      setProgress(60);
    }, 800);

    const t2 = setTimeout(() => {
      setCurrentStep(2);
      setProgress(90);
    }, 2000);

    const t3 = setTimeout(() => {
      setProgress(96);
    }, 5000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isLoading, stage]);

  if (!isLoading) return null;

  return (
    <div
      data-testid="streaming-progress-line"
      className="w-full max-w-4xl mx-auto my-6 p-4 rounded-2xl bg-slate-900/90 border border-blue-500/30 shadow-xl backdrop-blur-md text-white"
    >
      <div className="flex items-center justify-between mb-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2 text-blue-400 font-medium">
          <Sparkles className="w-4 h-4 animate-spin text-blue-400" />
          <span>{STEPS[currentStep].label}</span>
        </div>
        <span className="text-slate-400 font-mono text-xs">{progress}%</span>
      </div>

      {/* Progress Track */}
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-slate-800/80">
        {STEPS.map((step, idx) => {
          const isDone = currentStep > idx;
          const isCurrent = currentStep === idx;
          const Icon = step.icon;

          return (
            <div
              key={step.label}
              className={`flex items-center gap-1.5 text-xs transition-colors ${
                isDone
                  ? "text-emerald-400"
                  : isCurrent
                  ? "text-blue-300 font-medium"
                  : "text-slate-500"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isCurrent ? "animate-pulse" : ""}`} />
              )}
              <span className="truncate hidden sm:inline">{step.label.replace("...", "")}</span>
              <span className="truncate sm:hidden">Step {idx + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
