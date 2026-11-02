import React, { useEffect, useState } from "react";
import {
  Clock,
  CheckCircle2,
  FileText,
  DollarSign,
  Truck,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "../../lib/api";

export interface TimelineEvent {
  id: string;
  action: string;
  action_title: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, any>;
  timestamp: string | null;
  date_display: string;
}

export interface ActivityTimelineProps {
  entityType: "order" | "rfq" | "supplier" | "product";
  entityId: string;
  className?: string;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  entityType,
  entityId,
  className = "",
}) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>(
        `/activity-timeline?entity_type=${entityType}&entity_id=${entityId}`
      );
      setEvents(res?.events || res?.data?.events || []);
    } catch (err) {
      console.error("Failed to fetch activity timeline:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entityId) {
      fetchTimeline();
    }
  }, [entityType, entityId]);

  const getEventIcon = (action: string) => {
    if (action.includes("document")) return <FileText className="w-4 h-4 text-blue-500" />;
    if (action.includes("payment") || action.includes("escrow")) return <DollarSign className="w-4 h-4 text-emerald-500" />;
    if (action.includes("shipment") || action.includes("transit") || action.includes("shipped"))
      return <Truck className="w-4 h-4 text-purple-500" />;
    if (action.includes("tier") || action.includes("verified")) return <ShieldCheck className="w-4 h-4 text-amber-500" />;
    if (action.includes("created")) return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    return <Clock className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs ${className}`}>
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Audit Activity Timeline
          </h3>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
            Immutable Audit Trail
          </span>
        </div>

        <button
          onClick={fetchTimeline}
          disabled={loading}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-4 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-400">
          No audit activity recorded yet.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {events.map((ev, idx) => (
            <div key={ev.id || idx} className="relative flex items-start gap-4 group">
              {/* Timeline Dot */}
              <div className="absolute -left-6 mt-0.5 p-1 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 group-hover:border-emerald-500 transition-colors">
                {getEventIcon(ev.action)}
              </div>

              {/* Content Box */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {ev.action_title}
                  </span>
                  <span className="text-xs text-slate-400 font-mono shrink-0">
                    {ev.date_display}
                  </span>
                </div>

                {ev.details && Object.keys(ev.details).length > 0 && (
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-800/60 p-2 rounded-md border border-slate-100 dark:border-slate-800">
                    {Object.entries(ev.details).map(([k, v]) => (
                      <span key={k} className="inline-block mr-3">
                        <strong className="text-slate-600 dark:text-slate-300">{k}:</strong> {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default ActivityTimeline;
