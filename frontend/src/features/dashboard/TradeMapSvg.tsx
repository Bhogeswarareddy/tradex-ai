import React from "react";

interface TradeNode {
  id: string;
  name: string;
  country: string;
  x: number;
  y: number;
  badge?: string;
  port: string;
}

const NODES: TradeNode[] = [
  { id: "usa", name: "New York Port", country: "USA", port: "New York", x: 195, y: 135, badge: "US East Hub" },
  { id: "germany", name: "Hamburg Port", country: "Germany", port: "Hamburg", x: 470, y: 105, badge: "EU Gateway" },
  { id: "uae", name: "Jebel Ali Port", country: "UAE", port: "Jebel Ali", x: 580, y: 175, badge: "Middle East Hub" },
  { id: "india", name: "Mundra Port", country: "India", port: "Mundra", x: 655, y: 195, badge: "Export Epicenter" },
  { id: "singapore", name: "Jurong Port", country: "Singapore", port: "Jurong", x: 755, y: 250, badge: "APAC Hub" },
];

export const TradeMapSvg: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div
      className={`relative w-full h-[340px] sm:h-[400px] lg:h-[440px] overflow-hidden rounded-3xl select-none pointer-events-none ${className}`}
      aria-hidden="true"
      role="presentation"
    >
      <svg
        viewBox="0 0 960 420"
        className="w-full h-full object-cover"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Subtle trade coordinate dots pattern */}
          <pattern id="grid-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.8" fill="#38BDF8" fillOpacity="0.09" />
          </pattern>

          {/* Glowing Gradients */}
          <linearGradient id="route-gradient-ocean" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.85" />
          </linearGradient>

          <linearGradient id="route-gradient-air" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818CF8" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#C084FC" stopOpacity="0.8" />
          </linearGradient>

          <filter id="svg-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background Dot Matrix */}
        <rect width="100%" height="100%" fill="url(#grid-dots)" />

        {/* Global Continental Geography Paths (Dark Modern Silhouettes) */}
        <g fill="#1E293B" fillOpacity="0.45" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.3">
          {/* North America */}
          <path d="M 90 65 L 120 50 L 175 45 L 235 60 L 260 90 L 250 130 L 210 160 L 190 190 L 165 170 L 150 130 L 115 110 L 80 85 Z" />
          {/* Greenland */}
          <path d="M 310 35 L 350 30 L 370 55 L 340 75 L 305 60 Z" />
          {/* Central & South America */}
          <path d="M 195 200 L 225 210 L 255 240 L 275 290 L 265 350 L 235 375 L 210 330 L 195 260 L 180 220 Z" />
          {/* Europe */}
          <path d="M 430 75 L 480 65 L 515 80 L 525 110 L 495 130 L 450 135 L 420 110 L 415 85 Z" />
          {/* Scandinavia & UK */}
          <path d="M 410 70 L 425 60 L 420 85 Z" />
          <path d="M 460 35 L 485 30 L 495 65 L 470 70 Z" />
          {/* Africa */}
          <path d="M 435 150 L 510 145 L 540 185 L 530 250 L 505 320 L 465 330 L 430 270 L 415 200 L 435 150 Z" />
          {/* Asia & Middle East */}
          <path d="M 535 75 L 610 60 L 730 65 L 815 110 L 800 170 L 740 210 L 685 240 L 650 220 L 620 180 L 570 170 L 535 125 Z" />
          {/* Southeast Asia Islands & Japan */}
          <path d="M 820 120 L 840 140 L 830 170 Z" />
          <path d="M 740 240 L 775 250 L 795 280 L 755 295 L 725 260 Z" />
          {/* Australia & New Zealand */}
          <path d="M 745 300 L 830 295 L 850 345 L 810 380 L 740 360 L 725 320 Z" />
          <path d="M 870 340 L 890 370 L 865 385 Z" />
        </g>

        {/* Primary Glowing Trade Routes */}
        {/* Route 1: India (Mundra) -> UAE (Jebel Ali) -> Germany (Hamburg) Ocean Corridor */}
        <path
          d="M 655 195 Q 615 180 580 175"
          fill="none"
          stroke="url(#route-gradient-ocean)"
          strokeWidth="2.5"
          strokeDasharray="5 4"
          filter="url(#svg-glow)"
          className="animate-[dash_15s_linear_infinite] motion-reduce:animate-none"
        />
        <path
          d="M 580 175 Q 515 140 470 105"
          fill="none"
          stroke="url(#route-gradient-ocean)"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          filter="url(#svg-glow)"
          className="animate-[dash_20s_linear_infinite] motion-reduce:animate-none"
        />

        {/* Route 2: Germany (Hamburg) -> USA (New York) Transatlantic Corridor */}
        <path
          d="M 470 105 Q 320 75 195 135"
          fill="none"
          stroke="#38BDF8"
          strokeOpacity="0.75"
          strokeWidth="2"
          strokeDasharray="5 5"
          filter="url(#svg-glow)"
          className="animate-[dash_25s_linear_infinite] motion-reduce:animate-none"
        />

        {/* Route 3: India (Mundra) -> Singapore (Jurong) Maritime Silk Route */}
        <path
          d="M 655 195 Q 705 220 755 250"
          fill="none"
          stroke="url(#route-gradient-air)"
          strokeWidth="2"
          strokeDasharray="4 4"
          className="animate-[dash_18s_linear_infinite] motion-reduce:animate-none"
        />

        {/* Route 4: Singapore (Jurong) -> USA West Coast / Trans-Pacific */}
        <path
          d="M 755 250 Q 860 210 930 170"
          fill="none"
          stroke="#60A5FA"
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Route 5: India (Mundra) -> USA Direct Airfreight Corridor */}
        <path
          d="M 655 195 Q 410 20 195 135"
          fill="none"
          stroke="#93C5FD"
          strokeOpacity="0.3"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />

        {/* Moving Cargo Vessel Icon along Arabian Sea / Suez (India to UAE/Hamburg) */}
        <g transform="translate(615, 184) rotate(-10)" className="motion-reduce:hidden">
          <circle cx="0" cy="0" r="13" fill="#10B981" fillOpacity="0.2" className="animate-ping" />
          <circle cx="0" cy="0" r="8" fill="#047857" />
          {/* Cargo Vessel Ship SVG Symbol */}
          <path
            d="M -5 -2 L 5 -2 L 3 3 L -3 3 Z M -2 -5 L 1 -5 L 1 -2 L -2 -2 Z"
            fill="#FFFFFF"
          />
        </g>

        {/* Moving Cargo Plane Icon along Transatlantic (Europe to USA) */}
        <g transform="translate(325, 100) rotate(12)" className="motion-reduce:hidden">
          <circle cx="0" cy="0" r="14" fill="#2563EB" fillOpacity="0.25" />
          <circle cx="0" cy="0" r="9" fill="#2563EB" />
          {/* Plane Symbol */}
          <path
            d="M 0 -5 L 2 -1 L 5 1 L 2 1 L 1 4 L -1 4 L -2 1 L -5 1 L -2 -1 Z"
            fill="#FFFFFF"
            className="animate-pulse"
          />
        </g>

        {/* Pulsing Trade Hub Pins */}
        {NODES.map((node) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
            {/* Outer animated radar ping ring */}
            <circle
              cx="0"
              cy="0"
              r="14"
              fill="#38BDF8"
              fillOpacity="0.22"
              className="animate-ping motion-reduce:hidden"
            />
            {/* Intermediate glow circle */}
            <circle cx="0" cy="0" r="7" fill="#1D4ED8" />
            {/* Glowing core */}
            <circle cx="0" cy="0" r="3.5" fill="#38BDF8" />

            {/* Hub Floating Tag */}
            <g transform="translate(0, -18)">
              <rect
                x="-42"
                y="-13"
                width="84"
                height="17"
                rx="4.5"
                fill="#0B132B"
                fillOpacity="0.9"
                stroke="#334155"
                strokeWidth="1"
              />
              <text
                x="0"
                y="-1"
                textAnchor="middle"
                fill="#F8FAFC"
                fontSize="9"
                fontWeight="700"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {node.country} ({node.port})
              </text>
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
};
