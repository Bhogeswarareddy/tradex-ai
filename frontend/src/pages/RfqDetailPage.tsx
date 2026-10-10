import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FileText,
  MessageSquare,
  Paperclip,
  Clock,
  ArrowLeft,
  Sparkles,
  Send,
} from "lucide-react";
import { rfqsApi, RFQDetail } from "../lib/api/rfqs";
import {
  RfqHeaderCard,
  RfqQuotesTab,
  SubmitQuoteModal,
} from "../features/rfq";
import { Button } from "../components/ui/Button";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorState } from "../components/ErrorState";
import { useAuth } from "../features/auth";

export const RfqDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isBuyer = user?.role !== "supplier";
  const isSupplier = user?.role === "supplier";

  const [rfq, setRfq] = useState<RFQDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"quotes" | "ai_compare" | "negotiation" | "documents" | "timeline">("quotes");

  const [isSubmitQuoteOpen, setIsSubmitQuoteOpen] = useState(false);
  const [isAwarding, setIsAwarding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadRfq = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await rfqsApi.getById(id);
      setRfq(data);
    } catch (err: any) {
      setError(err.message || "Failed to load RFQ details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadRfq();
  }, [loadRfq]);

  const handleAwardQuote = async (quoteId: string) => {
    if (!rfq || isAwarding) return;
    setIsAwarding(true);
    try {
      const res = await rfqsApi.award(rfq.id, quoteId);
      setToastMessage(`Contract awarded successfully to Quote ${res.winning_quote_number}!`);
      loadRfq();
    } catch (err: any) {
      alert(err.message || "Failed to award RFQ");
    } finally {
      setIsAwarding(false);
    }
  };

  const handleCloseRfq = async () => {
    if (!rfq) return;
    try {
      await rfqsApi.close(rfq.id);
      setToastMessage("RFQ bidding closed.");
      loadRfq();
    } catch (err: any) {
      alert(err.message || "Failed to close RFQ");
    }
  };

  const handleInviteSuppliers = async () => {
    if (!rfq) return;
    const ids = window.prompt("Enter Supplier Profile IDs to invite (comma separated):");
    if (ids) {
      const list = ids.split(",").map((s) => s.trim()).filter(Boolean);
      await rfqsApi.invite(rfq.id, list);
      setToastMessage("Invitations sent to suppliers.");
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !rfq) {
    return (
      <ErrorState
        title="RFQ Not Found"
        message={error || "This RFQ could not be loaded."}
        onRetry={loadRfq}
      />
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/rfq"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to RFQs</span>
        </Link>

        {isSupplier && rfq.status === "active" && (
          <Button
            type="button"
            variant="primary"
            onClick={() => setIsSubmitQuoteOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit Quotation</span>
          </Button>
        )}
      </div>

      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="text-emerald-600 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* RFQ Header Card (exact match for RFQ-2026-1042 header) */}
      <RfqHeaderCard
        rfq={rfq}
        isBuyer={isBuyer}
        onCloseRfq={handleCloseRfq}
        onInviteSuppliers={handleInviteSuppliers}
      />

      {/* Tabs Bar: Quotes (5), AI Comparison, Negotiation, Documents, Timeline */}
      <div className="border-b border-slate-200">
        <div className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("quotes")}
            className={`pb-3 px-1 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === "quotes"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Quotes ({rfq.quotes_count})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ai_compare")}
            className={`pb-3 px-1 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === "ai_compare"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span>AI Comparison</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("negotiation")}
            className={`pb-3 px-1 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === "negotiation"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Negotiation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("documents")}
            className={`pb-3 px-1 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === "documents"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Paperclip className="w-4 h-4" />
            <span>Documents ({rfq.attachments?.length || 2})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`pb-3 px-1 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === "timeline"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Timeline</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Quotes */}
      {activeTab === "quotes" && (
        <RfqQuotesTab
          quotes={rfq.quotes}
          isBuyer={isBuyer}
          rfqStatus={rfq.status}
          onAwardQuote={handleAwardQuote}
          isAwarding={isAwarding}
        />
      )}

      {/* Tab 2: AI Comparison */}
      {activeTab === "ai_compare" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                AI Commercial Bids Multi-Factor Analysis
              </h3>
              <p className="text-xs text-slate-500">
                Cross-comparison of 5 verified bids based on landed freight, payment terms, and lab credentials.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-2">
              <span className="font-bold text-emerald-800 block text-sm">Recommended Winner</span>
              <p className="font-semibold text-slate-900 text-sm">Sri Bharat Spices Pvt Ltd</p>
              <p className="text-emerald-900">
                Score: <strong>96.5</strong> &bull; Landed Cost: <strong>€3.02/kg</strong> &bull; Lead Time: <strong>18 days</strong>
              </p>
              <p className="text-slate-600">
                Fully accredited EU Organic and ISO 22000 certificates with lowest total delivered landed cost to Port of Hamburg.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs space-y-2">
              <span className="font-bold text-blue-800 block text-sm">Fastest Delivery</span>
              <p className="font-semibold text-slate-900 text-sm">NatureFarm Global</p>
              <p className="text-blue-900">
                Score: <strong>94.2</strong> &bull; Landed Cost: <strong>€3.10/kg</strong> &bull; Lead Time: <strong>14 days</strong>
              </p>
              <p className="text-slate-600">
                Shortest factory cycle (14 days) and 100% Irrevocable LC terms. Ideal if urgent shipment is prioritized over marginal price.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-2">
              <span className="font-bold text-amber-800 block text-sm">Lowest Unit FOB</span>
              <p className="font-semibold text-slate-900 text-sm">Madhav Agro Exports</p>
              <p className="text-amber-900">
                Score: <strong>91.0</strong> &bull; Unit Price: <strong>€2.80/kg</strong> &bull; Landed Cost: <strong>€3.08/kg</strong>
              </p>
              <p className="text-slate-600">
                Lowest initial unit price, but higher ocean freight allocation (€0.28/kg) and 22-day lead time result in higher CIF landed cost.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Negotiation */}
      {activeTab === "negotiation" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <MessageSquare className="w-12 h-12 text-blue-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Commercial Negotiation Channel</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Direct real-time supplier chat with autonomous AI suggested counter-offers and contract milestone terms.
          </p>
          <Link to="/messages">
            <Button variant="outline" size="sm" className="mt-2 text-xs border-slate-300">
              Open Negotiation Chat
            </Button>
          </Link>
        </div>
      )}

      {/* Tab 4: Documents */}
      {activeTab === "documents" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Attached Trade Documents</h3>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-slate-800">Eurofins_Pesticide_Residue_Analysis_Spec.pdf</span>
              </div>
              <span className="text-slate-400">1.4 MB</span>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-slate-800">EU_Organic_Certification_Requirement_2026.pdf</span>
              </div>
              <span className="text-slate-400">820 KB</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Timeline */}
      {activeTab === "timeline" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Contract Lifecycle Timeline</h3>
          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0">✓</div>
              <div>
                <p className="font-bold text-slate-800">RFQ Published</p>
                <p className="text-slate-500">Requirements broadcast to 5 verified exporters in network</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">✓</div>
              <div>
                <p className="font-bold text-slate-800">5 Quotations Received</p>
                <p className="text-slate-500">All supplier bids processed and AI scored</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold flex-shrink-0">3</div>
              <div>
                <p className="font-bold text-slate-800">Evaluation & Award</p>
                <p className="text-slate-500">Pending buyer final award selection</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Quote Modal (for Suppliers) */}
      <SubmitQuoteModal
        isOpen={isSubmitQuoteOpen}
        onClose={() => setIsSubmitQuoteOpen(false)}
        rfqId={rfq.id}
        rfqNumber={rfq.rfq_number}
        onSuccess={() => {
          setToastMessage("Your quotation has been submitted successfully!");
          loadRfq();
        }}
      />
    </div>
  );
};
