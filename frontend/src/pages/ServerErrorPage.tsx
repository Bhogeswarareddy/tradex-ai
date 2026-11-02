import React from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Home, Server, ShieldAlert } from "lucide-react";

export const ServerErrorPage: React.FC = () => {
  const reqId = `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center select-none">
      {/* 500 Visual Badge */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-rose-600/10 via-amber-600/15 to-orange-600/10 border border-rose-500/20 flex items-center justify-center shadow-2xl backdrop-blur-md">
          <Server className="w-12 h-12 text-rose-600 dark:text-rose-400" />
        </div>
        <span className="absolute -top-2 -right-2 px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider bg-rose-600 text-white shadow-lg">
          500
        </span>
      </div>

      {/* Heading & Subtitle */}
      <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
        Trade Engine Service Interruption
      </h1>
      <p className="mt-2.5 text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
        Our core B2B processing pipeline encountered an unexpected server condition. Our automated infrastructure monitors have registered this incident.
      </p>

      {/* Telemetry Trace Badge */}
      <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-600 dark:text-slate-300">
        <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
        <span>Trace Reference: {reqId}</span>
      </div>

      {/* Primary Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
        <button
          type="button"
          onClick={handleReload}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-rose-500/25 transition focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-xs focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        >
          <Home className="w-4 h-4" />
          <span>Marketplace Home</span>
        </Link>
      </div>
    </div>
  );
};
