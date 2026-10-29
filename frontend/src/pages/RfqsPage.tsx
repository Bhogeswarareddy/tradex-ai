import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { rfqsApi, RFQListItem } from "../lib/api/rfqs";
import { CreateRfqWizard } from "../features/rfq/CreateRfqWizard";
import { Button } from "../components/ui/Button";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../features/auth";

const STATUS_TABS = [
  { id: "all", label: "All RFQs" },
  { id: "active", label: "Active" },
  { id: "evaluating", label: "Evaluating" },
  { id: "draft", label: "Drafts" },
  { id: "awarded", label: "Awarded" },
  { id: "closed", label: "Closed" },
];

export const RfqsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSupplier = user?.role === "supplier";

  const [rfqs, setRfqs] = useState<RFQListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardInitialPrompt, setWizardInitialPrompt] = useState("");
  const [wizardInitialData, setWizardInitialData] = useState<Record<string, any> | undefined>(undefined);

  // Check if query params contain draft intent or prefilled requirements
  useEffect(() => {
    const title = searchParams.get("title");
    const product = searchParams.get("product");
    const q = searchParams.get("q");
    if (title || product || q) {
      setWizardInitialPrompt(title || product || q || "");
      
      const parsedData: Record<string, any> = {};
      if (title) parsedData.title = title;
      if (product) parsedData.product = product;
      if (searchParams.get("quantity")) parsedData.quantity = Number(searchParams.get("quantity"));
      if (searchParams.get("unit")) parsedData.unit = searchParams.get("unit");
      if (searchParams.get("origin_country")) parsedData.origin_country = searchParams.get("origin_country");
      if (searchParams.get("destination_country")) parsedData.destination_country = searchParams.get("destination_country");
      if (searchParams.get("destination_port")) parsedData.destination_port = searchParams.get("destination_port");
      if (searchParams.get("lead_time_days")) parsedData.lead_time_days = Number(searchParams.get("lead_time_days"));
      if (searchParams.get("incoterm")) parsedData.incoterm = searchParams.get("incoterm");
      if (searchParams.get("certifications")) {
        parsedData.certifications = searchParams.get("certifications")?.split(",") || [];
      }

      setWizardInitialData(Object.keys(parsedData).length > 0 ? parsedData : undefined);
      setIsWizardOpen(true);
    }
  }, [searchParams]);

  const loadRfqs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rfqsApi.list({
        status: statusFilter !== "all" ? statusFilter : undefined,
        q: searchQuery.trim() || undefined,
      });
      setRfqs(res.rfqs);
    } catch {
      // Fallback
      setRfqs([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadRfqs();
  }, [loadRfqs]);

  const handleWizardSuccess = (rfqId: string, _rfqNum: string) => {
    setIsWizardOpen(false);
    navigate(`/rfq/${rfqId}`, { replace: true });
  };

  const handleWizardCancel = () => {
    setIsWizardOpen(false);
    if (searchParams.toString()) {
      navigate("/rfq", { replace: true });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Autonomous Commercial Negotiation & Quotes</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {isSupplier ? "RFQ Opportunities" : "Request for Quotations (RFQs)"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isSupplier
              ? "Submit competitive quotations on active global buyer procurement requests."
              : "Manage active tenders, broadcast specifications, and compare AI-evaluated bids."}
          </p>
        </div>

        {!isSupplier && (
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setWizardInitialPrompt("");
              setIsWizardOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm px-4 py-2.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create New RFQ</span>
          </Button>
        )}
      </div>

      {/* Create RFQ 4-Step Wizard Modal */}
      {isWizardOpen && (
        <CreateRfqWizard
          initialPrompt={wizardInitialPrompt}
          initialData={wizardInitialData}
          onSuccess={handleWizardSuccess}
          onCancel={handleWizardCancel}
        />
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product, port, or RFQ#..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* RFQ Cards Grid */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : rfqs.length === 0 ? (
        <EmptyState
          title="No RFQs Found"
          description="There are no RFQs matching your current filter criteria."
          actionLabel={!isSupplier ? "Create RFQ" : undefined}
          onAction={() => setIsWizardOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rfqs.map((rfq) => {
            const statusColor =
              rfq.status === "active" || rfq.status === "evaluating"
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : rfq.status === "awarded"
                ? "bg-blue-50 text-blue-700 border-blue-300"
                : rfq.status === "draft"
                ? "bg-amber-50 text-amber-700 border-amber-300"
                : "bg-slate-100 text-slate-600 border-slate-300";

            return (
              <div
                key={rfq.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all duration-300 p-5 sm:p-6 flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top Bar: RFQ Number & Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {rfq.rfq_number}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${statusColor}`}
                    >
                      {rfq.status}
                    </span>
                  </div>

                  <Link
                    to={`/rfq/${rfq.id}`}
                    className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors line-clamp-1"
                  >
                    {rfq.title}
                  </Link>

                  <div className="text-xs text-slate-500 mt-1">
                    Destination:{" "}
                    <strong className="text-slate-800">
                      {rfq.destination_port}, {rfq.destination_country}
                    </strong>{" "}
                    ({rfq.incoterm})
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block">Quantity:</span>
                      <span className="font-semibold text-slate-800">
                        {rfq.quantity.toLocaleString()} {rfq.unit}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Target Budget:</span>
                      <span className="font-semibold text-slate-800">
                        {rfq.currency} ${rfq.target_price_min?.toFixed(2)} - ${rfq.target_price_max?.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Quotes:</span>
                      <span className="font-semibold text-blue-600">
                        {rfq.quotes_count} {rfq.quotes_count === 1 ? "bid" : "bids"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom CTA */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-400">
                    Deadline: {rfq.deadline ? new Date(rfq.deadline).toLocaleDateString() : "Open"}
                  </span>
                  <Link
                    to={`/rfq/${rfq.id}`}
                    className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 group"
                  >
                    <span>View RFQ Details</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
