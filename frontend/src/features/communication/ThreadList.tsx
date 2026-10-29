import React, { useState } from "react";
import { Search, Building2, User, MessageSquare, Plus } from "lucide-react";
import { ThreadListItem } from "../../lib/api/communication";

interface ThreadListProps {
  threads: ThreadListItem[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  loading?: boolean;
  onNewMessage?: () => void;
}

type TabType = "all" | "unread" | "rfq" | "orders";

export const ThreadList: React.FC<ThreadListProps> = ({
  threads,
  selectedThreadId,
  onSelectThread,
  loading,
  onNewMessage,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const unreadCount = threads.filter((t) => t.unread_count > 0).length;
  const rfqCount = threads.filter((t) => Boolean(t.rfq_id) || Boolean(t.title && t.title.toLowerCase().includes("rfq"))).length;
  const ordersCount = threads.filter((t) => Boolean(t.title && t.title.toLowerCase().includes("order"))).length;

  const filteredThreads = threads.filter((t) => {
    // Tab filter
    if (activeTab === "unread" && t.unread_count === 0) return false;
    if (activeTab === "rfq" && !t.rfq_id && !(t.title && t.title.toLowerCase().includes("rfq"))) return false;
    if (activeTab === "orders" && !(t.title && t.title.toLowerCase().includes("order"))) return false;

    // Search filter
    const q = searchTerm.toLowerCase();
    return (
      t.counterparty_name.toLowerCase().includes(q) ||
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.last_message && t.last_message.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Top Search & Filter Bar */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Conversations</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {threads.length}
            </span>
          </div>
          {onNewMessage && (
            <button
              type="button"
              onClick={onNewMessage}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex-1 py-1 rounded-lg text-center transition-all ${
              activeTab === "all"
                ? "bg-white text-blue-700 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All ({threads.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("unread")}
            className={`flex-1 py-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
              activeTab === "unread"
                ? "bg-white text-blue-700 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rfq")}
            className={`flex-1 py-1 rounded-lg text-center transition-all ${
              activeTab === "rfq"
                ? "bg-white text-blue-700 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            RFQ ({rfqCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex-1 py-1 rounded-lg text-center transition-all ${
              activeTab === "orders"
                ? "bg-white text-blue-700 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Orders ({ordersCount})
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search counterparties or trade titles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
      </div>

      {/* Threads Scrollable List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading conversations...</div>
        ) : filteredThreads.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 space-y-1">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">No conversations found</p>
            <p className="text-[11px]">When quotes or counter-offers are made, threads will appear here.</p>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const isSelected = thread.id === selectedThreadId;
            const hasUnread = thread.unread_count > 0;

            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => onSelectThread(thread.id)}
                className={`w-full text-left p-4 transition-all flex items-start gap-3 hover:bg-slate-50 relative ${
                  isSelected ? "bg-blue-50/70 border-l-4 border-l-blue-600" : ""
                }`}
              >
                {/* Counterparty Avatar */}
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden text-slate-500 font-bold">
                  {thread.counterparty_logo ? (
                    <img
                      src={thread.counterparty_logo}
                      alt={thread.counterparty_name}
                      className="w-full h-full object-cover"
                    />
                  ) : thread.counterparty_role === "supplier" ? (
                    <Building2 className="w-5 h-5 text-blue-600" />
                  ) : (
                    <User className="w-5 h-5 text-indigo-600" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {thread.counterparty_name}
                    </span>
                    {thread.last_message_at && (
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(thread.last_message_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] font-semibold text-blue-600 truncate mb-1">
                    {thread.title}
                  </p>

                  <p className="text-[11px] text-slate-500 truncate">
                    {thread.last_message || "No messages yet"}
                  </p>
                </div>

                {/* Unread Pill */}
                {hasUnread && (
                  <span className="ml-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs">
                    {thread.unread_count}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
