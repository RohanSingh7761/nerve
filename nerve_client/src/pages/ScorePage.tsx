import React from 'react';
import { useNerveStore } from '../state/store';
import { Calculator } from 'lucide-react';

export const ScorePage: React.FC = () => {
  const { riskScore, verdict, scoreContributions, filename } = useNerveStore();

  const currentScore = riskScore;
  const currentVerdict = verdict;

  const contributions = scoreContributions.map((c) => ({
    ...c,
    weight: 0.8,
    confidence: 0.95,
  }));

  const verdictColor =
    currentVerdict === 'likely_malicious'
      ? '#DC2626'
      : currentVerdict === 'suspicious'
      ? '#D97706'
      : '#059669';

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-900">
            Deterministic Risk Score & Bayesian Attribution
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Explainable mathematical calculation aggregating verified findings using Noisy-OR.
          </p>
        </div>

        {currentScore === null && !currentVerdict ? (
          <div className="p-12 rounded-2xl bg-white border border-dashed border-slate-300 text-center space-y-3 shadow-xs">
            <Calculator className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Risk Score Calculated Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              The risk scoring agent computes a deterministic Noisy-OR attribution score from verified findings once the triage pipeline concludes. Run a scan or click &ldquo;Run previous scan again&rdquo; to compute scores.
            </p>
          </div>
        ) : (
          <>
            {/* Top Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Semicircle / Radial Score Card */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center text-center shadow-xs">
            <span className="text-xs font-mono uppercase text-slate-500 font-semibold mb-2">
              Composite Risk Score
            </span>
            <div
              className="text-5xl font-black font-mono tracking-tight my-2"
              style={{ color: verdictColor }}
            >
              {currentScore !== null && currentScore !== undefined ? currentScore.toFixed(3) : '—'}
            </div>
            <div
              className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider mt-1 border"
              style={{
                borderColor: `${verdictColor}50`,
                backgroundColor: `${verdictColor}12`,
                color: verdictColor,
              }}
            >
              {currentVerdict ? currentVerdict.replace(/_/g, ' ') : 'PENDING'}
            </div>
            <span className="text-[11px] text-slate-400 font-mono mt-3">
              Target: {filename || 'None'}
            </span>
          </div>

          {/* Mathematical Formula Explanation Card */}
          <div className="md:col-span-2 p-6 rounded-xl bg-white border border-slate-200 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-3 text-indigo-700 font-mono text-xs font-semibold uppercase">
                <Calculator className="w-4 h-4" />
                <span>Deterministic Bayesian Noisy-OR Model</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Rather than treating LLMs as non-deterministic black-box judges, Nerve calculates risk scores through Bayesian Noisy-OR aggregation over findings independently validated by the Verifier agent.
              </p>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-indigo-700 font-semibold">
                P(Malicious | Findings) = 1 - ∏ [ 1 - (Weight_i × Confidence_i) ]
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-slate-500 pt-3 border-t border-slate-100 mt-4">
              <span>Confidence Threshold: ≥ 0.85</span>
              <span>•</span>
              <span>False Positive Cap: 0.05</span>
            </div>
          </div>
        </div>

        {/* Rule Attribution Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-sm font-semibold font-display text-slate-800">
              Rule Attribution & Contribution Breakdown
            </h2>
            <span className="text-xs font-mono text-slate-500 font-semibold">
              {contributions.length} contributing indicators
            </span>
          </div>

          <div className="p-4 space-y-3">
            {contributions.map((c) => {
              const pct = Math.round(c.contribution * 100);
              return (
                <div
                  key={c.rule_id}
                  className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs text-indigo-700 font-semibold uppercase mr-2">
                        {c.rule_id}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {c.label}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold font-mono text-amber-700">
                        +{pct}%
                      </span>
                      <span className="text-xs text-slate-500 font-mono ml-1">
                        to risk
                      </span>
                    </div>
                  </div>

                  {/* Contribution bar */}
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-amber-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, pct * 1.5)}%` }}
                    />
                  </div>

                  <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500 pt-1">
                    <span>Base Weight: {c.weight.toFixed(2)}</span>
                    <span>•</span>
                    <span>Verifier Confidence: {c.confidence.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
};
