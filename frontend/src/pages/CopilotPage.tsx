import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
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
  Search,
  Edit2,
  Check,
  X,
  Package,
} from "lucide-react";
import {
  copilotApi,
  CopilotSource,
  TradeGuideSummary,
  ConversationSummary,
  SuggestedPrompt,
} from "../lib/api/copilot";

interface ProductCardItem {
  product_id: string;
  title: string;
  supplier_name: string;
  origin_country?: string;
  unit_price: number;
  currency: string;
  moq: number;
  available_quantity?: number;
  availability_status?: string;
  supplier_verification?: boolean;
  image?: string;
  category_name?: string;
  unit?: string;
  brand?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: CopilotSource[];
  suggested_actions?: string[];
  cards?: ProductCardItem[];
  created_at?: string;
  ai_meta?: {
    provider: string;
    model: string;
    is_demo: boolean;
    latency_ms: number;
    fallback_reason?: string;
  };
}

const getCategoryPlaceholder = (categoryName?: string, productName?: string): string => {
  const text = `${categoryName || ""} ${productName || ""}`.toLowerCase();
  if (
    text.includes("laptop") ||
    text.includes("computer") ||
    text.includes("mobile") ||
    text.includes("phone") ||
    text.includes("electronic")
  ) {
    return "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80";
  }
  if (
    text.includes("chilli") ||
    text.includes("spice") ||
    text.includes("pepper") ||
    text.includes("turmeric") ||
    text.includes("powder")
  ) {
    return "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80";
  }
  if (
    text.includes("rice") ||
    text.includes("grain") ||
    text.includes("basmati") ||
    text.includes("wheat")
  ) {
    return "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80";
  }
  if (
    text.includes("stationery") ||
    text.includes("book") ||
    text.includes("paper") ||
    text.includes("notebook")
  ) {
    return "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80";
  }
  if (
    text.includes("machinery") ||
    text.includes("tractor") ||
    text.includes("motor") ||
    text.includes("pump")
  ) {
    return "https://images.unsplash.com/photo-1532635241-17e820acc59f?auto=format&fit=crop&w=600&q=80";
  }
  return "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80";
};

