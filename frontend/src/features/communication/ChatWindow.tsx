import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Send,
  Sparkles,
  ArrowRightLeft,
  Paperclip,
  Building2,
  ShieldCheck,
  Bot,
  Lightbulb,
} from "lucide-react";
import {
  ThreadMessagesResponse,
  OfferData,
  AINegotiationAssistOutput,
  communicationApi,
} from "../../lib/api/communication";
import { OfferCard } from "./OfferCard";
import { CounterOfferModal } from "./CounterOfferModal";
import { Button } from "../../components/ui/Button";

interface ChatWindowProps {
  threadId: string;
  onRefreshThreadList?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  threadId,
  onRefreshThreadList,
}) => {
  const [data, setData] = useState<ThreadMessagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  // Counter offer modal
  const [isCounterModalOpen, setIsCounterModalOpen] = useState(false);
  const [counterBaseOffer, setCounterBaseOffer] = useState<OfferData | undefined>(undefined);

  // AI Deal Assist
  const [isAssistOpen, setIsAssistOpen] = useState(false);
  const [assistData, setAssistData] = useState<AINegotiationAssistOutput | null>(null);
  const [assistLoading, setAssistLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await communicationApi.getMessages(threadId);
      setData(res);
      // Mark as read
      await communicationApi.markThreadRead(threadId).catch(() => {});
      if (onRefreshThreadList) onRefreshThreadList();
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();

    // REST fallback polling every 15 seconds
    const interval = setInterval(() => {
      loadMessages(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [data?.messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    try {
      await communicationApi.sendMessage(threadId, inputText.trim(), "text");
      setInputText("");
      await loadMessages(true);
    } catch (err: any) {
      alert(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleTriggerAiAssist = async () => {
    setIsAssistOpen(true);
    if (!assistData) {
      setAssistLoading(true);
      try {
        const res = await communicationApi.getAiNegotiationAssist({
          thread_id: threadId,
        });
        setAssistData(res);
      } catch (err) {
        console.error("AI Assist error", err);
      } finally {
        setAssistLoading(false);
      }
    }
  };

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 text-slate-400 text-xs">
        Loading conversation...
      </div>
    );
  }

  const messages = data?.messages || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      {/* Header */}
      <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800 font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{data?.title || "Trade Negotiation"}</h3>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Channel
              </span>
              {data?.rfq_id && (
                <>
                  <span>&bull;</span>
                  <Link to={`/rfq/${data.rfq_id}`} className="text-blue-600 hover:underline">
                    View RFQ Spec
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2">
          {data?.quotation_id && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCounterBaseOffer(undefined);
                setIsCounterModalOpen(true);
              }}
              className="text-xs border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-1 font-semibold"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
              <span>Counter-Offer</span>
            </Button>
          )}

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleTriggerAiAssist}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs px-3 py-1.5 flex items-center gap-1.5 font-bold shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Deal Assist</span>
          </Button>
        </div>
      </div>

      {/* Main Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs">
            <p>No messages in this negotiation yet.</p>
            <p className="text-[11px] mt-1 text-slate-500">
              Start by typing a message below or proposing a formal counter-offer.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.is_me;
            const isSystem = m.message_type === "system";
            const isOffer = m.message_type === "offer" && m.offer_data;

            if (isSystem) {
              return (
                <div key={m.id} className="flex justify-center my-3">
                  <div className="px-4 py-1.5 rounded-full bg-slate-200/80 text-slate-700 text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>{m.body}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-600">
                    {isMe ? "You" : m.sender_name || "Counterparty"}
                  </span>
                  <span>&bull;</span>
                  <span>
                    {m.created_at
                      ? new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                </div>

                <div
                  className={`max-w-xl rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                    isMe
                      ? "bg-blue-600 text-white shadow-xs rounded-tr-xs"
                      : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700 shadow-2xs rounded-tl-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>

                  {/* Render Offer Card if message is structured offer */}
                  {isOffer && (
                    <div className="mt-2 text-slate-900">
                      <OfferCard
                        messageId={m.id}
                        offer={m.offer_data!}
                        isMe={isMe}
                        onOfferUpdated={() => loadMessages(true)}
                        onOpenCounter={(offer) => {
                          setCounterBaseOffer(offer);
                          setIsCounterModalOpen(true);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* AI Deal Assist Drawer / Overlay Panel */}
      {isAssistOpen && (
        <div className="mx-6 mb-2 rounded-2xl bg-gradient-to-br from-indigo-50 via-blue-50 to-white border border-blue-200 p-4 text-xs shadow-md space-y-3 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between border-b border-blue-100 pb-2">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-slate-900">AI Negotiation Deal Assist</span>
              <span className="px-2 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-semibold">
                Strategic Rationale
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsAssistOpen(false)}
              className="text-slate-400 hover:text-slate-700 text-xs font-bold"
            >
              &times;
            </button>
          </div>

          {assistLoading ? (
            <div className="py-4 text-center text-slate-500 text-xs">
              Analyzing counter-offer trends and contract economics...
            </div>
          ) : assistData ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div className="p-2.5 rounded-xl bg-white border border-blue-100">
                  <span className="text-[10px] text-slate-400 font-semibold block">Suggested Counter Price</span>
                  <span className="text-base font-black text-blue-700">
                    €{assistData.recommended_counter_price.toFixed(2)}/kg
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-blue-100">
                  <span className="text-[10px] text-slate-400 font-semibold block">Incoterm</span>
                  <span className="text-sm font-bold text-slate-800">{assistData.suggested_incoterm}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-blue-100">
                  <span className="text-[10px] text-slate-400 font-semibold block">Compromise Terms</span>
                  <span className="text-xs font-bold text-slate-800">{assistData.compromise_terms}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-blue-100 text-slate-600 space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  Tactical Reasoning
                </span>
                <p className="text-[11px] leading-relaxed">{assistData.reasoning}</p>
              </div>

              {/* Suggested Reply Draft */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="italic text-[11px] text-slate-500 truncate">
                  Draft: "{assistData.draft_message_to_counterparty}"
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setInputText(assistData.draft_message_to_counterparty);
                    setIsAssistOpen(false);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] px-3 py-1 shrink-0 font-bold"
                >
                  Insert Draft
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Input Box Footer */}
      <form
        onSubmit={handleSendMessage}
        className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3"
      >
        <button
          type="button"
          title="Attach document or spec"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type commercial message, question, or negotiation reply..."
          className="flex-1 py-2.5 px-4 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-slate-800 dark:text-slate-100"
        />

        <Button
          type="submit"
          variant="primary"
          disabled={!inputText.trim() || sending}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 shadow-xs"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </Button>
      </form>

      {/* Counter Offer Modal */}
      {data?.quotation_id && (
        <CounterOfferModal
          isOpen={isCounterModalOpen}
          onClose={() => setIsCounterModalOpen(false)}
          quoteId={data.quotation_id}
          initialPrice={counterBaseOffer?.price || 3.05}
          initialQuantity={counterBaseOffer?.quantity || 20000}
          initialLeadTime={counterBaseOffer?.lead_time_days || 22}
          onSuccess={() => {
            loadMessages(true);
            if (onRefreshThreadList) onRefreshThreadList();
          }}
        />
      )}
    </div>
  );
};
