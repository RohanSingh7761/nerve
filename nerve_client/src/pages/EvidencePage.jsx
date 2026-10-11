import { useState } from 'react';
import { ShieldCheck, Paperclip, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';

export default function EvidencePage() {
  const { findings, hypotheses, openArtifactDrawer } = useAnalysis();
  const [filter, setFilter] = useState('all');

  const filteredFindings = findings.filter((f) => {
    if (filter === 'verified') return f.verification === 'verified';
    if (filter === 'unverified') return f.verification !== 'verified';
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Verified Claims Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <span>Verified Claims & Evidence Entailment</span>
            </h2>
            <p className="text-xs text-slate-500">
              Findings independently vetted against raw decompiled APK artifacts by the Verifier Agent
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-lg text-xs self-start sm:self-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({findings.length})
            </button>
            <button
              onClick={() => setFilter('verified')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filter === 'verified'
                  ? 'bg-white text-emerald-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Verified ({findings.filter((f) => f.verification === 'verified').length})
            </button>
            <button
              onClick={() => setFilter('unverified')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filter === 'unverified'
                  ? 'bg-white text-rose-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              Unverified ({findings.filter((f) => f.verification !== 'verified').length})
            </button>
          </div>
        </div>

        {filteredFindings.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            No claims matching filter criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFindings.map((f) => {
              const isVerified = f.verification === 'verified';
              return (
                <div
                  key={f.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 text-sm">{f.title}</h3>
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                          isVerified
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {isVerified ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>VERIFIED</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>UNVERIFIED</span>
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                      {f.claim}
                    </p>

                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <strong className="text-slate-700">Verifier Entailment:</strong>{' '}
                      {f.verifier_notes || 'Pending formal proof'}
                    </div>
                  </div>

                  {/* Evidence Artifact Chips */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Cited Evidence Tokens:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {f.evidence_ids && f.evidence_ids.length > 0 ? (
                        f.evidence_ids.map((eid) => (
                          <button
                            key={eid}
                            onClick={() => openArtifactDrawer(eid)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 transition cursor-pointer"
                          >
                            <Paperclip className="w-3 h-3 text-slate-400" />
                            <span>[E-{eid}]</span>
                          </button>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">No artifact tokens cited</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Static Behavior Hypotheses Section */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <span>Behavioral Hypotheses Formulated by Static Agent</span>
          </h2>
          <p className="text-xs text-slate-500">
            Initial suspected malicious behaviors synthesized prior to verification pass
          </p>
        </div>

        {hypotheses.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            No hypotheses generated yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hypotheses.map((h) => (
              <div
                key={h.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {h.category?.toUpperCase() || 'HYPOTHESIS'}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    Conf: {(h.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-slate-700 font-medium">{h.statement}</p>
                <div className="text-[11px] text-slate-400">
                  MITRE ATT&CK: <strong className="text-slate-600 font-mono">{h.attack_technique || 'N/A'}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
