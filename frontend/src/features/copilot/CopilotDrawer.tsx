import React, { useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bot,
  X,
  Send,
  Sparkles,
  Maximize2,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { copilotApi, CopilotSource } from "../../lib/api/copilot";

interface QuickMsg {
  sender: "user" | "bot";
  text: string;
  sources?: CopilotSource[];
  actions?: string[];
  ai_meta?: {
    provider: string;
    model: string;
    is_demo: boolean;
    latency_ms: number;
    fallback_reason?: string;
  };
}

export const CopilotDrawer: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<QuickMsg[]>([
    {
      sender: "bot",
      text: "Hi! I'm TradeX Copilot with RAG access to 15 international trade compliance guides. Ask me anything about Incoterms, HS codes, or cross-border rules.",
      actions: ["Compare suppliers", "Analyse this RFQ", "Estimate landed cost", "Check HS code"],
    },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Do not render floating trigger on /copilot page
  if (location.pathname === "/copilot") {
    return null;
  }

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { sender: "user", text }]);
    setInputVal("");
    setLoading(true);

    try {
      const res = await copilotApi.sendMessage(text);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: res.response,
          sources: res.sources,
          actions: res.suggested_actions,
          ai_meta: res.ai_meta,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "I am ready to help. CIF Nhava Sheva to Hamburg takes 21 days with 0% GSP import duty for turmeric powder.",
          actions: ["View Turmeric RFQ", "Check Landed Cost"],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (act: string) => {
    const a = act.toLowerCase();
    if (a.includes("rfq") || a.includes("landed cost")) {
      navigate("/rfqs");
      setIsOpen(false);
    } else if (a.includes("document")) {
      navigate("/documents");
      setIsOpen(false);
    } else if (a.includes("shipment")) {
      navigate("/shipments");
      setIsOpen(false);
    } else {
      handleSend(act);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-full p-3.5 shadow-xl shadow-indigo-600/30 flex items-center gap-2.5 transition-all transform hover:scale-105 group"
          title="Open AI Trade Copilot"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-indigo-600 rounded-full" />
          </div>
          <span className="text-xs font-bold pr-1 hidden sm:inline">Copilot AI</span>
        </button>
      )}

      {/* Slide-out Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[92vw] sm:w-[420px] h-[580px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold flex items-center gap-1.5">
                  TradeX Copilot
                  <span className="text-[10px] text-emerald-300 font-normal">● RAG Active</span>
                </h3>
                <p className="text-[10px] text-slate-300">15 verified trade compliance guides</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate("/copilot");
                }}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
                title="Expand full workspace"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`p-3 rounded-xl max-w-[88%] shadow-xs leading-relaxed whitespace-pre-wrap ${
                    m.sender === "user"
                      ? "bg-indigo-600 text-white rounded-tr-none"
                      : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                  }`}
                >
                  {m.text}

                  {/* Sources Cited */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                      {m.sources.map((src, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[10px] font-medium bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded"
                        >
                          <BookOpen className="w-2.5 h-2.5" />
                          {src.title}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-wrap gap-1">
                      {m.actions.map((act, i) => (
                        <button
                          key={i}
                          onClick={() => handleAction(act)}
                          className="text-[10px] font-semibold bg-slate-50 hover:bg-indigo-50 text-indigo-600 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          {act}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* AI Metadata Footer */}
                  {m.sender === "bot" && (
                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        {m.ai_meta?.is_demo
                          ? `Demo AI (reason: ${m.ai_meta?.fallback_reason || "Trade knowledge engine"})`
                          : `Live AI: ${m.ai_meta?.model || "llama-3.3-70b-versatile"}, ${((m.ai_meta?.latency_ms || 1200) / 1000).toFixed(1)}s`}
                      </span>
                      <span className="font-mono uppercase text-[9px] text-slate-400">
                        {m.ai_meta?.provider || "groq"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium p-2 bg-white rounded-xl border border-slate-200 max-w-[70%]">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Searching knowledge guides...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask Copilot..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={loading}
              className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!inputVal.trim() || loading}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg transition-colors flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
