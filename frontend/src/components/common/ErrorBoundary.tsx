import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  level?: "route" | "widget";
  fallbackTitle?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  requestId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    requestId: "",
  };

  public static getDerivedStateFromError(error: Error): State {
    const reqId = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    return { hasError: true, error, requestId: reqId };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[TradeX ErrorBoundary - ${this.state.requestId}] Uncaught application error:`, error, errorInfo);
  }

  private handleReset = () => {
    if (this.props.onRetry) {
      this.props.onRetry();
    }
    this.setState({ hasError: false, error: null, requestId: "" });
  };

  private handleFullReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isWidget = this.props.level === "widget";

      if (isWidget) {
        return (
          <div
            data-testid="widget-error-boundary"
            className="p-5 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 space-y-3 shadow-xs my-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{this.props.fallbackTitle || "This section encountered an issue"}</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                {this.state.requestId}
              </span>
            </div>

            <p className="text-xs text-rose-700 dark:text-rose-300">
              {this.state.error?.message || "An unexpected error occurred while rendering this data widget."}
            </p>

            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Component
            </button>
          </div>
        );
      }

      return (
        <div
          data-testid="route-error-boundary"
          className="min-h-[60vh] flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xl">
            <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-red-500">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              An unexpected error occurred in this workspace view. Our telemetry pipeline has logged this trace.
            </p>

            <div className="mb-5 p-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-left overflow-auto max-h-28 text-[11px] font-mono text-red-600 dark:text-red-400">
              <div className="text-[10px] text-slate-400 mb-1 font-sans">Request ID: {this.state.requestId}</div>
              {this.state.error?.message}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-blue-600/20"
              >
                <RefreshCw className="w-4 h-4" />
                Retry View
              </button>
              <button
                type="button"
                onClick={this.handleFullReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm rounded-xl transition-all"
              >
                <Home className="w-4 h-4" />
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
