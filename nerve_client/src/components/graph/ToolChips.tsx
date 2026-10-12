import React from 'react';
import { ToolCallState } from '../../types/domain';
import { ArrowRight, CheckCircle, RotateCcw, AlertTriangle } from 'lucide-react';

interface ToolChipsProps {
  tools: ToolCallState[];
}

export const ToolChips: React.FC<ToolChipsProps> = ({ tools }) => {
  if (tools.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 mt-2.5">
      {tools.slice(0, 2).map((t) => {
        const isRunning = t.status === 'running';
        const isFailed = t.status === 'failed';
        const isFallback = t.isFallback;

        return (
          <div
            key={t.id}
            className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border transition-all ${
              isRunning
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 animate-pulse'
                : isFallback
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : isFailed
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {isRunning ? (
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping mr-0.5" />
            ) : isFallback ? (
              <RotateCcw className="w-3 h-3 text-amber-600 shrink-0" />
            ) : isFailed ? (
              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
            )}

            <span className="font-mono truncate max-w-[110px]" title={t.tool}>
              {t.tool}
            </span>

            {isFallback && t.fallbackTo && (
              <>
                <ArrowRight className="w-3 h-3 text-amber-600 shrink-0" />
                <span className="font-mono text-amber-700 font-semibold truncate max-w-[110px]">
                  {t.fallbackTo}
                </span>
              </>
            )}

            {t.durationMs && !isFallback && (
              <span className="text-[10px] text-slate-400 ml-auto tabular-nums">
                {t.durationMs}ms
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
