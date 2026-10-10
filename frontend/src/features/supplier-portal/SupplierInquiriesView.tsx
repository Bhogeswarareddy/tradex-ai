import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Sparkles,
  Send,
  CheckCircle2,
  Globe,
  X,
  FileText,
} from "lucide-react";
import {
  SupplierInquiryItem,
  supplierPortalApi,
} from "../../lib/api/supplierPortal";
import { Button } from "../../components/ui/Button";

export const SupplierInquiriesView: React.FC = () => {
  const [inquiries, setInquiries] = useState<SupplierInquiryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState<SupplierInquiryItem | null>(null);

  // Quick reply drawer state
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);

  useEffect(() => {
    loadInquiries();
  }, []);

  const loadInquiries = async () => {
    setIsLoading(true);
    try {
      const data = await supplierPortalApi.getInquiries();
      setInquiries(data);
    } catch (err) {
      console.error("Failed to load inquiries", err);
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
      `Dear ${selectedInquiry.sender_name},\n\nThank you for reaching out to us regarding your inquiry "${selectedInquiry.subject}". We are pleased to confirm that we currently have active harvest capacity to fulfill your requested volume.\n\nOur current export quotation:\n• Unit Price: $3.45 / kg (FOB Nhava Sheva / JNPT)\n• Minimum Order Quantity (MOQ): 500 kg\n• Lead Time: 12-14 business days from LC confirmation\n• Certifications: USDA Organic NPOP, ISO 22000, HACCP\n\nPlease let us know if you would like us to prepare an official Proforma Invoice or dispatch test inspection lab samples.\n\nBest regards,\nExport Sales Department`
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
      setInquiries(
        inquiries.map((inq) =>
          inq.id === selectedInquiry.id ? { ...inq, replied: true } : inq
        )
      );
      setTimeout(() => {
        setSelectedInquiry(null);
      }, 1500);
    } catch (err: any) {
      alert(err.message || "Failed to send reply");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          Buyer Inquiries & Quote Requests ({inquiries.length})
        </h3>
        <p className="text-xs text-slate-500">
          Direct messages and RFQ discussions from verified international importers
        </p>
      </div>

      {/* Inquiries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3 pl-5">Buyer</th>
                <th className="p-3">Country</th>
                <th className="p-3">Inquiry Subject</th>
                <th className="p-3">RFQ Reference</th>
                <th className="p-3">Status</th>
                <th className="p-3">Received</th>
                <th className="p-3 text-right pr-5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">
                    Loading inquiries...
                  </td>
                </tr>
              ) : inquiries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">
                    No buyer inquiries received yet.
                  </td>
                </tr>
              ) : (
                inquiries.map((inq) => (
                  <tr
                    key={inq.id}
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                      !inq.is_read ? "bg-blue-50/30 font-medium" : ""
                    }`}
                    onClick={() => handleOpenDrawer(inq)}
                  >
                    <td className="p-3 pl-5">
                      <div className="font-bold text-slate-900">{inq.sender_name}</div>
                      <div className="text-[11px] text-slate-400">{inq.sender_company}</div>
                    </td>
                    <td className="p-3">
                      <span className="flex items-center gap-1 text-slate-700">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        {inq.sender_country}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-900">
                      {inq.subject}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-500">
                      {inq.rfq_number || "Direct Message"}
                    </td>
                    <td className="p-3">
                      {inq.replied ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          Replied
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                          New Inquiry
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400 text-[11px]">
                      {inq.created_at}
                    </td>
                    <td className="p-3 text-right pr-5">
                      <Button
                        size="sm"
                        variant={inq.replied ? "outline" : "primary"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDrawer(inq);
                        }}
                        className="text-xs font-semibold"
                      >
                        {inq.replied ? "View Thread" : "Reply"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Reply Drawer Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end">
          <div className="bg-white h-full max-w-xl w-full border-l border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5 overflow-y-auto flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    {selectedInquiry.sender_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Inquiry from {selectedInquiry.sender_name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedInquiry.sender_company} • {selectedInquiry.sender_country}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedInquiry(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Inquiry Message Box */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">{selectedInquiry.subject}</span>
                  <span className="text-[11px] text-slate-400">{selectedInquiry.created_at}</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {selectedInquiry.message}
                </p>
                {selectedInquiry.rfq_number && (
                  <div className="pt-2 border-t border-slate-200 flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold">
                    <FileText className="w-3.5 h-3.5" />
                    Reference RFQ #{selectedInquiry.rfq_number}
                  </div>
                )}
              </div>

              {/* AI Drafting Assistance Button */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  AI Quotation Assistant
                </div>
                <button
                  type="button"
                  onClick={handleAiDraftReply}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Draft reply with price quote
                </button>
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Your Response
                  </label>
                  <textarea
                    rows={8}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type quotation or click 'Draft reply with price quote' above..."
                    className="w-full text-xs font-medium rounded-xl border border-slate-200 p-3.5 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>

                {replySuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Quotation reply dispatched to buyer via encrypted message!</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedInquiry(null)}
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSending}
                    disabled={!replyText.trim() || replySuccess}
                    className="font-bold text-xs"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Send Reply
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
