import { Shield } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';

export default function ScorePage() {
  const { scoreData } = useAnalysis();

  const getVerdictStyle = (verdict) => {
    switch (verdict) {
      case 'likely_malicious':
        return {
          bg: 'bg-rose-50',
          text: 'text-rose-700',
          border: 'border-rose-200',
          label: 'LIKELY MALICIOUS',
        };
      case 'suspicious':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-200',
          label: 'SUSPICIOUS',
        };
      case 'low_risk':
      default:
        return {
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          label: 'LOW RISK',
        };
    }
  };

  const score = scoreData?.risk_score || 0;
  const verdictInfo = getVerdictStyle(scoreData?.verdict);

  return (
    <div className="space-y-6">
      {/* Score Overview Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {/* Dial / Big Number */}
          <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Deterministic Risk Score
            </span>
            <div className="text-6xl font-extrabold text-slate-900 tracking-tight font-mono">
              {score}
              <span className="text-2xl text-slate-400 font-normal">/100</span>
            </div>
            <div className={`mt-4 px-3.5 py-1 rounded-full text-xs font-bold border ${verdictInfo.bg} ${verdictInfo.text} ${verdictInfo.border}`}>
              {verdictInfo.label}
            </div>
            <div className="text-xs text-slate-400 mt-3 font-mono">
              Mathematical Confidence: {((scoreData?.confidence || 0.5) * 100).toFixed(0)}%
            </div>
          </div>

          {/* Mathematical Guarantee Description */}
          <div className="md:col-span-2 space-y-3">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Shield className="w-3.5 h-3.5" />
              <span>Independent Noisy-OR Model Guarantee</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Explainable & Un-Hallucinated Mathematical Triage
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Unlike black-box LLM scoring prompts where the model invents arbitrary risk numbers, Nerve uses a strict <strong>Noisy-OR probabilistic combination rule</strong>. Only findings that successfully pass independent Verifier proof entailment are included in the score computation.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700">
              Risk = 100 × (1 - ∏ (1 - weight_i × verifier_conf_i))
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Verified Risk Contribution Breakdown
            </h3>
            <p className="text-xs text-slate-500">
              Individual mathematical rule contributions to final triage score
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {scoreData?.breakdown?.length || 0} evaluated rules
          </span>
        </div>

        {!scoreData?.breakdown || scoreData.breakdown.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No rule breakdowns available for this analysis.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="px-6 py-3">Rule Identifier</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">Weight (w)</th>
                  <th className="px-6 py-3">Verifier Conf (v)</th>
                  <th className="px-6 py-3 text-right">Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scoreData.breakdown.map((row) => (
                  <tr key={row.rule_id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-3 font-mono font-semibold text-indigo-700">
                      {row.rule_id}
                    </td>
                    <td className="px-6 py-3 text-slate-700">
                      {row.label}
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-600">
                      {row.weight}
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-600">
                      {(row.verification_confidence * 100).toFixed(0)}%
                    </td>
                    <td className="px-6 py-3 font-mono font-bold text-right text-rose-600">
                      +{row.contribution}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
