import React, { useState } from 'react';
import { useNerveStore } from '../state/store';
import { MOCK_ARTIFACTS } from '../mock/artifacts';
import {
  ShieldCheck,
  FileCode,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

export const FindingsPage: React.FC = () => {
  const { findings, artifacts } = useNerveStore();
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  const availableArtifacts = artifacts;
  const activeArtifact = availableArtifacts.find((a) => a.short_id === selectedArtifactId);

  const displayFindings = findings;

  const filtered = displayFindings.filter((f) => {
    if (filterSeverity === 'all') return true;
    return f.severity === filterSeverity;
  });

  const copySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-slate-50 overflow-hidden text-slate-800">
      {/* Findings List View */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold font-display text-slate-900">
              Verified Security Findings
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Zero-trust adversarial findings audited by the Verifier agent.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">SEVERITY:</span>
            {['all', 'critical', 'high', 'medium'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterSeverity(s)}
                className={`px-2.5 py-1 rounded text-xs font-mono uppercase transition-colors cursor-pointer ${
                  filterSeverity === s
                    ? 'bg-indigo-50 border border-indigo-300 text-indigo-700 font-semibold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {displayFindings.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white border border-dashed border-slate-300 text-center space-y-3 shadow-xs">
            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Security Findings Recorded Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Run a triage scan or click &ldquo;Run previous scan again&rdquo; to populate candidate hypotheses, verifier evaluations, and decompiled code evidence.
            </p>
          </div>
        ) : (
          /* Findings Table */
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="grid grid-cols-12 gap-3 p-3.5 border-b border-slate-200 text-[11px] font-mono text-slate-500 uppercase bg-slate-50 font-semibold">
            <div className="col-span-2">ID / Severity</div>
            <div className="col-span-6">Finding Title</div>
            <div className="col-span-2">Verifier Status</div>
            <div className="col-span-2 text-right">Evidence Citations</div>
          </div>

          <div className="divide-y divide-slate-100">
            {filtered.map((f) => (
              <div
                key={f.id}
                className="grid grid-cols-12 gap-3 p-4 items-center hover:bg-slate-50/70 transition-colors"
              >
                <div className="col-span-2 flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold border ${
                      f.severity === 'critical'
                        ? 'bg-rose-50 border-rose-300 text-rose-700'
                        : f.severity === 'high'
                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    }`}
                  >
                    {f.severity}
                  </span>
                  <span className="font-mono text-xs text-slate-500">{f.id}</span>
                </div>

                <div className="col-span-6">
                  <h3 className="font-semibold text-sm text-slate-800 leading-snug">
                    {f.title}
                  </h3>
                  {f.verificationNotes && (
                    <p className="text-xs text-slate-500 mt-1 font-sans">
                      {f.verificationNotes}
                    </p>
                  )}
                </div>

                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-50 border border-emerald-300 text-emerald-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{f.verification || 'VERIFIED'}</span>
                  </span>
                </div>

                <div className="col-span-2 flex justify-end gap-1.5 flex-wrap">
                  {f.evidenceIds.map((artId) => (
                    <button
                      key={artId}
                      onClick={() => setSelectedArtifactId(artId)}
                      className="px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-indigo-700 font-mono text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>[{artId}]</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* Slide-out Evidence Drawer if an artifact is selected */}
      {activeArtifact && (
        <div className="w-full md:w-[480px] bg-white border-t md:border-t-0 md:border-l border-slate-200 p-5 flex flex-col shrink-0 overflow-y-auto shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-sky-600" />
              <span className="font-bold font-mono text-slate-800 text-sm">
                Evidence Artifact: [{activeArtifact.short_id}]
              </span>
            </div>
            <button
              onClick={() => setSelectedArtifactId(null)}
              className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded bg-slate-100 border border-slate-200"
            >
              Close
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
                Location
              </span>
              <div className="p-2 rounded bg-slate-50 border border-slate-200 font-mono text-slate-800">
                {activeArtifact.location}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
                Flags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {activeArtifact.flags.map((flag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[10px] font-semibold"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  Decompiled Forensics
                </span>
                <button
                  onClick={() => copySnippet(activeArtifact.content || '')}
                  className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-600 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <pre className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-100 overflow-x-auto whitespace-pre leading-relaxed">
                <code>{activeArtifact.content}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
