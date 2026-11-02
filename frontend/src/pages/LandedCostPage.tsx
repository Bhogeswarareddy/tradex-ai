import React, { useState, useEffect } from "react";
import {
  Calculator,
  Printer,
  Info,
  ShieldCheck,
  Ship,
  FileSpreadsheet,
} from "lucide-react";
import { apiClient } from "../lib/api";

interface BreakdownItem {
  category: string;
  amount: number;
  cost_per_kg: number;
  percentage: number;
  note: string;
}

interface LandedCostData {
  label: string;
  currency: string;
  product_cost_total: number;
  product_cost_per_kg: number;
  freight_total: number;
  freight_per_kg: number;
  insurance_total: number;
  insurance_per_kg: number;
  duty_total: number;
  duty_per_kg: number;
  handling_total: number;
  handling_per_kg: number;
  inland_total: number;
  inland_per_kg: number;
  total_landed_cost: number;
  landed_cost_per_kg: number;
  breakdown: BreakdownItem[];
  rates_source: string;
}

const COMMON_PORTS = [
  { port: "Chennai", country: "India" },
  { port: "Nhava Sheva", country: "India" },
  { port: "Kochi", country: "India" },
  { port: "Mundra Port", country: "India" },
  { port: "Hamburg", country: "Germany" },
  { port: "Rotterdam", country: "Netherlands" },
  { port: "New York", country: "United States" },
  { port: "Genoa", country: "Italy" },
  { port: "Singapore", country: "Singapore" },
  { port: "Dubai Jebel Ali", country: "United Arab Emirates" },
];

const HS_PRESETS = [
  { code: "0910.30", label: "Turmeric Spices (0910.30 - 0% EU GSP)" },
  { code: "0904.11", label: "Black Pepper Whole (0904.11 - 4% Duty)" },
  { code: "1006.30", label: "Semi-Milled Basmati Rice (1006.30)" },
  { code: "5201.00", label: "Raw Cotton Fibers (5201.00)" },
  { code: "8471.30", label: "Portable Digital Computers / Laptops (8471.30)" },
];

export const LandedCostPage: React.FC = () => {
  const [price, setPrice] = useState<number>(4.8);
  const [quantity, setQuantity] = useState<number>(10000);
  const [currency, setCurrency] = useState<string>("USD");
  const [incoterm, setIncoterm] = useState<string>("CIF");
  const [originPort, setOriginPort] = useState<string>("Chennai");
  const [destPort, setDestPort] = useState<string>("Hamburg");
  const [destCountry, setDestCountry] = useState<string>("Germany");
  const [hsCode, setHsCode] = useState<string>("0910.30");

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<LandedCostData | null>(null);

  const calculateCost = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<any>("/landed-cost/calculate", {
        product_price: price,
        quantity: quantity,
        currency: currency,
        origin_port: originPort,
        destination_port: destPort,
        destination_country: destCountry,
        incoterm: incoterm,
        hs_code: hsCode,
      });
      setResult(res?.data || res);
    } catch (err) {
      console.error("Landed cost calculation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateCost();
  }, [price, quantity, currency, incoterm, originPort, destPort, destCountry, hsCode]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Calculator className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Landed Cost Intelligence Calculator
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time line-by-line total landed cost simulation including ocean freight, marine insurance, tariffs by HS code, and terminal handling.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Simulated Stored Rates
          </span>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Export PDF / Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Controls Column */}
        <div className="lg:col-span-5 space-y-6 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-500" /> Consignment Parameters
            </h2>
            {loading && <span className="text-xs text-emerald-500 animate-pulse">Calculating...</span>}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Product Unit Price
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono text-slate-400">
                    {currency}/unit
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Order Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Incoterm
                </label>
                <select
                  value={incoterm}
                  onChange={(e) => setIncoterm(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 font-semibold"
                >
                  <option value="CIF">CIF (Cost, Insurance & Freight)</option>
                  <option value="FOB">FOB (Free On Board)</option>
                  <option value="EXW">EXW (Ex Works)</option>
                  <option value="DDP">DDP (Delivered Duty Paid)</option>
                  <option value="CFR">CFR (Cost & Freight)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Origin Port
                </label>
                <select
                  value={originPort}
                  onChange={(e) => setOriginPort(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                >
                  {COMMON_PORTS.map((p) => (
                    <option key={p.port} value={p.port}>
                      {p.port} ({p.country})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Destination Port
                </label>
                <select
                  value={destPort}
                  onChange={(e) => {
                    setDestPort(e.target.value);
                    const match = COMMON_PORTS.find((p) => p.port === e.target.value);
                    if (match) setDestCountry(match.country);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                >
                  {COMMON_PORTS.map((p) => (
                    <option key={p.port} value={p.port}>
                      {p.port} ({p.country})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Commodity HS Code
              </label>
              <select
                value={hsCode}
                onChange={(e) => setHsCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
              >
                {HS_PRESETS.map((h) => (
                  <option key={h.code} value={h.code}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <Info className="w-4 h-4 shrink-0" />
              <span>Incoterm Responsibility: {incoterm}</span>
            </div>
            <p>
              {incoterm === "CIF" && "Seller pays freight and marine insurance to port of destination. Buyer pays import duties and terminal handling."}
              {incoterm === "FOB" && "Buyer assumes freight, marine cargo insurance, and all import charges from the port of origin."}
              {incoterm === "EXW" && "Buyer is responsible for origin inland haulage, export clearance, ocean freight, insurance, and duties."}
              {incoterm === "DDP" && "Seller assumes maximum obligation: freight, insurance, customs clearance, and import duties delivered to warehouse."}
              {incoterm === "CFR" && "Seller pays ocean freight. Buyer covers marine cargo insurance and import duties."}
            </p>
          </div>
        </div>

        {/* Results & Breakdown Column */}
        <div className="lg:col-span-7 space-y-6">
          {result && (
            <>
              {/* Highlight KPI Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-xl shadow-lg border border-slate-700">
                <div className="flex items-center justify-between pb-4 border-b border-slate-700/80">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                      Total Estimated Landed Cost
                    </span>
                    <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                      {result.currency} {result.total_landed_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                      Effective Landed Unit Cost
                    </span>
                    <div className="text-2xl font-bold text-white mt-1">
                      {result.currency} {result.landed_cost_per_kg.toFixed(3)} / unit
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Ship className="w-4 h-4 text-blue-400" />
                    <span>Route: {originPort} → {destPort} ({destCountry})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Incoterm: {incoterm}</span>
                  </div>
                </div>
              </div>

              {/* Line-by-Line Breakdown Table */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Line-by-Line Cost Composition
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    Quantity: {quantity.toLocaleString()} units
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {result.breakdown.map((item, idx) => (
                    <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <span>{item.category}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {item.percentage}% of total
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.note}</p>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {result.currency} {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {result.currency} {item.cost_per_kg.toFixed(3)} / unit
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-slate-50/70 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
                  <span>Source: {result.rates_source}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Calculated for Trade Compliance
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
export default LandedCostPage;
