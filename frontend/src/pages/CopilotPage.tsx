import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  Send,
  Sparkles,
  BookOpen,
  MessageSquare,
  Plus,
  Trash2,
  ChevronRight,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import {
  copilotApi,
  CopilotSource,
  TradeGuideSummary,
  ConversationSummary,
  SuggestedPrompt,
} from "../lib/api/copilot";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: CopilotSource[];
  suggested_actions?: string[];
  created_at?: string;
}

export const CopilotPage: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [guides, setGuides] = useState<TradeGuideSummary[]>([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<SuggestedPrompt[]>([]);
  const [sidebarTab, setSidebarTab] = useState<"history" | "guides">("guides");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Initial data loading
  useEffect(() => {
    const initData = async () => {
      try {
        const [promptsData, guidesData, convsData] = await Promise.all([
          copilotApi.getSuggestedPrompts().catch(() => []),
          copilotApi.getGuides().catch(() => []),
          copilotApi.listConversations().catch(() => []),
        ]);
        setSuggestedPrompts(promptsData);
        setGuides(guidesData);
        setConversations(convsData);

        // Add welcome message if no messages
        setMessages([
          {
            id: "welcome-1",
            role: "assistant",
            content:
              "👋 **Welcome to TradeX Copilot!**\n\nI am your AI assistant for global B2B cross-border commerce, grounded in **15 verified trade knowledge guides**.\n\nI can help you with:\n- **Incoterms® 2020** cost and risk allocations (FOB vs CIF vs DAP)\n- **HS Code Classification & Tariffs** (e.g. Organic Turmeric `0910.30`)\n- **EU Organic TRACES NT & US FDA FSMA** compliance protocols\n- **Letters of Credit (UCP 600)** documentary requirements\n- **German Customs (ATLAS)** and container demurrage prevention\n\nWhat cross-border transaction or trade route can I assist you with today?",
            suggested_actions: [
              "What are the seller responsibilities under CIF Hamburg?",
              "Check HS code for turmeric powder",
              "Explain Letter of Credit UCP 600 payment terms",
            ],
          },
        ]);
      } catch (e) {
        console.error("Failed to load Copilot initial data:", e);
      }
    };
    initData();
  }, []);

  // Send message handler
  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const res = await copilotApi.sendMessage(text, conversationId);
      if (res.conversation_id) {
        setConversationId(res.conversation_id);
      }

      const botMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.response,
        sources: res.sources,
        suggested_actions: res.suggested_actions,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, botMsg]);

      // Refresh conversations list if new conversation created
      if (!conversationId && res.conversation_id) {
        const updatedConvs = await copilotApi.listConversations().catch(() => []);
        setConversations(updatedConvs);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "⚠️ Sorry, I encountered an issue retrieving trade insights. Please try again or check your connectivity.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Start new conversation
  const handleNewChat = () => {
    setConversationId(undefined);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: "Started a new trade inquiry. How can I assist you with international trade regulations, landed costs, or compliance?",
        suggested_actions: [
          "What are the seller responsibilities under CIF Hamburg?",
          "Check HS code for turmeric powder",
          "What is the difference between FCL and LCL container shipping?",
        ],
      },
    ]);
  };

  // Load past conversation
  const handleSelectConversation = async (conv: ConversationSummary) => {
    try {
      setLoading(true);
      const detail = await copilotApi.getConversation(conv.id);
      setConversationId(detail.id);
      setMessages(
        detail.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources,
          suggested_actions: m.suggested_actions?.map((a) => a.action) || [],
          created_at: m.created_at,
        }))
      );
    } catch {
      console.error("Failed to load conversation:", conv.id);
    } finally {
      setLoading(false);
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await copilotApi.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        handleNewChat();
      }
    } catch {
      console.error("Failed to delete conversation:", id);
    }
  };

  // Handle suggested action click
  const handleActionClick = (action: string) => {
    const actLower = String(action).toLowerCase();
    if (actLower.includes("rfq")) {
      navigate("/rfqs");
    } else if (actLower.includes("landed cost") || actLower.includes("freight")) {
      navigate("/rfqs");
    } else if (actLower.includes("document")) {
      navigate("/documents");
    } else if (actLower.includes("finance") || actLower.includes("escrow")) {
      navigate("/trade-finance");
    } else if (actLower.includes("supplier") || actLower.includes("search")) {
      navigate("/suppliers");
    } else if (actLower.includes("shipment") || actLower.includes("track")) {
      navigate("/shipments");
    } else {
      handleSend(action);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-slate-50 overflow-hidden">
      {/* Left Sidebar: Knowledge Guides & History */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col hidden lg:flex flex-shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">Trade Knowledge Base</h2>
              <p className="text-[11px] text-slate-500">15 Grounded Guides</p>
            </div>
          </div>
          <button
            onClick={handleNewChat}
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-md transition-colors"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 px-4 pt-2 gap-4 text-xs font-semibold">
          <button
            onClick={() => setSidebarTab("guides")}
            className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
              sidebarTab === "guides"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Guides ({guides.length})
          </button>
          <button
            onClick={() => setSidebarTab("history")}
            className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
              sidebarTab === "history"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            History ({conversations.length})
          </button>
        </div>

        {/* Sidebar Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sidebarTab === "guides" ? (
            guides.map((g) => (
              <div
                key={g.slug}
                onClick={() => {
                  handleSend(`Explain the core rules and compliance requirements in ${g.title}`);
                }}
                className="p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {g.category}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-xs font-semibold text-slate-800 mt-1.5 leading-snug group-hover:text-indigo-700">
                  {g.title}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {g.topics.slice(0, 3).map((t) => (
                    <span key={t} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No past conversations yet.</div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => handleSelectConversation(c)}
                className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer text-left transition-colors ${
                  conversationId === c.id
                    ? "bg-indigo-50 border border-indigo-200 text-indigo-900"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <MessageSquare className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <p className="text-xs font-medium truncate">{c.title}</p>
                </div>
                <button
                  onClick={(e) => handleDeleteConversation(c.id, e)}
                  className="p-1 hover:text-rose-600 text-slate-400 opacity-60 hover:opacity-100 transition-opacity"
                  title="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
        {/* Top Chat Bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                AI Trade Copilot
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  RAG Grounded
                </span>
              </h1>
              <p className="text-[11px] text-slate-500">
                Hybrid vector & full-text knowledge retrieval across 15 international trade compliance standards
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Inquiry
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 shadow-sm text-sm ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-none"
                      : "bg-white border border-slate-200 text-slate-800 rounded-tl-none space-y-3"
                  }`}
                >
                  {/* Message Body */}
                  <div className="whitespace-pre-wrap leading-relaxed space-y-2">
                    {m.content}
                  </div>

                  {/* Grounded Source Citations */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                        Verified Trade Sources Cited:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.sources.map((src, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(`Tell me more about ${src.title}`)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 px-2 py-0.5 rounded-md transition-colors"
                          >
                            <span>{src.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Actions */}
                  {m.suggested_actions && m.suggested_actions.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                      {m.suggested_actions.map((act, i) => (
                        <button
                          key={i}
                          onClick={() => handleActionClick(act)}
                          className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-50 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg transition-all"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          <span>{act}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-2 text-xs text-indigo-600 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Retrieving trade knowledge & synthesizing verified guidelines...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom Input Area */}
        <div className="bg-white border-t border-slate-200 p-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* Suggested Prompt Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap mr-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Suggested:
              </span>
              {suggestedPrompts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSend(p.prompt)}
                  className="text-xs bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
                >
                  {p.prompt}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask TradeX Copilot about Incoterms, HS codes, EU TRACES, letters of credit..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={loading}
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={loading || !inputText.trim()}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-2 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Ask Copilot</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
