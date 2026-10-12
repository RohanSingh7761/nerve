import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Nerve React ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-[#07090F] text-slate-100 flex flex-col items-center justify-center p-6 select-text">
          <div className="w-full max-w-2xl p-6 rounded-2xl bg-[#0E1320] border border-red-500/50 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-bold font-display">
                Runtime Error Encountered
              </h1>
            </div>

            <p className="text-xs text-slate-300 font-mono bg-black/40 p-3 rounded border border-red-900/40 break-words">
              {this.state.error?.message || 'Unknown error'}
            </p>

            {this.state.errorInfo && (
              <pre className="text-[11px] font-mono text-slate-400 bg-black/60 p-3 rounded max-h-60 overflow-y-auto whitespace-pre-wrap">
                {this.state.errorInfo.componentStack}
              </pre>
            )}

            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-semibold flex items-center gap-2 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Interface</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
