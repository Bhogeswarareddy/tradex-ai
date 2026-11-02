import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../features/auth/AuthContext";
import {
  Compass,
  Search,
  Sparkles,
  ShieldCheck,
  Package,
  FileText,
  DollarSign,
  Activity,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
} from "lucide-react";

interface TourStep {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  highlights: string[];
  roleBadge: string;
}

const BUYER_STEPS: TourStep[] = [
  {
    title: "Welcome to TradeX AI Marketplace",
    subtitle: "Autonomous B2B Sourcing Platform",
    description:
      "TradeX connects global importers with audited manufacturers, powered by real-time LLM inference, verified landed cost calculation, and cross-border regulatory compliance.",
    icon: <Compass className="w-8 h-8 text-blue-500" />,
    roleBadge: "Buyer Portal",
    highlights: [
      "Real-time supplier verification & ISO accreditation",
      "Instant landed cost estimation with duties & freight",
      "Live maritime AIS cargo tracking",
    ],
  },
  {
    title: "AI Search & Smart Sourcing Engine",
    subtitle: "Natural Language Discovery",
    description:
      "Search the global trade catalog using plain English. Our AI engine extracts technical specifications, quantity thresholds, destination ports, and Incoterms automatically.",
    icon: <Search className="w-8 h-8 text-sky-500" />,
    roleBadge: "AI Search",
    highlights: [
      "Natural language extraction (e.g. '20 tons organic turmeric to Hamburg')",
      "Real catalog matching without synthetic mock suppliers",
      "Dynamic stock availability and MOQ validation",
    ],
  },
  {
    title: "AI Trade Copilot & Conversational Mode",
    subtitle: "RAG Trade Intelligence",
    description:
      "Ask complex trade finance, tariff, customs, or Incoterms questions. AI Copilot cross-references official international trade standards and provides verified citations.",
    icon: <Sparkles className="w-8 h-8 text-indigo-500" />,
    roleBadge: "Trade Copilot",
    highlights: [
      "RAG document citations for Incoterms 2020 & customs",
      "Automated RFQ draft generation from chat",
      "Direct negotiation assistance and price benchmarking",
    ],
  },
  {
    title: "Escrow, Shipments & Digital Documents",
    subtitle: "End-to-End Trade Execution",
    description:
      "Execute multi-milestone escrow contracts, track sea & air shipments with milestone checkpoints, and generate compliant commercial invoices and bills of lading.",
    icon: <ShieldCheck className="w-8 h-8 text-emerald-500" />,
    roleBadge: "Trade Finance",
    highlights: [
      "Smart escrow milestone releases upon verified delivery",
      "Live GPS & port terminal events timeline",
      "Automated bill of lading & certificate generation",
    ],
  },
];

const SUPPLIER_STEPS: TourStep[] = [
  {
    title: "Supplier Workspace & Global Storefront",
    subtitle: "Enterprise Export Operations",
    description:
      "Welcome to your global export control center. Showcase your manufacturing capacity, certifications, and inventory to pre-audited international importers.",
    icon: <Package className="w-8 h-8 text-blue-500" />,
    roleBadge: "Supplier Center",
    highlights: [
      "Tenant-isolated catalog & product management",
      "Verified factory accreditations & lab reports",
      "Global buyer discovery & direct inquiries",
    ],
  },
  {
    title: "AI Listing Generator & Spec Optimization",
    subtitle: "One-Click Catalog Publishing",
    description:
      "Provide a few words about your product and let TradeX AI draft production-ready descriptions, technical specifications, HS codes, and SEO trade keywords instantly.",
    icon: <Sparkles className="w-8 h-8 text-purple-500" />,
    roleBadge: "Catalog AI",
    highlights: [
      "Harmonized System (HS) code classification",
      "Multi-currency export tier pricing & MOQ tables",
      "Instant compliance and labeling check",
    ],
  },
  {
    title: "RFQ Matchmaking & Inquiry Assistant",
    subtitle: "Accelerated Deal Flow",
    description:
      "Receive qualified buyer RFQs matching your exact commodity and capacity. Use AI Deal Assist to generate formal quotations and counter-proposals in seconds.",
    icon: <FileText className="w-8 h-8 text-amber-500" />,
    roleBadge: "Deal Assist",
    highlights: [
      "Instant buyer requirement matching & alerts",
      "Automated quotation generator with margin controls",
      "Multi-channel negotiation thread and counter-offers",
    ],
  },
  {
    title: "Milestone Payouts & Escrow Settlement",
    subtitle: "Zero Payment Default Risk",
    description:
      "Trade with total certainty. Buyer funds are locked in escrow prior to dispatch and released automatically as your shipments hit verified shipping milestones.",
    icon: <DollarSign className="w-8 h-8 text-emerald-500" />,
    roleBadge: "Settlements",
    highlights: [
      "Guaranteed irrevocable letter of credit / escrow backing",
      "Automated release upon BL handover & port arrival",
      "Multi-currency settlement via SWIFT / Local Rail",
    ],
  },
];

