import React from "react";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  Tag,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "../../components/ui/Button";

interface NegotiationTimelineProps {
  rfqId?: string;
  rfqNumber: string;
}

export const NegotiationTimeline: React.FC<NegotiationTimelineProps> = ({
  rfqId,
  rfqNumber,
}) => {
  const events = [
    {
      id: "ev-1",
      round: "Round 1 - Initial Bids",
      title: "5 Commercial Quotes Received",
      time: "2 days ago",
      desc: "Supplier quotes ranging from €3.05/kg (NatureFarm) to €3.30/kg (Shree Spices) submitted.",
      icon: Clock,
      color: "text-blue-600 bg-blue-100",
    },
    {
      id: "ev-2",
      round: "Round 2 - Target Counter-Offer",
      title: "Buyer Counter-Offer to Sri Bharat Spices",
      time: "1 day ago",
      desc: "Proposed €3.05/kg for 20,000 kg with LC 30-day terms and expedited 22-day maritime transit.",
      icon: Tag,
      color: "text-amber-600 bg-amber-100",
    },
    {
      id: "ev-3",
      round: "Round 3 - Concession & Resolution",
      title: "Supplier Concession & Agreement",
      time: "3 hours ago",
      desc: "Sri Bharat Spices accepted final compromise rate of €3.05/kg. Commercial terms locked.",
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-100",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Commercial Negotiation History
          </h3>
          <p className="text-xs text-slate-500">
            Structured counter-offer trail, price concessions, and supplier messaging for {rfqNumber}
          </p>
        </div>

        <Link to={rfqId ? `/messages?rfqId=${rfqId}` : "/messages"}>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 font-bold flex items-center gap-1.5 shadow-xs"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Open Negotiation Messages</span>
          </Button>
        </Link>
      </div>

      {/* Timeline Steps */}
      <div className="space-y-6 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200 pl-2">
        {events.map((ev) => {
          const Icon = ev.icon;
          return (
            <div key={ev.id} className="relative flex items-start gap-4 text-xs">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ${ev.color}`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-700 uppercase tracking-wider text-[10px]">
                    {ev.round}
                  </span>
                  <span className="text-[11px] text-slate-400">{ev.time}</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">{ev.title}</h4>
                <p className="text-slate-600 leading-relaxed">{ev.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
