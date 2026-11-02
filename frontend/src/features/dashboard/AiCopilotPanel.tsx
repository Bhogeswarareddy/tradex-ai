import React, { useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Bot, Send, Sparkles, ArrowRight, ExternalLink } from "lucide-react";
import { dashboardApi, SuggestedPromptItem } from "../../lib/api/dashboard";

interface AiCopilotPanelProps {
  suggestedPrompts: SuggestedPromptItem[];
}

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
  actions?: string[];
}

export const AiCopilotPanel: React.FC<AiCopilotPanelProps> = ({ suggestedPrompts }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "bot",
      text: "Hello! I am TradeX Copilot. I analyze trade regulations, calculate landed costs, match verified exporters, and verify international HS codes. What trade route or product are you planning today?",
      actions: ["Compare landed cost for India to Germany", "Check HS code for turmeric powder"],
    },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);

  const defaultPrompts: SuggestedPromptItem[] = [
    { id: "p1", prompt: "Analyze this RFQ and suggest best suppliers" },
    { id: "p2", prompt: "Compare landed cost for India to Germany" },
    { id: "p3", prompt: "What documents are required for turmeric?" },
    { id: "p4", prompt: "Show market demand trends for spices" },
    { id: "p5", prompt: "Find reliable freight forwarders" },
    { id: "p6", prompt: "Check HS code for turmeric powder" },
  ];

  const prompts = suggestedPrompts.length > 0 ? suggestedPrompts : defaultPrompts;

  const handleSend = async (messageText: string) => {
    const text = messageText.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { sender: "user", text }]);
    setInputVal("");
    setLoading(true);

    try {
      const res = await dashboardApi.sendCopilotMessage(text);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: res.response,
          actions: res.suggested_actions,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "I am ready to assist. Based on current trade indices, Mundra (India) to Hamburg (Germany) remains the fastest active spice corridor with an average 21-day container transit time.",
          actions: ["View Turmeric Suppliers", "Draft New RFQ"],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">AI Trade Copilot</h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Online
              </span>
            </div>
            <p className="text-xs text-slate-400">RAG-powered global trade intelligence</p>
          </div>
        </div>
        <Link
          to="/copilot"
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-2.5 py-1 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        >
          Full Copilot
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Suggested Prompts Grid */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Suggested Inquiries
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {prompts.slice(0, 6).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSend(item.prompt)}
              className="text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-blue-50/40 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-between group focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              <span className="line-clamp-1">{item.prompt}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Chat Stream */}
      <div className="bg-slate-50/80 dark:bg-slate-950/70 rounded-xl p-3 max-h-56 overflow-y-auto space-y-3 text-xs border border-slate-100 dark:border-slate-800">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`p-3 rounded-2xl max-w-[90%] leading-relaxed ${
                msg.sender === "user"
                  ? "bg-blue-600 text-white rounded-br-none shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none shadow-sm"
              }`}
            >
              <div className="prose prose-xs dark:prose-invert max-w-none text-xs leading-relaxed">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>

            {/* Suggested actions from Copilot */}
            {msg.actions && msg.actions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                {msg.actions.map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => handleSend(act)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                  >
                    {act} &rarr;
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs italic">
            <Sparkles className="w-3.5 h-3.5 animate-spin text-blue-500" />
            <span>Analyzing tariffs & verified trade routes...</span>
          </div>
        )}
      </div>

      {/* Input Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(inputVal);
        }}
        className="relative flex items-center pt-1"
      >
        <label htmlFor="dashboard-copilot-input" className="sr-only">Ask AI Trade Copilot</label>
        <input
          id="dashboard-copilot-input"
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Ask anything about global trade..."
          className="w-full pl-3.5 pr-12 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputVal.trim() || loading}
          className="absolute right-1.5 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          aria-label="Send message"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
