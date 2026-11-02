import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCurrency } from "../features/settings/SettingsContext";
import {
  Sparkles,
  Plus,
  Send,
  MessageSquare,
  Scale,
  Check,
  AlertTriangle,
  CheckCircle2,
  X,
  Trash2,
  Edit2,
  ArrowRight,
  ShieldCheck,
  Globe,
  DollarSign,
  Loader2,
  Menu,
  Clock,
  Package,
  Store,
  Search,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  aiModeApi,
  ConversationItem,
  AIMessageData,
  ProductCardData,
  NegotiationDraftData,
  AiStatusResponse,
} from "../lib/api/aiMode";
import { useAuth } from "../features/auth";

export const AiModePage: React.FC = () => {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeParamId = searchParams.get("id");

  // State
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(activeParamId);
  const [messages, setMessages] = useState<AIMessageData[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductCardData[]>([]);
  const [inputContent, setInputContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatusResponse | null>(null);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar toggle
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);

  // Compare Modal
  const [compareOpen, setCompareOpen] = useState(false);
  const [comparisonData, setComparisonData] = useState<any | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Chat Now feedback
  const [chatFeedback, setChatFeedback] = useState<{ productId: string; status: "loading" | "success" | "error"; msg?: string } | null>(null);

  // AI Negotiate Drawer
  const [negotiateProduct, setNegotiateProduct] = useState<ProductCardData | null>(null);
  const [targetPrice, setTargetPrice] = useState<number | "">("");
  const [targetQty, setTargetQty] = useState<number | "">("");
  const [negotiateNotes, setNegotiateNotes] = useState("");
  const [negotiateDraft, setNegotiateDraft] = useState<NegotiationDraftData | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [negotiateSuccess, setNegotiateSuccess] = useState(false);

  const [historySearch, setHistorySearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // 1. Initial Load: list conversations
  useEffect(() => {
    loadConversations();
    aiModeApi
      .getAiStatus()
      .then(setAiStatus)
      .catch(() =>
        setAiStatus({
          provider: "mock",
          model: "rule-engine",
          reachable: true,
          last_latency: 0,
          mode: "demo",
          configured_providers: [],
          priority: [],
        })
      );
  }, []);

  const loadConversations = async () => {
    try {
      setIsInitializing(true);
      const list = await aiModeApi.listConversations();
      setConversations(list);

      if (activeParamId) {
        loadConversationDetail(activeParamId);
      } else if (list.length > 0) {
        setActiveConvId(list[0].id);
        setSearchParams({ id: list[0].id }, { replace: true });
        loadConversationDetail(list[0].id);
      } else {
        // Create initial default conversation
        const initial = await aiModeApi.createConversation("Trade Sourcing Session");
        setConversations([initial]);
        setActiveConvId(initial.id);
        setSearchParams({ id: initial.id }, { replace: true });
        loadConversationDetail(initial.id);
      }
    } catch (err: any) {
      console.error("Failed to load conversations", err);
      setErrorMsg(err.message || "Failed to initialize AI Mode.");
    } finally {
      setIsInitializing(false);
    }
  };

  const loadConversationDetail = async (id: string) => {
    try {
      setErrorMsg(null);
      const detail = await aiModeApi.getConversation(id);
      setActiveConvId(detail.id);
      setMessages(detail.messages || []);
      setSelectedProducts(detail.selected_products || []);
    } catch (err: any) {
      console.error("Failed to fetch conversation detail", err);
      setErrorMsg(err.message || "Could not retrieve conversation.");
    }
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Handle Switch Conversation
  const handleSelectConversation = (id: string) => {
    if (id === activeConvId) return;
    setActiveConvId(id);
    setSearchParams({ id });
    loadConversationDetail(id);
    setSidebarOpen(false);
  };

  // New Chat
  const handleNewChat = async () => {
    try {
      const newConv = await aiModeApi.createConversation("New Trade Session");
      setConversations([newConv, ...conversations]);
      setActiveConvId(newConv.id);
      setSearchParams({ id: newConv.id });
      setMessages([]);
      setSelectedProducts([]);
      setSidebarOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create conversation.");
    }
  };

  // Inline Rename
  const handleRenameSubmit = async (id: string) => {
    if (!editingTitle.trim()) {
      setEditingConvId(null);
      return;
    }
    try {
      const updated = await aiModeApi.renameConversation(id, editingTitle.trim());
      setConversations(conversations.map((c) => (c.id === id ? { ...c, title: updated.title } : c)));
      setEditingConvId(null);
    } catch (err: any) {
      alert(err.message || "Could not rename conversation.");
    }
  };

  // Delete Conversation
  const handleDeleteConfirm = async (id: string) => {
    try {
      await aiModeApi.deleteConversation(id);
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      setDeletingConvId(null);
      if (activeConvId === id) {
        if (remaining.length > 0) {
          handleSelectConversation(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (err: any) {
      alert(err.message || "Could not delete conversation.");
    }
  };

  // Send Message
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputContent.trim();
    if (!textToSend || isLoading) return;
    if (!activeConvId) {
      await handleNewChat();
    }
    const convId = activeConvId!;

    // Optimistic user message
    const tempUserMsg: AIMessageData = {
      id: "temp-" + Date.now(),
      conversation_id: convId,
      role: "user",
      content: textToSend,
      provider: "user",
      is_demo: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setInputContent("");
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const result = await aiModeApi.sendMessage(convId, textToSend);
      // Replace with real saved messages
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        result.user_message,
        {
          ...result.assistant_reply,
          structured: {
            ...result.assistant_reply.structured,
            product_cards: result.product_cards,
            active_filters: result.active_filters,
            suggested_chips: result.suggested_chips,
            has_more: result.has_more,
            total_cards: result.total_cards,
          },
        },
      ]);
      // Update title in list if this was first message
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId && c.title === "New Trade Session"
            ? { ...c, title: textToSend.slice(0, 32) + (textToSend.length > 32 ? "..." : "") }
            : c
        )
      );
    } catch (err: any) {
      console.error("Message send error", err);
      setErrorMsg(err.message || "Failed to reach AI Mode assistant. Please retry.");
    } finally {
      setIsLoading(false);
    }
  };

  // Selection toggle
  const handleToggleSelectProduct = async (product: ProductCardData) => {
    if (!activeConvId) return;
    const isAlreadySelected = selectedProducts.some((p) => p.product_id === product.product_id);
    try {
      if (isAlreadySelected) {
        await aiModeApi.unselectProduct(activeConvId, product.product_id);
        setSelectedProducts((prev) => prev.filter((p) => p.product_id !== product.product_id));
      } else {
        await aiModeApi.selectProduct(activeConvId, product.product_id);
        setSelectedProducts((prev) => [...prev, product]);
      }
    } catch (err: any) {
      console.error("Selection error", err);
    }
  };

  // Open Compare Modal
  const handleOpenCompare = async () => {
    if (!activeConvId || selectedProducts.length < 2) return;
    setCompareLoading(true);
    setCompareOpen(true);
    try {
      const data = await aiModeApi.compareProducts(activeConvId);
      setComparisonData(data);
    } catch (err: any) {
      console.error("Compare error", err);
    } finally {
      setCompareLoading(false);
    }
  };

  // Chat Now action
  const handleChatNow = async (product: ProductCardData) => {
    if (!activeConvId) return;
    setChatFeedback({ productId: product.product_id, status: "loading" });
    try {
      const res = await aiModeApi.chatNow(activeConvId, product.product_id);
      setChatFeedback({
        productId: product.product_id,
        status: "success",
        msg: `Thread #${res.thread_id.slice(0, 8)} opened!`,
      });
      setTimeout(() => {
        navigate(`/messages?thread=${res.thread_id}`);
      }, 900);
    } catch (err: any) {
      setChatFeedback({
        productId: product.product_id,
        status: "error",
        msg: err.message || "Could not connect chat thread.",
      });
      setTimeout(() => setChatFeedback(null), 4000);
    }
  };

  // Open AI Negotiate Drawer
  const handleOpenNegotiate = (product: ProductCardData) => {
    setNegotiateProduct(product);
    setTargetPrice(Math.round(product.unit_price * 0.9 * 100) / 100 || 10);
    setTargetQty(product.moq || 100);
    setNegotiateNotes("");
    setNegotiateDraft(null);
    setNegotiateSuccess(false);
  };

  // Generate Negotiation Draft
  const handleGenerateDraft = async () => {
    if (!activeConvId || !negotiateProduct || !targetPrice || !targetQty) return;
    setDraftLoading(true);
    try {
      const draft = await aiModeApi.createNegotiationDraft(activeConvId, negotiateProduct.product_id, {
        target_price: Number(targetPrice),
        quantity: Number(targetQty),
        notes: negotiateNotes,
      });
      setNegotiateDraft(draft);
    } catch (err: any) {
      alert(err.message || "Failed to generate negotiation draft.");
    } finally {
      setDraftLoading(false);
    }
  };

  // Send Negotiation to Supplier
  const handleConfirmSendNegotiation = async () => {
    if (!negotiateDraft) return;
    setSendLoading(true);
    try {
      const updated = await aiModeApi.sendNegotiationDraft(negotiateDraft.id, {
        confirm: true,
        final_message: negotiateDraft.ai_suggested_message,
      });
      setNegotiateDraft(updated);
      setConfirmSendOpen(false);
      setNegotiateSuccess(true);

      // Append system message in chat thread
      const sentNotice: AIMessageData = {
        id: "sys-" + Date.now(),
        conversation_id: activeConvId!,
        role: "assistant",
        content: `🤝 Commercial negotiation draft submitted to ${negotiateProduct?.supplier_name} for '${negotiateProduct?.title}' at ${negotiateProduct?.currency} ${Number(targetPrice).toFixed(2)}/unit. Linked Thread ID: ${updated.linked_thread_id || "Active"}.`,
        provider: "negotiation_engine",
        is_demo: false,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, sentNotice]);

      setTimeout(() => {
        setNegotiateProduct(null);
      }, 1500);
    } catch (err: any) {
      alert(err.message || "Could not dispatch negotiation offer.");
    } finally {
      setSendLoading(false);
    }
  };

  // Group conversations by Today, Yesterday, Earlier (Prompt 37)
  const groupConversations = () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const groups: { today: ConversationItem[]; yesterday: ConversationItem[]; earlier: ConversationItem[] } = {
      today: [],
      yesterday: [],
      earlier: [],
    };

    const filtered = historySearch.trim()
      ? conversations.filter((c) =>
          c.title.toLowerCase().includes(historySearch.trim().toLowerCase())
        )
      : conversations;

    filtered.forEach((conv) => {
      const cDate = new Date(conv.updated_at || conv.created_at);
      if (cDate.toDateString() === today.toDateString()) {
        groups.today.push(conv);
      } else if (cDate.toDateString() === yesterday.toDateString()) {
        groups.yesterday.push(conv);
      } else {
        groups.earlier.push(conv);
      }
    });

    return groups;
  };

  const grouped = groupConversations();

  if (user?.role && user.role.toUpperCase() === "SUPPLIER") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#FAFAFA] px-4 text-center">
        <div className="max-w-md w-full p-8 bg-white border border-slate-200 rounded-3xl shadow-lg space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Store className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">AI Mode is a Buyer Feature</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            AI Mode is built for enterprise buyers to discover verified suppliers, check live stock, and conduct negotiations.
          </p>
          <p className="text-xs text-slate-500">
            As a TradeX Supplier, you can manage your catalogue, view incoming RFQs, and fulfill orders directly in the Supplier Portal.
          </p>
          <div className="pt-2">
            <Link
              to="/supplier-portal"
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-xl transition shadow-xs"
            >
              Go to Supplier Portal
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#FAFAFA] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden">
      {/* ============================================================ */}
      {/* 1. LEFT SIDEBAR (Collapsible, Light, Clean)                  */}
      {/* ============================================================ */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Brand & New Chat */}
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Link to="/ai-mode" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 tracking-tight text-sm">TradeX AI Mode</span>
                <span className="block text-[10px] text-amber-600 font-semibold uppercase tracking-wider">
                  Global Sourcing
                </span>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-slate-600 rounded"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-orange-50 hover:text-orange-600 border border-slate-200 hover:border-orange-200 text-slate-700 text-xs font-semibold rounded-xl transition-all shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          {/* History Search Input (Prompt 37) */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search chat history..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 transition-colors"
            />
          </div>
        </div>

        {/* History Grouped List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {conversations.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Sparkles className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs text-slate-400 font-medium">No previous chats</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Start your first AI search query</p>
            </div>
          ) : (
            <>
              {grouped.today.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                    Today
                  </h4>
                  <div className="space-y-0.5">
                    {grouped.today.map((c) => renderConvRow(c))}
                  </div>
                </div>
              )}

              {grouped.yesterday.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                    Yesterday
                  </h4>
                  <div className="space-y-0.5">
                    {grouped.yesterday.map((c) => renderConvRow(c))}
                  </div>
                </div>
              )}

              {grouped.earlier.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                    Earlier
                  </h4>
                  <div className="space-y-0.5">
                    {grouped.earlier.map((c) => renderConvRow(c))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <div className="flex items-center gap-2 truncate">
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase">
              {user?.email?.charAt(0) || "B"}
            </div>
            <span className="truncate font-medium">{user?.email || "Trader"}</span>
          </div>
          <Link to="/" className="text-slate-400 hover:text-slate-700" title="Back to App">
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/30 z-30 lg:hidden backdrop-blur-2xs"
        />
      )}

      {/* ============================================================ */}
      {/* 2. MAIN CENTER AREA (Header + Thread + Composer)             */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* TOP NAVIGATION BAR */}
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Open chat history"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Top Navigation Links Matching TradeX Reference Layout */}
            <nav className="flex items-center gap-1 sm:gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 border border-orange-200 text-orange-600 font-bold text-xs rounded-full shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                AI Mode
              </span>

              <Link
                to="/products"
                className="hidden sm:inline-flex px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Products
              </Link>
              <Link
                to="/suppliers"
                className="hidden sm:inline-flex px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Suppliers
              </Link>
              <Link
                to="/search"
                className="hidden md:inline-flex px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Worldwide sourcing
              </Link>
            </nav>
          </div>

          {/* Region, Currency & Deliver to selector stubs */}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            {/* Live AI / Demo AI Status Indicator (Prompt 21 & Prompt 30) */}
            {aiStatus && (() => {
              const badge = aiStatus.status_badge || (aiStatus.mode === "live" ? "Connected" : "Demo AI");
              if (badge === "Connected") {
                return (
                  <div
                    data-testid="ai-status-live"
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold shadow-xs"
                    title={`Live inference probe succeeded: ${aiStatus.provider} (${aiStatus.model}) | Latency: ${aiStatus.last_latency}ms`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    <span>Live AI: {aiStatus.model}</span>
                  </div>
                );
              }
              if (badge === "Rate limited") {
                return (
                  <div
                    data-testid="ai-status-rate-limited"
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-full font-semibold shadow-xs"
                    title={`Rate limited: ${aiStatus.fallback_reason || "HTTP 429"}`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                    <span>Rate limited</span>
                  </div>
                );
              }
              if (badge === "Disconnected") {
                return (
                  <div
                    data-testid="ai-status-disconnected"
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-semibold shadow-xs"
                    title={`Disconnected: ${aiStatus.fallback_reason || "Offline"}`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Disconnected</span>
                  </div>
                );
              }
              return (
                <div
                  data-testid="ai-status-demo"
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-semibold shadow-xs"
                  title={aiStatus.fallback_reason || "Deterministic trade rule engine"}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Demo AI</span>
                </div>
              );
            })()}
            <div className="hidden lg:flex items-center gap-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-md font-medium">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>Deliver to: USA</span>
            </div>
            <div className="hidden md:flex items-center gap-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-md font-medium">
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
              <span>{currency}</span>
            </div>
            <Link
              to="/messages"
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              title="Messaging"
            >
              <MessageSquare className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* CONVERSATION THREAD */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 max-w-5xl w-full mx-auto pb-44">
          {/* Global error banner */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                onClick={() => setErrorMsg(null)}
                className="text-red-500 hover:text-red-800 font-bold ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Initial loading state */}
          {isInitializing && messages.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-xs font-medium">Initializing AI Mode workspace...</p>
            </div>
          )}

          {/* Empty Conversation / Greeting Area */}
          {!isInitializing && messages.length === 0 && (
            <div className="my-8 text-center max-w-2xl mx-auto animate-fadeIn">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-linear-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md mb-4">
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
                Hi! I'm your AI Mode sourcing expert.
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-lg mx-auto mb-6">
                I can help you source verified products, evaluate suppliers, compare volume tier quotes,
                prepare official inquiries, and think through landed cost, delivery, and compliance.
              </p>

              {/* Clickable prompt chips */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {[
                  "Find affordable laptops for the USA",
                  "Only show suppliers from China",
                  "Certified Alleppey Green Cardamom 8mm",
                  "Compare organic black pepper suppliers",
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleSendMessage(chip)}
                    className="py-1.5 px-3.5 bg-white hover:bg-orange-50 hover:text-orange-600 border border-slate-200 hover:border-orange-300 rounded-full text-xs text-slate-700 font-medium shadow-2xs transition-all hover:scale-[1.02]"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Trajectory */}
          <div className="space-y-6">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                {/* User Message Bubble */}
                {m.role === "user" && (
                  <div className="max-w-xl bg-orange-500 text-white px-4 py-2.5 rounded-2xl rounded-tr-xs shadow-xs text-xs sm:text-sm leading-relaxed">
                    {m.content}
                  </div>
                )}

                {/* Assistant Message */}
                {m.role === "assistant" && (
                  <div className="w-full space-y-3">
                    {/* Assistant Header Avatar */}
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-orange-500 flex items-center justify-center text-white text-xs shadow-xs">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">TradeX AI</span>
                      {m.is_demo && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-semibold rounded">
                          Demo AI
                        </span>
                      )}
                    </div>

                    {/* AI Reply Text: Rendered with Markdown so **bold** and *bullets* render cleanly (Prompt 37) */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs max-w-3xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                      <div className="prose prose-sm dark:prose-invert max-w-none break-words text-xs sm:text-sm">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>

                      {/* No-Match Action Buttons (Prompt 37: Refine Search, Browse Categories, Create RFQ) */}
                      {(!m.structured?.product_cards || m.structured.product_cards.length === 0) &&
                        (m.content.toLowerCase().includes("not find") ||
                          m.content.toLowerCase().includes("no matching") ||
                          m.structured?.classification === "not_found") && (
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => textareaRef.current?.focus()}
                              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                              <span>Refine Search</span>
                            </button>
                            <Link to="/marketplace">
                              <button
                                type="button"
                                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                              >
                                <Package className="w-3.5 h-3.5 text-slate-500" />
                                <span>Browse Categories</span>
                              </button>
                            </Link>
                            <Link to={`/rfq?product=${encodeURIComponent(messages.filter(msg => msg.role === "user").slice(-1)[0]?.content || "")}`}>
                              <button
                                type="button"
                                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Create RFQ</span>
                              </button>
                            </Link>
                          </div>
                        )}

                      {/* AI Reply Footer: provider, model, latency, fallback reason (Prompt 30 & 37) */}
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                        <span data-testid="ai-reply-footer">
                          {m.is_demo
                            ? `Demo AI (reason: ${m.fallback_reason || (m.structured as any)?.ai_meta?.fallback_reason || "Deterministic catalogue engine"})`
                            : `Live AI: ${m.model || (m.structured as any)?.ai_meta?.model || aiStatus?.model || "llama-3.3-70b-versatile"}, ${((m.latency_ms || (m.structured as any)?.ai_meta?.latency_ms || aiStatus?.last_latency || 1200) / 1000).toFixed(1)} s`}
                        </span>
                        <span className="text-[10px] font-mono uppercase text-slate-400">
                          {m.provider || (m.structured as any)?.ai_meta?.provider || (m.is_demo ? "demo" : "groq")}
                        </span>
                      </div>
                    </div>

                    {/* Active Filters as Chips in Thread */}
                    {m.structured?.active_filters && m.structured.active_filters.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 mr-1">Active Filters:</span>
                        {m.structured.active_filters.map((f: { label: string; value: string }, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-orange-50 text-orange-800 border border-orange-200 rounded-md text-[11px] font-medium"
                          >
                            {f.label}: <strong className="font-semibold">{f.value}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Clarifying question box if present */}
                    {m.structured?.clarifying_question && (
                      <div className="p-3 bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs rounded-xl flex items-start gap-2 max-w-3xl">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block mb-0.5">Sourcing Clarification</span>
                          <span>{m.structured.clarifying_question}</span>
                        </div>
                      </div>
                    )}

                    {/* Product Cards Grid */}
                    {m.structured?.product_cards && m.structured.product_cards.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                        {m.structured.product_cards.map((card: ProductCardData) => (
                          <ProductCard
                            key={card.product_id}
                            card={card}
                            isSelected={selectedProducts.some((p) => p.product_id === card.product_id)}
                            onToggleSelect={() => handleToggleSelectProduct(card)}
                            onChatNow={() => handleChatNow(card)}
                            onNegotiate={() => handleOpenNegotiate(card)}
                            chatFeedback={chatFeedback?.productId === card.product_id ? chatFeedback : null}
                          />
                        ))}
                      </div>
                    )}

                    {/* Suggested follow-up prompt chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {((m.structured?.suggested_chips && m.structured.suggested_chips.length > 0)
                        ? m.structured.suggested_chips
                        : ["Only show suppliers from China", "Compare the first two", "What is the MOQ?", "Negotiate bulk rate"]
                      ).map((prompt: string) => (
                        <button
                          key={prompt}
                          onClick={() => handleSendMessage(prompt)}
                          className="px-2.5 py-1 bg-white hover:bg-orange-50 hover:text-orange-600 border border-slate-200 text-slate-600 rounded-lg text-[11px] font-medium transition-all"
                        >
                          + {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs pl-2">
                <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* ============================================================ */}
        {/* 3. SELECTION STICKY TRAY (Appears when >= 1 item selected)   */}
        {/* ============================================================ */}
        {selectedProducts.length > 0 && (
          <div className="fixed bottom-24 left-0 right-0 z-20 flex justify-center px-4 pointer-events-none">
            <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-300 shadow-xl rounded-2xl py-2 px-4 flex items-center gap-4 max-w-2xl w-full animate-slideUp">
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                <span className="text-xs font-bold text-slate-700 shrink-0">
                  Selected ({selectedProducts.length}):
                </span>
                {selectedProducts.map((p) => (
                  <div
                    key={p.product_id}
                    className="relative group shrink-0 w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden"
                    title={p.title}
                  >
                    {p.image ? (
                      <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-4 h-4 text-slate-400" />
                    )}
                    <button
                      onClick={() => handleToggleSelectProduct(p)}
                      className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 ml-auto shrink-0">
                <button
                  onClick={() => setSelectedProducts([])}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1"
                >
                  Clear
                </button>
                <button
                  disabled={selectedProducts.length < 2 || selectedProducts.length > 4}
                  onClick={handleOpenCompare}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all ${
                    selectedProducts.length >= 2 && selectedProducts.length <= 4
                      ? "bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Compare ({selectedProducts.length})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 4. PINNED BOTTOM COMPOSER                                   */}
        {/* ============================================================ */}
        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-[#FAFAFA] via-[#FAFAFA] to-transparent dark:from-slate-950 dark:via-slate-950 pt-6 pb-4 px-4 md:px-8 z-10">
          <div className="max-w-3xl mx-auto">
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100 dark:focus-within:ring-orange-900/30 shadow-md transition-all">
              <textarea
                ref={textareaRef}
                value={inputContent}
                onChange={(e) => setInputContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
                placeholder="Describe your trade sourcing needs... (e.g. 'Find affordable laptops for USA')"
                rows={2}
                className="w-full pl-4 pr-14 py-3 bg-transparent text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 resize-none focus:outline-none"
              />
              <button
                disabled={isLoading || !inputContent.trim()}
                onClick={() => handleSendMessage()}
                className={`absolute right-3 bottom-2.5 p-2 rounded-xl transition-all ${
                  inputContent.trim() && !isLoading
                    ? "bg-orange-500 hover:bg-orange-600 text-white cursor-pointer shadow-xs"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
                aria-label="Send message"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-center text-slate-400 mt-1.5">
              Press <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200">Enter</kbd> to send, <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200">Shift+Enter</kbd> for newline
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 5. SIDE-BY-SIDE COMPARE MODAL                                */}
      {/* ============================================================ */}
      {compareOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-slate-900 text-sm">Product Specifications & Quote Comparison</h3>
              </div>
              <button
                onClick={() => setCompareOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {compareLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-orange-500 mb-2" />
                  <p className="text-xs">Computing side-by-side matrices...</p>
                </div>
              ) : comparisonData?.comparison_table ? (
                <div className="space-y-4">
                  {comparisonData.recommendation && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{comparisonData.recommendation}</span>
                    </div>
                  )}

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="p-3">Attribute</th>
                          {comparisonData.comparison_table.map((row: any) => (
                            <th key={row.product_id} className="p-3 min-w-[160px]">
                              {row.title}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="p-3 font-semibold text-slate-500 bg-slate-50/50">Unit Price</td>
                          {comparisonData.comparison_table.map((row: any) => (
                            <td key={row.product_id} className="p-3 font-bold text-slate-900">
                              {row.currency} {Number(row.unit_price).toFixed(2)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-500 bg-slate-50/50">MOQ</td>
                          {comparisonData.comparison_table.map((row: any) => (
                            <td key={row.product_id} className="p-3">
                              {row.moq} units
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-500 bg-slate-50/50">Supplier</td>
                          {comparisonData.comparison_table.map((row: any) => (
                            <td key={row.product_id} className="p-3">
                              <span className="font-medium text-slate-800">{row.supplier_name}</span>
                              {row.supplier_verification && (
                                <span className="ml-1 text-[10px] text-emerald-600 font-bold">✓ Verified</span>
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-500 bg-slate-50/50">Origin</td>
                          {comparisonData.comparison_table.map((row: any) => (
                            <td key={row.product_id} className="p-3">
                              {row.origin_country}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-500 bg-slate-50/50">Lead Time</td>
                          {comparisonData.comparison_table.map((row: any) => (
                            <td key={row.product_id} className="p-3">
                              {row.lead_time ? `${row.lead_time} days` : "Standard"}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-500 bg-slate-50/50">Certifications</td>
                          {comparisonData.comparison_table.map((row: any) => (
                            <td key={row.product_id} className="p-3">
                              {row.certifications?.length > 0 ? row.certifications.join(", ") : "Standard ISO"}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. AI NEGOTIATION RIGHT DRAWER                              */}
      {/* ============================================================ */}
      {negotiateProduct && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-slideLeft">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <h3 className="font-bold text-slate-900 text-sm">AI Commercial Negotiation</h3>
            </div>
            <button
              onClick={() => setNegotiateProduct(null)}
              aria-label="Close negotiation"
              className="p-1 rounded-lg hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Original Supplier Terms */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                Original Supplier Terms
              </h4>
              <p className="font-semibold text-slate-900 truncate">{negotiateProduct.title}</p>
              <div className="grid grid-cols-2 gap-2 pt-1 text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px]">Listed Unit Price</span>
                  <span className="font-bold text-slate-800">
                    {negotiateProduct.currency} {negotiateProduct.unit_price.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Minimum Order</span>
                  <span className="font-bold text-slate-800">{negotiateProduct.moq} units</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Supplier</span>
                  <span className="font-medium text-slate-800 truncate block">
                    {negotiateProduct.supplier_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Origin</span>
                  <span className="font-medium text-slate-800">{negotiateProduct.origin_country}</span>
                </div>
              </div>
            </div>

            {/* Target Price & Quantity Inputs */}
            <div className="space-y-3 bg-white p-3.5 border border-slate-200 rounded-xl">
              <h4 className="font-bold text-slate-700 text-xs">Buyer Target Terms</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Target Price ({negotiateProduct.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                    placeholder="25.00"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Target Volume (Units)
                  </label>
                  <input
                    type="number"
                    value={targetQty}
                    onChange={(e) => setTargetQty(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                    placeholder="1000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Commercial Notes / Payment Terms
                </label>
                <input
                  type="text"
                  value={negotiateNotes}
                  onChange={(e) => setNegotiateNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  placeholder="e.g. 100% LC at sight, urgent delivery"
                />
              </div>

              <button
                disabled={draftLoading || !targetPrice || !targetQty}
                onClick={handleGenerateDraft}
                className="w-full py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold rounded-lg border border-orange-200 transition-colors flex items-center justify-center gap-1.5"
              >
                {draftLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Generate AI Negotiation Pitch</span>
              </button>
            </div>

            {/* Generated Draft Pitch Box */}
            {negotiateDraft && (
              <div className="space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-xs">Proposed Counter-Offer Pitch</span>
                  <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                    AI suggestion, not a supplier quote
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={negotiateDraft.ai_suggested_message}
                  onChange={(e) =>
                    setNegotiateDraft({ ...negotiateDraft, ai_suggested_message: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed focus:ring-1 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            )}

            {/* Success banner */}
            {negotiateSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Negotiation sent to supplier thread successfully!</span>
              </div>
            )}
          </div>

          {/* Footer Submit */}
          {negotiateDraft && !negotiateSuccess && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setConfirmSendOpen(true)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition-colors"
              >
                Send to Supplier
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog before sending negotiation */}
      {confirmSendOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center animate-scaleUp">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm mb-1.5">Confirm Negotiation Offer</h4>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              This will officially send your counter-offer message to{" "}
              <strong>{negotiateProduct?.supplier_name}</strong> through the messaging system. The AI
              will not accept or commit any order on your behalf.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmSendOpen(false)}
                className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={sendLoading}
                onClick={handleConfirmSendNegotiation}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5"
              >
                {sendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingConvId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center animate-scaleUp">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm mb-1.5">Delete Conversation</h4>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Are you sure you want to delete this chat history? This cannot be undone.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDeletingConvId(null)}
                className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConfirm(deletingConvId)}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper row renderer for sidebar history
  function renderConvRow(conv: ConversationItem) {
    const isActive = conv.id === activeConvId;
    const isEditing = editingConvId === conv.id;

    if (isEditing) {
      return (
        <div key={conv.id} className="p-1.5">
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={() => handleRenameSubmit(conv.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit(conv.id);
              if (e.key === "Escape") setEditingConvId(null);
            }}
            autoFocus
            className="w-full text-xs px-2 py-1 border border-orange-400 rounded-lg focus:outline-none"
          />
        </div>
      );
    }

    return (
      <div
        key={conv.id}
        onClick={() => handleSelectConversation(conv.id)}
        className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs transition-colors ${
          isActive
            ? "bg-orange-50/80 text-orange-950 font-semibold"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <span className="truncate flex-1 pr-2">{conv.title}</span>

        {/* Hover action buttons: Rename & Delete */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingConvId(conv.id);
              setEditingTitle(conv.title);
            }}
            className="p-1 text-slate-400 hover:text-slate-700 rounded"
            title="Rename"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeletingConvId(conv.id);
            }}
            className="p-1 text-slate-400 hover:text-red-600 rounded"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }
};

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
    text.includes("rice") ||
    text.includes("grain") ||
    text.includes("tea")
  ) {
    return "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80";
  }
  if (text.includes("book") || text.includes("stationery") || text.includes("paper")) {
    return "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80";
  }
  if (
    text.includes("tractor") ||
    text.includes("machin") ||
    text.includes("tool") ||
    text.includes("industrial")
  ) {
    return "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80";
  }
  return "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80";
};

/* ============================================================ */
/* SUB-COMPONENT: ProductCard (Matching Reference Layout)        */
/* ============================================================ */
interface ProductCardProps {
  card: ProductCardData;
  isSelected: boolean;
  onToggleSelect: () => void;
  onChatNow: () => void;
  onNegotiate: () => void;
  chatFeedback?: { status: "loading" | "success" | "error"; msg?: string } | null;
}

const ProductCard: React.FC<ProductCardProps> = ({
  card,
  isSelected,
  onToggleSelect,
  onChatNow,
  onNegotiate,
  chatFeedback,
}) => {
  const { formatPrice } = useCurrency();
  const hasPrice = card.unit_price !== undefined && card.unit_price !== null && card.unit_price > 0;
  const priceRes = formatPrice(card.unit_price || 0, card.currency || "USD");
  const placeholderImg = getCategoryPlaceholder(card.category_name, card.title);

  return (
    <div
      className={`relative bg-white rounded-2xl border transition-all duration-150 flex flex-col overflow-hidden hover:shadow-md ${
        isSelected ? "border-orange-500 ring-2 ring-orange-200" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Product Image & Select Checkbox */}
      <div className="relative aspect-4/3 w-full bg-slate-50 flex items-center justify-center overflow-hidden border-b border-slate-100">
        <img
          src={card.image && card.image.trim() !== "" ? card.image : placeholderImg}
          alt={card.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = placeholderImg;
          }}
        />

        {/* Select checkbox in top-right corner matching Alibaba screenshot */}
        <button
          onClick={onToggleSelect}
          className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all ${
            isSelected
              ? "bg-orange-500 text-white shadow-xs"
              : "bg-white/90 text-slate-600 border border-slate-200 hover:bg-white"
          }`}
        >
          <Check className={`w-3 h-3 ${isSelected ? "opacity-100" : "opacity-0"}`} />
          <span>{isSelected ? "Selected" : "Select"}</span>
        </button>

        {card.availability_status && (
          <span
            className={`absolute bottom-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-2xs ${
              card.availability_status === "out_of_stock"
                ? "bg-rose-600 text-white"
                : card.availability_status === "limited"
                ? "bg-amber-600 text-white"
                : "bg-emerald-700 text-white"
            }`}
          >
            {card.availability_status === "out_of_stock"
              ? "Out of stock"
              : card.availability_status === "limited"
              ? "Limited stock"
              : "In stock"}
          </span>
        )}

        {card.is_alternative && (
          <span className="absolute top-2.5 left-2.5 bg-amber-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-2xs">
            Similar product
          </span>
        )}

        {card.demo_data && (
          <span className="absolute bottom-2 right-2 bg-amber-950/80 text-amber-200 border border-amber-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs" data-testid="demo-data-badge">
            Demo data
          </span>
        )}
      </div>

      {/* Card Content */}
      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
        <div>
          {/* Certifications or Category Pill */}
          <div className="flex flex-wrap items-center gap-1 mb-1">
            {card.certifications && card.certifications.length > 0 ? (
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded">
                {card.certifications[0]}
              </span>
            ) : null}
            {card.lead_time && (
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />
                {card.lead_time}d lead
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="font-semibold text-xs text-slate-800 line-clamp-2 leading-snug hover:text-orange-600 transition-colors">
            {card.title}
          </h4>

          {/* Price & MOQ */}
          <div className="mt-1.5">
            <div
              className="flex items-baseline gap-1.5 flex-wrap"
              title={priceRes.approx ? `Original: ${card.currency} ${card.unit_price.toFixed(2)}` : undefined}
            >
              {hasPrice ? (
                <>
                  <span className="font-bold text-sm sm:text-base text-slate-900">
                    {priceRes.formatted}
                  </span>
                  {card.currency_display && card.currency_original && card.currency_display !== card.currency_original && card.price_display !== undefined && (
                    <span className="text-[10px] text-slate-500 font-medium">
                      (approx. {card.currency_display} {card.price_display.toFixed(2)})
                    </span>
                  )}
                  <span
                    className={`text-[9px] font-semibold px-1 rounded ${
                      card.price_status === "current"
                        ? "text-emerald-700 bg-emerald-50"
                        : "text-amber-700 bg-amber-50"
                    }`}
                  >
                    {card.price_status === "current" ? "confirmed" : card.price_status}
                  </span>
                </>
              ) : (
                <span className="font-semibold text-xs text-amber-700 italic">
                  Contact supplier for pricing
                </span>
              )}
            </div>
            {hasPrice && priceRes.approx && (
              <span className="text-[10px] text-slate-400 block font-normal">
                Orig: {card.currency} {card.unit_price.toFixed(2)}
              </span>
            )}
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
              <span>Min. order: {card.moq} {card.unit || "units"}</span>
              {card.available_quantity !== undefined && card.available_quantity !== null && (
                <span className="font-semibold text-slate-700">
                  Stock: {card.available_quantity.toLocaleString()} {card.unit || "units"}
                </span>
              )}
            </div>
          </div>

          {/* Supplier & Country */}
          <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex items-center justify-between">
            <span className="truncate max-w-[130px] font-medium text-slate-700">
              {card.supplier_name}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <span>{card.origin_country}</span>
              {card.supplier_verification && (
                <span title="Verified Supplier" className="inline-flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: Chat now & AI negotiate */}
        <div className="space-y-1.5 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onChatNow}
              disabled={chatFeedback?.status === "loading"}
              className="py-1.5 px-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-1"
            >
              {chatFeedback?.status === "loading" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <MessageSquare className="w-3 h-3" />
              )}
              <span>Chat now</span>
            </button>

            <button
              onClick={onNegotiate}
              className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-orange-400" />
              <span>AI negotiate</span>
            </button>
          </div>

          {chatFeedback?.msg && (
            <p
              className={`text-[10px] text-center font-medium ${
                chatFeedback.status === "error" ? "text-red-500" : "text-emerald-600"
              }`}
            >
              {chatFeedback.msg}
            </p>
          )}

          {/* Match explanation */}
          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1 pt-0.5">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>
              {card.match_explanation?.matched && card.match_explanation.matched.length > 0
                ? `Matches ${card.match_explanation.matched.length} requirements`
                : "Catalogue verified"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
