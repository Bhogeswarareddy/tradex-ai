import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  X,
  Search,
  Paperclip,
  Send,
  FileText,
  Sparkles,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import {
  communicationApi,
  AllowedRecipientItem,
  CreateThreadInput,
} from "../../lib/api/communication";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../features/auth/AuthContext";

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThreadCreated: (threadId: string) => void;
  initialRecipientId?: string;
  initialContextType?: string;
  initialContextId?: string;
  initialSubject?: string;
  initialProductName?: string;
  initialSupplierName?: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  text: string;
}

// Supplier-only templates (Quotation & Order Updates)
const SUPPLIER_TEMPLATES: MessageTemplate[] = [
  {
    id: "thank_you",
    name: "Thank you for your inquiry",
    text: "Dear {buyer_name},\n\nThank you for reaching out regarding {product}. We have confirmed availability and full quality certifications. We would be pleased to provide you with specifications and arrange express sample dispatch to your destination port.\n\nBest regards,\nExport Sales Team",
  },
  {
    id: "quote_attached",
    name: "Quotation attached",
    text: "Dear {buyer_name},\n\nPlease find our formal commercial quotation for {product} attached, with competitive FOB pricing and delivery lead time of 25 days. Our products undergo rigorous batch laboratory testing with Eurofins certification.\n\nLooking forward to your review,\nExport Sales Team",
  },
  {
    id: "request_details",
    name: "Request more details",
    text: "Dear {buyer_name},\n\nTo prepare our most competitive quotation for {product}, could you please specify your target Incoterms (FOB/CIF), required delivery destination port, and anticipated monthly container volume?\n\nThank you,\nExport Sales Team",
  },
  {
    id: "sample_avail",
    name: "Sample availability",
    text: "Dear {buyer_name},\n\nEvaluation samples for {product} are ready in our export facility and can be dispatched via DHL/FedEx express within 48 hours upon confirmation of your delivery address and courier account details.\n\nBest regards,\nExport Sales Team",
  },
  {
    id: "price_validity",
    name: "Price validity",
    text: "Dear {buyer_name},\n\nPlease note that our current price quotation for {product} is valid for 30 calendar days due to prevailing commodity mandi raw material fluctuations and ocean freight surcharges.\n\nBest regards,\nExport Sales Team",
  },
  {
    id: "delivery_update",
    name: "Delivery update",
    text: "Dear {buyer_name},\n\nWe are pleased to provide an update regarding order {order_number} for {product}. Production and quality testing are progressing on schedule, with container loading scheduled on track.\n\nBest regards,\nLogistics & Dispatch Team",
  },
  {
    id: "payment_terms",
    name: "Payment terms",
    text: "Dear {buyer_name},\n\nOur standard export commercial payment terms are 30% advance deposit via wire transfer and 70% balance against copy of Bill of Lading, or TradeX Secure Escrow.\n\nBest regards,\nFinance & Commercial Team",
  },
];

// Buyer-only templates (Prompt 33)
const BUYER_TEMPLATES: MessageTemplate[] = [
  {
    id: "buyer_quote",
    name: "Request a quotation",
    text: "Dear {supplier_name},\n\nWe are interested in sourcing {product} for our commercial operations. Could you please provide your formal FOB/CIF quotation, including current pricing tiers, lead time, and packing details?\n\nLooking forward to your response,\nProcurement Team",
  },
  {
    id: "buyer_moq",
    name: "Ask for MOQ and price tiers",
    text: "Dear {supplier_name},\n\nCould you please share your minimum order quantity (MOQ) and tiered volume pricing for {product}? We are evaluating trial batch quantities and recurring monthly shipments.\n\nBest regards,\nProcurement Team",
  },
  {
    id: "buyer_samples",
    name: "Ask for samples",
    text: "Dear {supplier_name},\n\nWe would like to request product evaluation samples of {product} to verify technical specifications and quality compliance before placing our purchase order. Please advise on sample availability and dispatch timeline.\n\nThank you,\nQuality & Procurement Team",
  },
  {
    id: "buyer_certificates",
    name: "Request certificates",
    text: "Dear {supplier_name},\n\nBefore initiating commercial procurement for {product}, could you please share your latest compliance certificates (such as ISO, HACCP, CE, GMP, or Organic NPOP/NOP) along with an authoritative Certificate of Analysis (COA)?\n\nBest regards,\nCompliance & Sourcing Team",
  },
  {
    id: "buyer_lead_time",
    name: "Ask for lead time",
    text: "Dear {supplier_name},\n\nWhat is your current production and export shipping lead time for an order of {product}? We are finalizing container logistics schedules and require confirmed dispatch windows.\n\nThank you,\nSupply Chain Team",
  },
  {
    id: "buyer_negotiation",
    name: "Negotiation opener",
    text: "Dear {supplier_name},\n\nWe have reviewed your catalogue listing for {product} and are keen to move forward with a substantial recurring trade order. We would like to discuss targeted pricing and escrow payment terms that align with our volume expectations.\n\nBest regards,\nCommercial Procurement Director",
  },
];

