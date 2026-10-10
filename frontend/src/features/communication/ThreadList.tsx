import React, { useState } from "react";
import { Search, Building2, User, MessageSquare } from "lucide-react";
import { ThreadListItem } from "../../lib/api/communication";

interface ThreadListProps {
  threads: ThreadListItem[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  loading?: boolean;
}

export const ThreadList: React.FC<ThreadListProps> = ({
  threads,
  selectedThreadId,
  onSelectThread,
  loading,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredThreads = threads.filter((t) => {
    const q = searchTerm.toLowerCase();
    return (
      t.counterparty_name.toLowerCase().includes(q) ||
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.last_message && t.last_message.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Top Search & Filter Bar */}
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Conversations</h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {threads.length} Threads
          </span>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search supplier, trade title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
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
