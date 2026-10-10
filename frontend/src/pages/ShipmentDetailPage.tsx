import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Compass,
  AlertTriangle,
  Sparkles,
  Play,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { shipmentsApi, Shipment, ShipmentEvent } from "../lib/api/shipments";
import { LoadingSpinner } from "../components/LoadingSpinner";

// Coordinates along maritime corridor from India to Hamburg
const WAYPOINTS = [
  { lat: 13.08, lng: 80.27, name: "Chennai Port, India" },
  { lat: 15.00, lng: 67.00, name: "Arabian Sea (East)" },
  { lat: 12.50, lng: 50.00, name: "Gulf of Aden" },
  { lat: 13.00, lng: 45.00, name: "Bab-el-Mandeb Strait" },
  { lat: 20.00, lng: 38.00, name: "Red Sea (North)" },
  { lat: 30.00, lng: 32.50, name: "Suez Canal" },
  { lat: 32.00, lng: 32.30, name: "Port Said, Egypt" },
  { lat: 34.50, lng: 24.00, name: "Mediterranean (East)" },
  { lat: 37.00, lng: 15.00, name: "Mediterranean (Central)" },
  { lat: 38.00, lng: 3.00, name: "Mediterranean (West)" },
  { lat: 36.10, lng: -5.35, name: "Strait of Gibraltar" },
  { lat: 46.00, lng: -5.00, name: "Bay of Biscay" },
  { lat: 51.00, lng: 2.00, name: "North Sea (South)" },
  { lat: 53.55, lng: 9.99, name: "Port of Hamburg, Germany" },
];

const MILESTONES = [
  { id: "GATE_IN", label: "Gate In" },
  { id: "CUSTOMS_CLEARED", label: "Customs Cleared" },
  { id: "VESSEL_DEPARTED", label: "Vessel Departed" },
  { id: "TRANSIT_SUEZ", label: "In Transit" },
  { id: "PORT_ARRIVED", label: "Port Arrived" },
  { id: "DELIVERED", label: "Delivered" },
];

// Project Lat/Lng to SVG coordinates for 800x400 map
const projectToSVG = (lat: number, lng: number) => {
  // Center roughly on Afro-Eurasia: lng [-20 to 100], lat [0 to 65]
  const x = ((lng + 20) / 120) * 800;
  const y = ((65 - lat) / 65) * 400;
  return { x, y };
};