const ADMIN_STEPS: TourStep[] = [
  {
    title: "Platform Operations & Intelligence",
    subtitle: "Antigravity Governance Suite",
    description:
      "Full visibility into marketplace telemetry, real-time AI inference health, latency diagnostics, and model token consumption across all platform nodes.",
    icon: <Activity className="w-8 h-8 text-blue-500" />,
    roleBadge: "Admin Console",
    highlights: [
      "Live Groq LLM latency & error budget monitoring",
      "Autonomous supplier verification audits",
      "Enterprise audit logging and session security",
    ],
  },
  {
    title: "Catalog Review & Supplier Audit Queue",
    subtitle: "Marketplace Integrity",
    description:
      "Audit newly submitted exporter listings, inspect laboratory certificates and business licenses, and maintain zero-tolerance quality standards for the platform.",
    icon: <ShieldCheck className="w-8 h-8 text-emerald-500" />,
    roleBadge: "Verification",
    highlights: [
      "Automated sanctions & trade restriction screening",
      "Document authenticity checks (ISO, HACCP, Organic)",
      "Instant approval or rejection with reviewer notes",
    ],
  },
  {
    title: "Trade Finance & Escrow Governance",
    subtitle: "Risk Management",
    description:
      "Oversee multi-million dollar trade flows, manage disputed escrow releases, inspect shipment telemetry, and enforce dispute arbitration rules.",
    icon: <Compass className="w-8 h-8 text-indigo-500" />,
    roleBadge: "Governance",
    highlights: [
      "Escrow fund lock & disbursement override controls",
      "Real-time shipment GPS anomaly tracking",
      "System-wide trade analytics & liquidity reserves",
    ],
  },
];

export const RoleGuidedTour: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const role = user?.role || "buyer";
  const storageKey = `tradex_tour_completed_${role}`;

  const steps =
    role === "supplier" ? SUPPLIER_STEPS : role === "admin" ? ADMIN_STEPS : BUYER_STEPS;

  // Check if tour should run on login or when manually triggered
  useEffect(() => {
    if (!user) return;
    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      // Small timeout so initial page render finishes cleanly
      const timer = setTimeout(() => {
        setIsOpen(true);
        setCurrentStepIndex(0);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [user, storageKey]);

  // Listen to manual replay custom event
  useEffect(() => {
    const handleReplayEvent = () => {
      setCurrentStepIndex(0);
      setIsOpen(true);
    };
    window.addEventListener("tradex:replay-tour", handleReplayEvent);
    return () => window.removeEventListener("tradex:replay-tour", handleReplayEvent);
  }, []);

  const handleClose = useCallback(() => {
    localStorage.setItem(storageKey, "true");
    setIsOpen(false);
  }, [storageKey]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStepIndex, steps.length, handleClose]);

  if (!isOpen) return null;

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 flex flex-col justify-between space-y-6">
        {/* Top Bar with Badge, Step Dots & Close Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              {currentStep.roleBadge}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            aria-label="Skip guided tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
              {currentStep.icon}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                {currentStep.subtitle}
              </p>
              <h2 id="tour-dialog-title" className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {currentStep.title}
              </h2>
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {currentStep.description}
          </p>

          {/* Highlights checklist */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Key Capabilities
            </p>
            {currentStep.highlights.map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{h}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none rounded-lg p-1"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              <span>{isLastStep ? "Get Started" : "Next"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
