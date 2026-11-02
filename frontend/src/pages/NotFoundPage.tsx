import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Compass, Search, Home, ArrowLeft, Bot, Package } from "lucide-react";

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center select-none">
      {/* 404 Visual Icon Badge */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-600/10 via-indigo-600/15 to-purple-600/10 border border-blue-500/20 flex items-center justify-center shadow-2xl backdrop-blur-md">
          <Compass className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin motion-reduce:animate-none" />
        </div>
        <span className="absolute -top-2 -right-2 px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider bg-rose-500 text-white shadow-lg">
          404
        </span>
      </div>

      {/* Heading & Subtitle */}
      <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
        Trade Lane Not Found
      </h1>
      <p className="mt-2.5 text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
        The destination port or workspace route you are attempting to reach does not exist, has relocated, or requires elevated customs credentials.
      </p>

      {/* Primary Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-xs focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go Back</span>
        </button>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/25 transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        >
          <Home className="w-4 h-4" />
          <span>Marketplace Home</span>
        </Link>
      </div>

      {/* Helpful Shortcuts */}
      <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800/80 max-w-lg w-full">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Explore Popular Trade Destinations
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <Link
            to="/ai-search"
            className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition"
          >
            <Search className="w-4 h-4 text-blue-500" />
            <span>AI Search</span>
          </Link>
          <Link
            to="/products"
            className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition"
          >
            <Package className="w-4 h-4 text-emerald-500" />
            <span>Products</span>
          </Link>
          <Link
            to="/copilot"
            className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition"
          >
            <Bot className="w-4 h-4 text-purple-500" />
            <span>Trade Copilot</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