export const NewMessageModal: React.FC<NewMessageModalProps> = ({
  isOpen,
  onClose,
  onThreadCreated,
  initialRecipientId,
  initialContextType = "product",
  initialContextId,
  initialSubject,
  initialProductName,
  initialSupplierName,
}) => {
  const { user } = useAuth();
  const isSupplier = user?.role === "supplier";
  const activeTemplates = isSupplier ? SUPPLIER_TEMPLATES : BUYER_TEMPLATES;

  const [recipients, setRecipients] = useState<AllowedRecipientItem[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<AllowedRecipientItem | null>(null);

  // Form states - Prompt 33: default context is 'Product inquiry'
  const [contextType, setContextType] = useState(initialContextType);
  const [contextId, setContextId] = useState(initialContextId || "");
  const [subject, setSubject] = useState(
    initialSubject || (initialProductName ? `Inquiry regarding ${initialProductName}` : "")
  );
  const [messageBody, setMessageBody] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Template dropdown state
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<MessageTemplate[]>(() => {
    try {
      const stored = localStorage.getItem("tradex_custom_templates");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Debounced search for recipients
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      loadRecipients(searchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  const loadRecipients = async (q?: string) => {
    setLoadingRecipients(true);
    try {
      const list = await communicationApi.listRecipients(q || undefined);
      setRecipients(list);
      if (initialRecipientId && !selectedRecipient) {
        const found = list.find(
          (r) =>
            r.participant_id === initialRecipientId ||
            r.recipient_user_id === initialRecipientId ||
            r.company_id === initialRecipientId
        );
        if (found) {
          setSelectedRecipient(found);
          if (found.context_type) setContextType(found.context_type);
          if (found.context_id) setContextId(found.context_id);
          if (!subject) {
            setSubject(`Inquiry regarding ${initialProductName || found.company_name}`);
          }
        }
      }
    } catch (err: unknown) {
      console.error("Failed to load recipients", err);
      // Non-blocking: Page/modal never breaks even if search query fails
      setRecipients([]);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const handleSelectRecipient = (recip: AllowedRecipientItem) => {
    setSelectedRecipient(recip);
    if (!subject) {
      setSubject(`Inquiry regarding ${initialProductName || recip.company_name}`);
    }
    if (recip.context_type) {
      setContextType(recip.context_type);
    }
    if (recip.context_id) {
      setContextId(recip.context_id);
    }
  };

  const handleApplyTemplate = (tmpl: MessageTemplate) => {
    let replaced = tmpl.text;
    const supplierName =
      selectedRecipient?.company_name ||
      initialSupplierName ||
      selectedRecipient?.name ||
      "Supplier";
    const buyerName = user?.full_name || "Procurement Officer";
    const productName =
      initialProductName ||
      (subject
        ? subject.replace(/^Inquiry regarding\s*/i, "").replace(/^Discussion:\s*/i, "")
        : "Product");

    replaced = replaced.replace(/{supplier_name}/g, supplierName);
    replaced = replaced.replace(/{buyer_name}/g, buyerName);
    replaced = replaced.replace(/{product}/g, productName || "Commercial Product");
    replaced = replaced.replace(/{destination}/g, "Hamburg, Germany");
    replaced = replaced.replace(/{lead_time}/g, "25");
    replaced = replaced.replace(/{order_number}/g, contextId || "PO-2026-001");
    setMessageBody(replaced);
    setTemplateMenuOpen(false);
  };

  const handleSaveCurrentAsTemplate = () => {
    if (!messageBody.trim()) return;
    const name = window.prompt("Enter template name:", `Template ${customTemplates.length + 1}`);
    if (!name) return;
    const newTmpl: MessageTemplate = {
      id: `custom_${Date.now()}`,
      name,
      text: messageBody,
    };
    const updated = [...customTemplates, newTmpl];
    setCustomTemplates(updated);
    localStorage.setItem("tradex_custom_templates", JSON.stringify(updated));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipient) {
      setError("Please select a counterparty recipient.");
      return;
    }
    if (!subject.trim()) {
      setError("Please enter a subject.");
      return;
    }
    if (!messageBody.trim()) {
      setError("Please enter your message text.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: CreateThreadInput = {
        recipient_id: selectedRecipient.participant_id,
        subject: subject.trim(),
        initial_message: messageBody.trim(),
        context_type: contextType,
        context_id: contextId || undefined,
        product_id: contextType === "product" && contextId ? contextId : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      const res = await communicationApi.createThread(payload);
      onThreadCreated(res.thread_id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send message";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachMockFile = () => {
    const fileName = `Specification_Sheet_${Date.now().toString().slice(-4)}.pdf`;
    setAttachments((prev) => [...prev, fileName]);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Start New Trade Conversation"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
            {error}
          </div>
        )}

        {/* 1. Recipient Picker */}
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
            Select Verified Recipient (Anti-Spam Protected)
          </label>
          {selectedRecipient ? (
            <div className="flex items-center justify-between p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
              <div className="flex items-center gap-3">
                {selectedRecipient.logo_url ? (
                  <img
                    src={selectedRecipient.logo_url}
                    alt={selectedRecipient.company_name}
                    className="w-9 h-9 rounded-full object-cover border border-blue-200"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    {selectedRecipient.company_name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {selectedRecipient.company_name}
                    </span>
                    {selectedRecipient.verified && (
                      <span title="Verified">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      </span>
                    )}
                    <span className="px-1.5 py-0.2 rounded text-[9px] uppercase font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {selectedRecipient.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span>{selectedRecipient.country}</span>
                    {selectedRecipient.categories && selectedRecipient.categories.length > 0 && (
                      <>
                        <span>•</span>
                        <span>{selectedRecipient.categories.slice(0, 3).join(", ")}</span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold block">
                    {selectedRecipient.relationship_reason}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedRecipient(null)}
                className="text-xs h-7 px-2"
              >
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by company name, contact, product, category, or country..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                {loadingRecipients ? (
                  <div className="p-4 text-center text-xs text-slate-400">Loading authorized counterparties...</div>
                ) : recipients.length === 0 ? (
                  <div className="p-4 text-center space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No authorized recipients match your search.
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <Link
                        to="/rfqs"
                        onClick={onClose}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-semibold transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Create an RFQ</span>
                      </Link>
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-semibold transition-colors"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  recipients.map((r) => (
                    <div
                      key={r.participant_id}
                      onClick={() => handleSelectRecipient(r)}
                      className="p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3">
                        {r.logo_url ? (
                          <img
                            src={r.logo_url}
                            alt={r.company_name}
                            className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {r.company_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {r.company_name}
                            </span>
                            {r.verified && (
                              <span title="Verified Exporter">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span>{r.country}</span>
                            {r.categories && r.categories.length > 0 && (
                              <>
                                <span>•</span>
                                <span>{r.categories.slice(0, 3).join(", ")}</span>
                              </>
                            )}
                          </div>
                          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                            {r.relationship_reason}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase shrink-0">
                        {r.role}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. Context & Subject */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Select
              label="Context"
              value={contextType}
              onChange={(e) => setContextType(e.target.value)}
              options={[
                { value: "product", label: "Product inquiry" },
                { value: "general", label: "General inquiry" },
                { value: "rfq", label: "RFQ Opportunity" },
                { value: "quote", label: "Quotation" },
                { value: "order", label: "Order / Contract" },
              ]}
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Subject / Topic"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Export Inquiry on Organic Turmeric Powder"
              required
            />
          </div>
        </div>

        {/* 3. Templates Bar & Message Textarea */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Message Content
            </label>

            {/* Templates Dropdown Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
                className="flex items-center gap-1.5 text-xs text-[#2563EB] font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Insert Template</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {templateMenuOpen && (
                <div className="absolute right-0 mt-1 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in text-xs max-h-60 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                    {isSupplier ? "Supplier Export Templates" : "Buyer Inquiry Templates"}
                  </div>
                  {activeTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleApplyTemplate(t)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex flex-col transition-colors"
                    >
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-[10px] text-slate-400 truncate max-w-full">
                        {t.text.split("\n")[0]}
                      </span>
                    </button>
                  ))}

                  {customTemplates.length > 0 && (
                    <>
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-y border-slate-100 dark:border-slate-800 mt-1">
                        Your Custom Templates
                      </div>
                      {customTemplates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleApplyTemplate(t)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex flex-col transition-colors"
                        >
                          <span className="font-semibold">{t.name}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <textarea
            rows={5}
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder={
              isSupplier
                ? "Type your trade message or pick a pre-written supplier template above..."
                : "Type your product inquiry or select a buyer template above..."
            }
            className="w-full p-3 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB] transition-colors"
            required
          />

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleSaveCurrentAsTemplate}
              disabled={!messageBody.trim()}
              className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40"
            >
              + Save message as custom template
            </button>
            <span className="text-[10px] text-slate-400">
              Templates fill the box for editing before dispatch.
            </span>
          </div>
        </div>

        {/* 4. Attachments */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Attachments (COA, Spec Sheet, Lab Reports)
            </span>
            <button
              type="button"
              onClick={handleAttachMockFile}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>Attach File</span>
            </button>
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((f, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span>{f}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-slate-400 hover:text-rose-500 ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 5. Footer Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={submitting}
            className="gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Message</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
