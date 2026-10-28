import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Sparkles,
  Send,
  CheckCircle2,
  Globe,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  SupplierInquiryItem,
  supplierPortalApi,
} from "../../lib/api/supplierPortal";
import { Button } from "../../components/ui/Button";

export const SupplierInquiriesView: React.FC = () => {
  const navigate = useNavigate();
  const [inquiries, setInquiries] = useState<SupplierInquiryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<SupplierInquiryItem | null>(null);

  // Quick reply drawer state
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    loadInquiries();
  }, []);

  const loadInquiries = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await supplierPortalApi.getInquiries();
      setInquiries(data);
    } catch (err: any) {
      setError(err.message || "Failed to load buyer inquiries.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDrawer = (item: SupplierInquiryItem) => {
    setSelectedInquiry(item);
    setReplyText("");
    setReplySuccess(false);
  };

  const handleAiDraftReply = () => {
    if (!selectedInquiry) return;
    setReplyText(
      `Dear ${selectedInquiry.sender_name},\n\nThank you for reaching out to us regarding your inquiry "${selectedInquiry.subject}". We confirm active harvest capacity to fulfill your requested volume.\n\nOur current export terms:\n• Minimum Order Quantity (MOQ): 500 kg\n• Lead Time: 12-14 business days from LC confirmation\n• Certifications: ISO 9001, HACCP, EU Organic\n\nPlease let us know if you would like test samples or an official Proforma Invoice.\n\nBest regards,\nExport Sales Team`
    );
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry || !replyText.trim()) return;
    setIsSending(true);
    try {
      await supplierPortalApi.replyInquiry(selectedInquiry.id, replyText.trim());
      setReplySuccess(true);
      // update state locally
      const updatedMessages = [
        ...(selectedInquiry.messages || []),
        {
          id: String(Date.now()),
          sender_name: "You",
          sender_role: "supplier",
          body: replyText.trim(),
          created_at: "Just now",
          is_mine: true,
        },
      ];
      const updatedInquiry = { ...selectedInquiry, replied: true, messages: updatedMessages };
      setSelectedInquiry(updatedInquiry);
      setInquiries(inquiries.map((inq) => (inq.id === selectedInquiry.id ? updatedInquiry : inq)));
      setReplyText("");
      setTimeout(() => setReplySuccess(false), 2500);
    } catch (err: any) {
      alert(err.message || "Failed to send reply");
    } finally {
      setIsSending(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedInquiry) return;
    setIsResolving(true);
    try {
      await supplierPortalApi.resolveInquiry(selectedInquiry.id);
      const updatedInquiry = { ...selectedInquiry, status: "resolved" };
      setSelectedInquiry(updatedInquiry);
      setInquiries(inquiries.map((inq) => (inq.id === selectedInquiry.id ? updatedInquiry : inq)));
    } catch (err: any) {
      alert(err.message || "Failed to mark inquiry as resolved");
    } finally {
      setIsResolving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-slate-200 rounded-lg" />
        <div className="h-64 bg-slate-100 rounded-2xl border border-slate-200" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <p className="text-sm font-bold text-rose-800">{error}</p>
        <Button variant="primary" size="sm" onClick={loadInquiries}>
          Retry Loading Inquiries
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          Buyer Inquiries & Quote Threads ({inquiries.length})
        </h3>
        <p className="text-xs text-slate-500">
          Direct messages and RFQ discussions from verified international importers
        </p>
      </div>

      {inquiries.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-3">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-700 text-sm">No Inquiries Found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You do not have any incoming inquiries or message threads yet.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3 pl-5">Buyer</th>
                  <th className="p-3">Country</th>
                  <th className="p-3">Subject / Request</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right pr-5">Conversation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inquiries.map((inq) => (
                  <tr key={inq.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 pl-5">
                      <span className="font-bold text-slate-900 block">{inq.sender_name}</span>
                      <span className="text-slate-400 text-[11px]">{inq.sender_company}</span>
                    </td>
                    <td className="p-3">
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        {inq.sender_country}
                      </span>
                    </td>
                    <td className="p-3 max-w-sm">
                      <span className="font-bold text-slate-800 block line-clamp-1">{inq.subject}</span>
                      <span className="text-slate-500 text-[11px] line-clamp-1">{inq.message}</span>
                    </td>
                    <td className="p-3">
                      {inq.status === "resolved" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          Resolved
                        </span>
                      ) : inq.replied ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
                          <Check className="w-3 h-3 text-emerald-600" /> Replied
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Needs Reply
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400">{inq.created_at}</td>
                    <td className="p-3 text-right pr-5">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenDrawer(inq)}
                        className="text-xs font-bold"
                      >
                        Open Thread &rarr;
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Thread & Reply Drawer Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">{selectedInquiry.subject}</h3>
                <p className="text-xs text-slate-500">
                  {selectedInquiry.sender_name} &bull; {selectedInquiry.sender_company} ({selectedInquiry.sender_country})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigate(`/messages?buyerId=${selectedInquiry.buyer_id || ''}&context=inquiry&contextId=${selectedInquiry.id}`);
                  }}
                  className="text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 flex items-center gap-1"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Open in Messages</span>
                </Button>
                {selectedInquiry.status !== "resolved" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isResolving}
                    onClick={handleResolve}
                    className="text-xs font-semibold text-slate-600"
                  >
                    Mark Resolved
                  </Button>
                )}
                <button
                  onClick={() => setSelectedInquiry(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages Thread Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-72">
              {selectedInquiry.messages && selectedInquiry.messages.length > 0 ? (
                selectedInquiry.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl max-w-[85%] text-xs space-y-1 ${
                      m.is_mine
                        ? "ml-auto bg-blue-600 text-white rounded-br-none"
                        : "mr-auto bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 font-bold text-[10px] opacity-80">
                      <span>{m.sender_name}</span>
                      <span>{m.created_at}</span>
                    </div>
                    <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
                  </div>
                ))
              ) : (
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-800">
                  <div className="font-bold text-slate-900">{selectedInquiry.sender_name} ({selectedInquiry.sender_company}):</div>
                  <p className="mt-1 whitespace-pre-line">{selectedInquiry.message}</p>
                </div>
              )}
            </div>

            {/* Reply Form */}
            <form onSubmit={handleSendReply} className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Your Reply</span>
                <button
                  type="button"
                  onClick={handleAiDraftReply}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate AI Smart Draft
                </button>
              </div>

              <textarea
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your message, pricing proposal, or specification details..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
              />

              {replySuccess && (
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Reply dispatched to buyer successfully!</span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setSelectedInquiry(null)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={isSending || !replyText.trim()}
                  className="font-bold text-xs"
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  {isSending ? "Sending..." : "Send Message"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
