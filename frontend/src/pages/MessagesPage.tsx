import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageSquare, ShieldCheck, Plus } from "lucide-react";
import { ThreadListItem, communicationApi } from "../lib/api/communication";
import { ThreadList, ChatWindow, NewMessageModal } from "../features/communication";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { Button } from "../components/ui/Button";

export const MessagesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);

  const initialBuyerId = searchParams.get("buyerId") || undefined;
  const initialContextType = (searchParams.get("context") as any) || undefined;
  const initialContextId = searchParams.get("contextId") || undefined;
  const requestedThreadId = searchParams.get("threadId");

  const loadThreads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await communicationApi.listThreads();
      setThreads(data);

      // Handle URL selection or fallback
      if (requestedThreadId) {
        setSelectedThreadId(requestedThreadId);
      } else if (data.length > 0 && !selectedThreadId) {
        setSelectedThreadId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load threads", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [requestedThreadId, selectedThreadId]);

  useEffect(() => {
    loadThreads();
    // 15-second background polling
    const timer = setInterval(() => {
      loadThreads(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [loadThreads]);

  // Open new message modal if buyerId is in URL query
  useEffect(() => {
    if (initialBuyerId || searchParams.get("new") === "1") {
      setIsNewMessageOpen(true);
    }
  }, [initialBuyerId, searchParams]);

  const handleThreadCreated = (newThreadId: string) => {
    // Clear query params
    setSearchParams({});
    loadThreads(true);
    setSelectedThreadId(newThreadId);
  };

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
          </h1>
          <p className="text-xs text-slate-500">
            Real-time direct messaging, formal counter-offers, and autonomous AI deal assistance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsNewMessageOpen(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>New Message</span>
          </Button>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted Trade Communication</span>
          </div>
        </div>
      </div>

      {/* Main Messages Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row h-[780px]">
        {/* Left Column: Thread List */}
        <div className="w-full md:w-80 lg:w-96 shrink-0 h-1/3 md:h-full">
          <ThreadList
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelectThread={(id) => setSelectedThreadId(id)}
            loading={loading}
            onNewMessage={() => setIsNewMessageOpen(true)}
          />
        </div>

        {/* Right Column: Chat Window or Placeholder */}
        <div className="flex-1 h-2/3 md:h-full">
          {selectedThreadId ? (
            <ChatWindow
              key={selectedThreadId}
              threadId={selectedThreadId}
              onRefreshThreadList={() => loadThreads(true)}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-4 bg-slate-50">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-200 shadow-2xs">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">No Conversation Selected</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Select an active thread from the list or start a new conversation with a qualified trade counterparty.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsNewMessageOpen(true)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                <Plus className="w-4 h-4" />
                <span>Start New Conversation</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* New Message Dialog */}
      <NewMessageModal
        isOpen={isNewMessageOpen}
        onClose={() => setIsNewMessageOpen(false)}
        onThreadCreated={handleThreadCreated}
        initialRecipientId={initialBuyerId}
        initialContextType={initialContextType}
        initialContextId={initialContextId}
      />
    </div>
  );
};
