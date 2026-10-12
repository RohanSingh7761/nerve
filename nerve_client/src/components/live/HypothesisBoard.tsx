import React from 'react';
import { useNerveStore } from '../../state/store';
import { HypothesisItem } from '../../types/domain';
import { Lightbulb, CheckCircle2, AlertOctagon, HelpCircle, ShieldCheck } from 'lucide-react';

export const HypothesisBoard: React.FC = () => {
  const hypotheses = useNerveStore((state) => state.hypotheses);
  const selectItem = useNerveStore((state) => state.selectItem);

  const getStatusBadge = (status: HypothesisItem['status']) => {
    switch (status) {
      case 'verified':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 font-semibold uppercase">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Verified
          </span>
        );
      case 'confirmed':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-300 text-indigo-800 uppercase font-semibold">
            <CheckCircle2 className="w-3 h-3 text-indigo-600" />
            Confirmed
          </span>
        );
      case 'investigating':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 uppercase font-semibold animate-pulse">
            Investigating
          </span>
        );
      case 'refuted':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-50 border border-rose-300 text-rose-800 uppercase font-semibold">
            <AlertOctagon className="w-3 h-3 text-rose-600" />
            Refuted
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 uppercase font-medium">
            <HelpCircle className="w-3 h-3 text-slate-500" />
            Proposed
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-white text-xs">
      <div className="p-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-sky-600" />
          <span className="font-semibold text-slate-800 tracking-wide uppercase text-[11px] font-mono">
            Hypothesis Board
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono tabular-nums font-semibold">
          {hypotheses.length} total
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {hypotheses.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-slate-400 text-[11px] font-mono">
            No hypotheses proposed yet
          </div>
        ) : (
          hypotheses.map((h) => (
            <div
              key={h.id}
              onClick={() => selectItem({ type: 'finding', id: h.id })}
              className="p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all cursor-pointer shadow-2xs group"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-mono text-sky-700 uppercase tracking-wider font-semibold">
                  {h.category.replace(/_/g, ' ')}
                </span>
                {getStatusBadge(h.status)}
              </div>

              <p className="text-slate-800 text-xs font-medium leading-relaxed mb-2.5">
                {h.statement}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px] text-slate-600 font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">CONFIDENCE</span>
                  <span className="text-slate-800 font-semibold tabular-nums">
                    {Math.round(h.confidence * 100)}%
                  </span>
                </div>

                {h.evidenceIds.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">CITATIONS:</span>
                    <span className="text-indigo-600 font-semibold">
                      {h.evidenceIds.length}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
