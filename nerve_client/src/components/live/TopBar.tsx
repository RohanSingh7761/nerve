import React, { useState } from 'react';
import { useNerveStore } from '../../state/store';
import {
  Play,
  Pause,
  RotateCcw,
  Cpu,
  Layers,
  Copy,
  Check,
} from 'lucide-react';

export const TopBar: React.FC = () => {
  const {
    sha256,
    filename,
    status,
    isPaused,
    tokensUsed,
    maxTokens,
    actualCostUsd,
    referenceCostUsd,
    iteration,
    maxIterations,
    currentProvider,
    currentModel,
    providerFailoverEvent,
    startMockRun,
    togglePause,
    reset,
  } = useNerveStore();

  const [copied, setCopied] = useState(false);

  const copySha = () => {
    navigator.clipboard.writeText(sha256);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tokenPercent = Math.min(100, Math.round((tokensUsed / maxTokens) * 100));

  return (
    <header className="h-16 px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4 select-none shrink-0 z-20 shadow-xs">
      {/* Left: Target APK Identity & SHA */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-700 font-bold text-sm tracking-wider font-display shadow-xs">
            NV
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-800 truncate max-w-[200px]">
                {filename || 'No Target Loaded'}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-semibold tracking-wide border ${
                  status === 'running'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 animate-pulse'
                    : status === 'completed'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : status === 'failed'
                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                {status}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
              <span className="text-slate-400">SHA256:</span>
              <span>{sha256 ? `${sha256.slice(0, 8)}...${sha256.slice(-6)}` : 'Awaiting Scan'}</span>
              {sha256 && (
                <button
                  onClick={copySha}
                  className="hover:text-emerald-600 transition-colors cursor-pointer"
                  title="Copy full SHA-256"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Provider Failover Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono">
          <Cpu className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-slate-500">LLM:</span>
          {status === 'idle' && !filename ? (
            <span className="text-slate-500 font-medium">Standby</span>
          ) : providerFailoverEvent ? (
            <div className="flex items-center gap-1">
              <span className="line-through text-rose-500 opacity-70">
                {providerFailoverEvent.from}
              </span>
              <span className="text-slate-400">→</span>
              <span className="text-emerald-600 font-semibold animate-pulse">
                {currentProvider} ({currentModel})
              </span>
            </div>
          ) : (
            <span className="text-slate-700 font-medium">
              {currentProvider} <span className="text-slate-400">({currentModel})</span>
            </span>
          )}
        </div>
      </div>

      {/* Center: Live Telemetry Metrics */}
      <div className="hidden xl:flex items-center gap-6 text-xs font-mono">
        {/* Token Budget Gauge */}
        <div className="flex flex-col gap-1 w-36">
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>TOKENS</span>
            <span className="tabular-nums text-slate-700 font-semibold">
              {(tokensUsed / 1000).toFixed(1)}k / {(maxTokens / 1000).toFixed(0)}k
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                tokenPercent > 80 ? 'bg-amber-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${tokenPercent}%` }}
            />
          </div>
        </div>

        {/* Cost comparison */}
        <div className="flex flex-col text-[11px]">
          <span className="text-slate-400">INFERENCE COST</span>
          <div className="flex items-center gap-1">
            <span className="text-emerald-700 font-semibold tabular-nums">
              ${actualCostUsd.toFixed(3)}
            </span>
            <span className="text-slate-400 line-through text-[10px]">
              ${referenceCostUsd.toFixed(2)}
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold ml-0.5">(-65%)</span>
          </div>
        </div>

        {/* Loop Iterations */}
        <div className="flex flex-col text-[11px]">
          <span className="text-slate-400">ITERATION</span>
          <div className="flex items-center gap-1 text-slate-700 font-semibold tabular-nums">
            <Layers className="w-3 h-3 text-amber-600" />
            <span>{iteration} / {maxIterations}</span>
          </div>
        </div>
      </div>

      {/* Right: Play/Pause, Reset, and Run previous scan again */}
      <div className="flex items-center gap-3">
        {/* Play/Pause & Reset */}
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
          <button
            onClick={togglePause}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title={isPaused ? 'Resume Run' : 'Pause Run'}
          >
            {isPaused ? <Play className="w-4 h-4 text-emerald-600 fill-emerald-600" /> : <Pause className="w-4 h-4" />}
          </button>

          <button
            onClick={reset}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Reset Canvas"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Run previous scan again Button */}
        <button
          onClick={startMockRun}
          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Run previous scan again</span>
        </button>
      </div>
    </header>
  );
};
