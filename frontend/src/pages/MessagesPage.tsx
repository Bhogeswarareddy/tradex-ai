import React, { useState, useEffect } from "react";
import { MessageSquare, ShieldCheck } from "lucide-react";
import { ThreadListItem, communicationApi } from "../lib/api/communication";
import { ThreadList, ChatWindow } from "../features/communication";
import { LoadingSpinner } from "../components/LoadingSpinner";

export const MessagesPage: React.FC = () => {
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadThreads = async () => {
    try {
      const data = await communicationApi.listThreads();
      setThreads(data);
      if (data.length > 0 && !selectedThreadId) {
        setSelectedThreadId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load threads", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThreads();
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Trade Messages & Structured Negotiation</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Prompt 15
            </span>
          </h1>
          <p className="text-xs text-slate-500">
            Real-time direct messaging, formal counter-offers, and autonomous AI deal assistance
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Encrypted Trade Communication</span>
        </div>
      </div>

      {/* Main Messages Container (Height constrained full card) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row h-[780px]">
        {/* Left Column: Thread List */}
        <div className="w-full md:w-80 lg:w-96 shrink-0 h-1/3 md:h-full">
          <ThreadList
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelectThread={(id) => setSelectedThreadId(id)}
            loading={loading}
          />
        </div>

        {/* Right Column: Chat Window or Placeholder */}
        <div className="flex-1 h-2/3 md:h-full">
          {selectedThreadId ? (
            <ChatWindow
              key={selectedThreadId}
              threadId={selectedThreadId}
              onRefreshThreadList={loadThreads}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3 bg-slate-50">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-200">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Conversation Selected</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Select an active supplier thread from the list to review offers and send negotiation messages.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
