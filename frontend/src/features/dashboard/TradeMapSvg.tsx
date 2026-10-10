import React from "react";

interface TradeNode {
  id: string;
  name: string;
  country: string;
  x: number;
  y: number;
  badge?: string;
}

const NODES: TradeNode[] = [
  { id: "usa", name: "New York Port", country: "USA", x: 210, y: 145, badge: "Import Hub" },
  { id: "germany", name: "Hamburg Port", country: "Germany", x: 465, y: 115, badge: "EU Destination" },
  { id: "uae", name: "Jebel Ali Port", country: "UAE", x: 580, y: 180, badge: "Transit Hub" },
  { id: "india", name: "Mundra Port", country: "India", x: 660, y: 205, badge: "Export Origin" },
  { id: "singapore", name: "Jurong Port", country: "Singapore", x: 750, y: 260, badge: "Asia Gateway" },
];

export const TradeMapSvg: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`relative w-full h-[320px] sm:h-[380px] lg:h-[420px] overflow-hidden rounded-2xl select-none ${className}`}>
      {/* SVG Canvas */}
      <svg
        viewBox="0 0 920 400"
        className="w-full h-full object-cover"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Subtle world map dots pattern */}
          <pattern id="grid-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.75" fill="#38BDF8" fillOpacity="0.08" />
          </pattern>

          {/* Gradients */}
          <linearGradient id="route-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#38BDF8" stopOpacity="1" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
          </linearGradient>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background Grid */}
        <rect width="100%" height="100%" fill="url(#grid-dots)" />

        {/* Abstract World Continents Silhouettes */}
        <g fill="#1E293B" fillOpacity="0.35">
          {/* North America outline */}
          <path d="M 120 70 Q 160 60 240 80 Q 270 120 250 170 Q 210 200 160 170 Q 110 130 120 70 Z" />
          {/* South America outline */}
          <path d="M 230 210 Q 280 230 270 310 Q 240 370 210 320 Q 200 250 230 210 Z" />
          {/* Europe outline */}
          <path d="M 430 70 Q 500 65 520 120 Q 480 150 440 140 Q 410 110 430 70 Z" />
          {/* Africa outline */}
          <path d="M 440 160 Q 520 160 520 250 Q 480 340 440 280 Q 420 210 440 160 Z" />
          {/* Asia outline */}
          <path d="M 540 60 Q 720 50 780 140 Q 720 240 620 200 Q 540 140 540 60 Z" />
          {/* Australia outline */}
          <path d="M 740 290 Q 820 290 810 360 Q 750 370 730 330 Z" />
        </g>

        {/* Curved Glowing Trade Routes */}
        {/* Route 1: India -> Germany (Primary Turmeric Route) */}
        <path
          d="M 660 205 Q 560 90 465 115"
          fill="none"
          stroke="url(#route-gradient)"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          filter="url(#glow)"
          className="animate-[dash_20s_linear_infinite]"
        />

        {/* Route 2: Germany -> USA */}
        <path
          d="M 465 115 Q 330 80 210 145"
          fill="none"
          stroke="#38BDF8"
          strokeOpacity="0.5"
          strokeWidth="2"
          strokeDasharray="5 5"
        />

        {/* Route 3: India -> UAE */}
        <path
          d="M 660 205 Q 620 180 580 180"
          fill="none"
          stroke="#10B981"
          strokeOpacity="0.7"
          strokeWidth="2"
          strokeDasharray="4 4"
        />

        {/* Route 4: UAE -> Germany */}
        <path
          d="M 580 180 Q 520 135 465 115"
          fill="none"
          stroke="#38BDF8"
          strokeOpacity="0.5"
          strokeWidth="1.75"
          strokeDasharray="4 4"
        />

        {/* Route 5: India -> Singapore */}
        <path
          d="M 660 205 Q 710 235 750 260"
          fill="none"
          stroke="#38BDF8"
          strokeOpacity="0.6"
          strokeWidth="2"
          strokeDasharray="4 4"
        />

        {/* Route 6: India -> USA (Trans-Atlantic) */}
        <path
          d="M 660 205 Q 400 40 210 145"
          fill="none"
          stroke="#60A5FA"
          strokeOpacity="0.3"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Moving Cargo Plane along India -> Germany Route */}
        <g transform="translate(560, 130) rotate(-22)">
          <circle cx="0" cy="0" r="14" fill="#2563EB" fillOpacity="0.25" />
          <circle cx="0" cy="0" r="9" fill="#2563EB" />
          <path
            d="M -4 -4 L 4 0 L -4 4 L -2 0 Z"
            fill="#FFFFFF"
            className="animate-pulse"
          />
        </g>

        {/* Pulsing Trade Nodes (Pins) */}
        {NODES.map((node) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
            {/* Outer Pulse Ring */}
            <circle cx="0" cy="0" r="12" fill="#38BDF8" fillOpacity="0.2" className="animate-ping" />
            {/* Middle Circle */}
            <circle cx="0" cy="0" r="6" fill="#2563EB" />
            {/* Center Core */}
            <circle cx="0" cy="0" r="3" fill="#FFFFFF" />

            {/* Node Label Pin */}
            <g transform="translate(0, -18)">
              <rect
                x="-40"
                y="-12"
                width="80"
                height="16"
                rx="4"
                fill="#0F172A"
                fillOpacity="0.85"
                stroke="#334155"
                strokeWidth="1"
              />
              <text
                x="0"
                y="0"
                textAnchor="middle"
                fill="#F8FAFC"
                fontSize="8.5"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                {node.country}
              </text>
            </g>
          </g>
        ))}
      </svg>

      {/* Floating Active Corridor Badge */}
      <div className="absolute bottom-3 left-4 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs text-slate-300">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold text-white">Live Corridor:</span>
        <span className="text-slate-400">Mundra Port (IN) &rarr; Hamburg Port (DE)</span>
        <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
          Transit: 21 Days
        </span>
      </div>
    </div>
  );
};