export const ShipmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [events, setEvents] = useState<ShipmentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI Summary State
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [simulatingStep, setSimulatingStep] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const s = await shipmentsApi.get(id);
      setShipment(s);
      try {
        const evData = await shipmentsApi.events(id);
        setEvents(Array.isArray(evData) ? evData : (evData as any).events || []);
      } catch {
        setEvents([]);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load shipment");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleAiSummary = async () => {
    if (!id) return;
    setAiLoading(true);
    try {
      const res = await shipmentsApi.aiSummary(id);
      setAiSummary(res);
    } catch (err: any) {
      alert(`AI Summary failed: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSimulateStep = async () => {
    if (!id) return;
    setSimulatingStep(true);
    try {
      await shipmentsApi.simulateStep(id);
      await fetchDetails();
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setSimulatingStep(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-3xl mx-auto bg-white rounded-xl border border-red-200 p-6 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Shipment Not Found</h2>
          <p className="text-sm text-slate-600">{error || "Unable to display this shipment"}</p>
          <button
            onClick={() => navigate("/shipments")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            Back to Shipments
          </button>
        </div>
      </div>
    );
  }

  // Current vessel position
  const curLat = shipment.current_latitude ?? 12.5;
  const curLng = shipment.current_longitude ?? 50.0;
  const curPos = projectToSVG(curLat, curLng);

  // SVG route path
  const routePath = WAYPOINTS.map((w, i) => {
    const pt = projectToSVG(w.lat, w.lng);
    return `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }).join(" ");

  // Origin / Dest SVG points
  const originPt = projectToSVG(13.08, 80.27);
  const destPt = projectToSVG(53.55, 9.99);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <button
              onClick={() => navigate("/shipments")}
              className="text-xs font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 mb-2 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Shipments
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900">
                Shipment {shipment.shipment_number}
              </h1>
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 capitalize">
                {shipment.status?.replace("_", " ")}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded border border-slate-200">
                {shipment.carrier}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleAiSummary}
              disabled={aiLoading}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {aiLoading ? "Analyzing..." : "Generate AI Summary"}
            </button>
            <button
              onClick={handleSimulateStep}
              disabled={simulatingStep}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Play className="w-4 h-4 text-emerald-600" />
              {simulatingStep ? "Advancing..." : "Simulate Next Leg"}
            </button>
          </div>
        </div>

        {/* AI Shipment Insight Box (if generated) */}
        {aiSummary && (
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-indigo-950">AI Trade Logistics Assessment</h3>
              </div>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded uppercase ${
                  aiSummary.delay_risk_level === "low"
                    ? "bg-emerald-100 text-emerald-800"
                    : aiSummary.delay_risk_level === "medium"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                Risk: {aiSummary.delay_risk_level}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-900 leading-relaxed">
              {aiSummary.current_status || aiSummary.summary}
            </p>
            {aiSummary.recommendations && (
              <div className="text-xs text-indigo-800 pt-1 border-t border-indigo-200">
                <strong>Logistics Advice:</strong> {aiSummary.recommendations}
              </div>
            )}
          </div>
        )}

        {/* Maritime SVG Telemetry Map (matches the reference design) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Compass className="w-5 h-5 text-indigo-600" />
                Live Maritime Corridor Telemetry
              </h2>
              <p className="text-xs text-slate-500">
                Current Location: <strong>{shipment.current_location || "Arabian Sea"}</strong> (Lat: {curLat.toFixed(2)}, Lng: {curLng.toFixed(2)})
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-blue-700">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                Port of Origin (India)
              </span>
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Port of Destination (Hamburg)
              </span>
            </div>
          </div>

          {/* SVG Map Container */}
          <div className="relative w-full h-[380px] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
            <svg
              viewBox="0 0 800 400"
              className="w-full h-full"
              style={{ background: "radial-gradient(ellipse at center, #1e293b 0%, #0f172a 100%)" }}
            >
              {/* Subtle grid lines */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.3" />
                </pattern>
              </defs>
              <rect width="800" height="400" fill="url(#grid)" />

              {/* Maritime shipping route polyline */}
              <path
                d={routePath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                strokeOpacity="0.8"
              />

              {/* Waypoint dots */}
              {WAYPOINTS.map((w, i) => {
                const pt = projectToSVG(w.lat, w.lng);
                return (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r="2"
                    fill="#64748b"
                    opacity="0.6"
                  />
                );
              })}

              {/* Origin Marker (Chennai / Nhava Sheva) */}
              <circle cx={originPt.x} cy={originPt.y} r="6" fill="#3b82f6" />
              <text x={originPt.x + 10} y={originPt.y + 4} fill="#93c5fd" fontSize="11" fontWeight="bold">
                India (Origin)
              </text>

              {/* Destination Marker (Hamburg) */}
              <circle cx={destPt.x} cy={destPt.y} r="6" fill="#10b981" />
              <text x={destPt.x - 100} y={destPt.y - 8} fill="#6ee7b7" fontSize="11" fontWeight="bold">
                Hamburg (Destination)
              </text>

              {/* Current Vessel Position with animated pulse */}
              <circle cx={curPos.x} cy={curPos.y} r="14" fill="#f43f5e" opacity="0.25">
                <animate attributeName="r" values="10;18;10" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={curPos.x} cy={curPos.y} r="6" fill="#f43f5e" />
              <text
                x={curPos.x + 10}
                y={curPos.y - 10}
                fill="#fda4af"
                fontSize="11"
                fontWeight="bold"
              >
                🚢 {shipment.vessel_or_flight || "Vessel"} (Current)
              </text>
            </svg>

            {/* Bottom floating telemetry chip */}
            <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-xs border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-3">
              <span>LAT: {curLat.toFixed(2)}°N</span>
              <span>LNG: {curLng.toFixed(2)}°E</span>
              <span className="text-cyan-400">STATUS: ON SCHEDULE</span>
            </div>
          </div>
        </div>

        {/* 6-Step Milestone Tracker */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm overflow-x-auto space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Consignment Milestones
          </h2>
          <div className="flex items-center justify-between min-w-[700px]">
            {MILESTONES.map((m, idx) => {
              // Check if matching completed event exists
              const isCompleted = events.some(
                (e) => e.event_type === m.id && e.status === "completed"
              );
              const isInProgress = events.some(
                (e) => e.event_type === m.id && e.status === "in_progress"
              );

              return (
                <div key={m.id} className="flex-1 flex items-center relative">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition ${
                        isCompleted
                          ? "bg-emerald-500 text-white"
                          : isInProgress
                          ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                          : "bg-slate-100 text-slate-400 border border-slate-200"
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                    </div>
                    <span
                      className={`text-xs mt-2 font-medium text-center ${
                        isInProgress
                          ? "text-indigo-600 font-bold"
                          : isCompleted
                          ? "text-slate-800"
                          : "text-slate-400"
                      }`}
                    >
                      {m.label}
                    </span>
                  </div>
                  {idx < MILESTONES.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 absolute top-4.5 left-1/2 w-full -z-0 ${
                        isCompleted ? "bg-emerald-500" : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Details Grid & Events Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Cargo & Logistics Specs</h3>
            <div className="divide-y divide-slate-100">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Freight Mode:</span>
                <strong className="text-slate-900 capitalize">{shipment.mode || "Sea Freight"}</strong>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Vessel Name:</span>
                <strong className="text-slate-900">{shipment.vessel_or_flight || "MV Ocean Star"}</strong>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Container Number:</span>
                <span className="font-mono font-bold text-indigo-700">{shipment.container_number || "TCNU1234567"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Forwarder:</span>
                <strong className="text-slate-900">{shipment.freight_forwarder || "OceanLink Logistics"}</strong>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Incoterm:</span>
                <span className="font-bold text-slate-900">{shipment.incoterm || "CIF Hamburg"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Commodity:</span>
                <span className="text-slate-800">{shipment.goods || "Organic Turmeric Powder, 20,000 kg"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">ETA Hamburg:</span>
                <strong className="text-emerald-700">{shipment.eta || shipment.estimated_delivery || "2026-10-14"}</strong>
              </div>
            </div>
          </div>

          {/* Events Feed */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Consignment Event Log
            </h3>

            {events.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No events logged yet.</p>
            ) : (
              <div className="space-y-3">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 uppercase tracking-wide">
                          {ev.event_type.replace("_", " ")}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            ev.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                        >
                          {ev.status}
                        </span>
                      </div>
                      <p className="text-slate-600">{ev.description}</p>
                      <span className="text-[11px] text-slate-400 block font-medium">
                        📍 {ev.location}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 whitespace-nowrap">
                      {ev.occurred_at ? new Date(ev.occurred_at).toLocaleDateString() : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};