export const CopilotPage: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(() => {
    return localStorage.getItem("tradex_copilot_conv_id") || undefined;
  });
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [guides, setGuides] = useState<TradeGuideSummary[]>([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<SuggestedPrompt[]>([]);
  const [sidebarTab, setSidebarTab] = useState<"history" | "guides">("guides");
  const [lastTurnStatus, setLastTurnStatus] = useState<{ rag_used?: boolean; mode?: string }>({});
  
  // History Sidebar search & rename & delete confirmation state
  const [historySearch, setHistorySearch] = useState("");
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

        const activeId = localStorage.getItem("tradex_copilot_conv_id");
        if (activeId) {
          try {
            const detail = await copilotApi.getConversation(activeId);
            if (detail && detail.messages && detail.messages.length > 0) {
              setConversationId(detail.id);
              setMessages(
                detail.messages.map((m) => ({
                  id: m.id,
                  role: m.role,
                  content: m.content,
                  sources: m.sources,
                  suggested_actions: m.suggested_actions?.map((a) => a.action) || [],
                  cards: (m as any).cards || [],
                  ai_meta: (m as any).ai_meta,
                  created_at: m.created_at,
                }))
              );
              return;
            }
          } catch {
            // fallback to default welcome message
          }
        }

        // Add welcome message if no messages
        setMessages([
          {
            id: "welcome-1",
            role: "assistant",
            content:
              "👋 **Welcome to TradeX Copilot!**\n\nI am your unified AI assistant for global B2B cross-border commerce, powered by our shared international trade sourcing engine and grounded in **15 verified trade knowledge guides**.\n\nI can assist you with:\n- **Product Sourcing & Catalogue Discovery** (e.g. wholesale laptops, Indian basmati rice, organic spices)\n- **Incoterms® 2020** cost and risk allocations (FOB vs CIF vs DAP)\n- **HS Code Classification & Tariffs** (e.g. Organic Turmeric `0910.30`)\n- **Statutory Import Documents** (US FDA FSMA, EU Organic TRACES NT, Phytosanitary, Bill of Lading)\n- **Landed Cost & Demurrage Risk Mitigation**\n\nWhat cross-border transaction or trade route can I assist you with today?",
            suggested_actions: [
              "i need rice",
              "i want laptop",
              "Compare FOB and CIF",
              "Check HS code for turmeric powder",
              "What documents for 500 kg rice from India to USA?",
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
      setLastTurnStatus({ rag_used: Boolean(res.rag_used), mode: res.mode });
      if (res.conversation_id) {
        setConversationId(res.conversation_id);
        localStorage.setItem("tradex_copilot_conv_id", res.conversation_id);
      }

      const botMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.response,
        sources: res.sources,
        suggested_actions: res.suggested_actions,
        cards: res.cards,
        created_at: new Date().toISOString(),
        ai_meta: res.ai_meta,
      };

      setMessages((prev) => [...prev, botMsg]);

      // Refresh conversations list if new conversation created or updated
      const updatedConvs = await copilotApi.listConversations().catch(() => []);
      setConversations(updatedConvs);
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
    localStorage.removeItem("tradex_copilot_conv_id");
    setLastTurnStatus({});
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: "Started a new trade inquiry. How can I assist you with catalogue sourcing, international trade regulations, landed costs, or compliance?",
        suggested_actions: [
          "i need rice",
          "i want laptop",
          "What are seller responsibilities under CIF Hamburg?",
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
      localStorage.setItem("tradex_copilot_conv_id", detail.id);
      setMessages(
        detail.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources,
          suggested_actions: m.suggested_actions?.map((a) => a.action) || [],
          cards: (m as any).cards || [],
          ai_meta: (m as any).ai_meta,
          created_at: m.created_at,
        }))
      );
    } catch {
      console.error("Failed to load conversation:", conv.id);
    } finally {
      setLoading(false);
    }
  };

  // Rename conversation
  const handleRenameSubmit = async (id: string) => {
    if (!editingTitle.trim()) {
      setEditingConvId(null);
      return;
    }
    try {
      const res = await copilotApi.renameConversation(id, editingTitle.trim());
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: res.title } : c))
      );
      setEditingConvId(null);
    } catch (err) {
      console.error("Failed to rename conversation:", err);
      setEditingConvId(null);
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await copilotApi.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setDeleteConfirmId(null);
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
    if (actLower === "show more" || actLower.includes("show more")) {
      handleSend("Show more matching products in catalogue");
    } else if (actLower.includes("draft rfq") || actLower.includes("create an rfq") || actLower.includes("prepare an rfq") || actLower.includes("prepare rfq")) {
      navigate("/rfqs");
    } else if (actLower.includes("landed cost") || actLower.includes("freight")) {
      navigate("/rfqs");
    } else if (actLower.includes("document") && !actLower.includes("explain")) {
      navigate("/documents");
    } else if (actLower.includes("finance") || actLower.includes("escrow")) {
      navigate("/trade-finance");
    } else if (actLower.includes("browse catalogue") || actLower.includes("browse electronics") || actLower.includes("search wholesale")) {
      navigate("/products");
    } else if (actLower.includes("suppliers") && !actLower.includes("compare") && !actLower.includes("prices")) {
      navigate("/suppliers");
    } else {
      handleSend(action);
    }
  };

  // Filter conversations with deduplication
  const filteredConversations = React.useMemo(() => {
    const seenTitles = new Set<string>();
    return conversations.filter((c) => {
      if (historySearch) {
        const matches = c.title.toLowerCase().includes(historySearch.toLowerCase());
        if (!matches) return false;
      }
      const norm = c.title.trim().toLowerCase();
      if (seenTitles.has(norm)) {
        return false;
      }
      seenTitles.add(norm);
      return true;
    });
  }, [conversations, historySearch]);

  // Active suggestions: use actions from last assistant message, fallback to default prompts
  const activeSuggestions = React.useMemo(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.suggested_actions && m.suggested_actions.length > 0);
    if (lastAssistant && lastAssistant.suggested_actions) {
      return lastAssistant.suggested_actions;
    }
    return suggestedPrompts.map((p) => p.prompt);
  }, [messages, suggestedPrompts]);

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100">
      {/* Left Sidebar: Knowledge Guides & History */}
      <div className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col hidden lg:flex flex-shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">Trade Knowledge Base</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">15 Grounded Guides</p>
            </div>
          </div>
          <button
            onClick={handleNewChat}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md transition-colors"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 pt-2 gap-4 text-xs font-semibold">
          <button
            onClick={() => setSidebarTab("guides")}
            className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
              sidebarTab === "guides"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Guides ({guides.length})
          </button>
          <button
            onClick={() => setSidebarTab("history")}
            className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
              sidebarTab === "history"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            History ({filteredConversations.length})
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
                className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded">
                    {g.category}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1.5 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {g.title}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {g.topics.slice(0, 3).map((t) => (
                    <span key={t} className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-2">
              {/* History Search Box */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search past trade chats..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {filteredConversations.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No matching conversations.</div>
              ) : (
                filteredConversations.map((c) => {
                  const isActive = conversationId === c.id;
                  const isEditing = editingConvId === c.id;

                  if (isEditing) {
                    return (
                      <div key={c.id} className="p-1.5 flex items-center gap-1">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameSubmit(c.id);
                            if (e.key === "Escape") setEditingConvId(null);
                          }}
                          autoFocus
                          className="flex-1 text-xs px-2 py-1 bg-white dark:bg-slate-800 border border-indigo-500 rounded focus:outline-none text-slate-900 dark:text-slate-100"
                        />
                        <button
                          onClick={() => handleRenameSubmit(c.id)}
                          className="p-1 text-emerald-600 hover:text-emerald-700"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingConvId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectConversation(c)}
                      className={`group p-2.5 rounded-xl flex items-center justify-between cursor-pointer text-left transition-colors ${
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 font-medium"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <MessageSquare className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <p className="text-xs truncate">{c.title}</p>
                      </div>

                      {/* Rename and Delete Actions */}
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingConvId(c.id);
                            setEditingTitle(c.title);
                          }}
                          className="p-1 hover:text-indigo-600 text-slate-400"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(c.id);
                          }}
                          className="p-1 hover:text-rose-600 text-slate-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
        {/* Top Chat Bar */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                AI Trade Copilot
                {/* Prompt 38 Honest Header: RAG Active only when RAG was actually used */}
                {lastTurnStatus.rag_used ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    RAG Active
                  </span>
                ) : lastTurnStatus.mode === "catalogue_search" ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 px-2 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3 text-sky-600" />
                    Catalogue Search
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full">
                    <Bot className="w-3 h-3 text-indigo-600" />
                    Trade AI
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Unified cross-border sourcing engine & verified trade compliance intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors"
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
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none space-y-3"
                  }`}
                >
                  {/* Message Body rendered via ReactMarkdown without raw markdown asterisks */}
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words text-sm leading-relaxed">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>

                  {/* Product Cards Grid for Catalogue Listings */}
                  {m.cards && m.cards.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-indigo-600" />
                          Matching Catalogue Products ({m.cards.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {m.cards.map((p) => {
                          const placeholderImg = getCategoryPlaceholder(p.category_name, p.title);
                          const displayImg = p.image || placeholderImg;
                          return (
                            <div
                              key={p.product_id}
                              className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 flex flex-col justify-between hover:border-indigo-400 transition-colors"
                            >
                              <div className="space-y-2">
                                <div className="h-28 w-full rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900">
                                  <img
                                    src={displayImg}
                                    alt={p.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = placeholderImg;
                                    }}
                                  />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                                    {p.title}
                                  </h4>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {p.supplier_name} • {p.origin_country || "Global"}
                                  </p>
                                </div>
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                  {p.unit_price > 0 ? (
                                    <span>
                                      {p.currency} {p.unit_price.toFixed(2)}
                                      <span className="text-[10px] text-slate-500 font-normal"> / {p.unit || "unit"}</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">Contact supplier for pricing</span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                  <span>MOQ: {p.moq ? p.moq.toLocaleString() : "1"}</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    {p.availability_status || "In Stock"}
                                  </span>
                                </div>
                              </div>

                              <div className="pt-2.5 mt-2 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between gap-1 text-[11px]">
                                <button
                                  onClick={() => navigate(`/products/${p.product_id}`)}
                                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                                >
                                  View Product
                                </button>
                                <button
                                  onClick={() => navigate("/rfqs")}
                                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition-colors"
                                >
                                  Request Quote
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Grounded Source Citations */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                        Verified Trade Sources Cited:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.sources.map((src, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(`Tell me more about ${src.title}`)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium bg-indigo-50/80 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 px-2 py-0.5 rounded-md transition-colors"
                          >
                            <span>{src.title}</span>
                            {src.relevance_score && (
                              <span className="text-[9px] opacity-75 font-mono">
                                ({Math.round(src.relevance_score * 100)}%)
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Metadata Footer */}
                  {m.role === "assistant" && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
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
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Searching real catalogue & synthesizing verified trade guidance...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom Input & Suggestions Area */}
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* Prompt 38 Suggestions Bar: Wraps cleanly without horizontal page scrollbars */}
            <div className="flex flex-wrap items-center gap-1.5 py-1 max-h-24 overflow-y-auto">
              <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap mr-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Suggested:
              </span>
              {activeSuggestions.map((act, idx) => (
                <button
                  key={idx}
                  onClick={() => handleActionClick(act)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1"
                >
                  <span>{act}</span>
                  <ArrowRight className="w-2.5 h-2.5 opacity-60" />
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
                placeholder="Ask Copilot: 'i need rice', 'i want laptop', or ask about Incoterms, HS codes, FDA..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={loading}
                className="flex-1 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all placeholder:text-slate-400"
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete Conversation?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to delete this Copilot inquiry? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConversation(deleteConfirmId)}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
