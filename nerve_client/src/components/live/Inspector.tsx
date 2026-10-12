import React, { useState } from 'react';
import { useNerveStore } from '../../state/store';
import { AgentName } from '../../types/events';
import {
  X,
  Copy,
  Check,
  ShieldCheck,
  FileCode,
  Terminal,
  ExternalLink,
} from 'lucide-react';

export const Inspector: React.FC = () => {
  const { selectedItem, selectItem, agents, artifacts, findings, tools } =
    useNerveStore();
  const [copied, setCopied] = useState(false);

  if (!selectedItem) {
    return (
      <div className="flex flex-col h-full bg-white text-xs p-4 select-none">
        <span className="font-semibold text-slate-800 tracking-wide uppercase text-[11px] font-mono mb-4 pb-2 border-b border-slate-200">
          Inspector
        </span>
        <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 font-mono space-y-2">
          <Terminal className="w-8 h-8 text-slate-300 stroke-[1.5]" />
          <p className="text-slate-500 font-sans text-xs">Select an agent node, evidence artifact, or finding to inspect forensics.</p>
        </div>
      </div>
    );
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Inspecting an Agent
  if (selectedItem.type === 'agent') {
    const agent = agents[selectedItem.id as AgentName];
    if (!agent) return null;
    const agentTools = tools.filter((t) => t.agent === agent.name);

    return (
      <div className="flex flex-col h-full bg-white text-xs">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: agent.color }}
            />
            <span className="font-semibold text-slate-800 text-sm truncate font-display">
              {agent.displayName}
            </span>
          </div>
          <button
            onClick={() => selectItem(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
              Role & Purpose
            </span>
            <p className="text-slate-700 text-xs leading-relaxed">{agent.role}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 block mb-0.5">STATUS</span>
              <span className="text-slate-800 uppercase font-semibold">{agent.status}</span>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 block mb-0.5">RUN COUNT</span>
              <span className="text-slate-800 font-semibold">{agent.runCount}</span>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 block mb-0.5">TOKENS IN</span>
              <span className="text-slate-800 tabular-nums font-semibold">{agent.tokensIn.toLocaleString()}</span>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 block mb-0.5">TOKENS OUT</span>
              <span className="text-slate-800 tabular-nums font-semibold">{agent.tokensOut.toLocaleString()}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
              Current Activity Note
            </span>
            <div className="p-2.5 rounded bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-800 break-words">
              {agent.note}
            </div>
          </div>

          {agent.error && (
            <div>
              <span className="text-[10px] text-rose-600 uppercase font-mono block mb-1">
                Execution Error
              </span>
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 font-mono text-[11px] break-words">
                {agent.error}
              </div>
            </div>
          )}

          {agentTools.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1.5">
                Tool Execution History
              </span>
              <div className="space-y-1.5">
                {agentTools.map((t) => (
                  <div
                    key={t.id}
                    className="p-2 rounded bg-slate-50 border border-slate-200 text-[11px] font-mono"
                  >
                    <div className="flex items-center justify-between text-slate-800 mb-1">
                      <span className="font-semibold text-indigo-700">{t.tool}</span>
                      <span className="uppercase text-[9px] px-1 py-0.5 rounded bg-slate-200 text-slate-600 font-semibold">
                        {t.status}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[10px] truncate">{t.argsSummary}</p>
                    {t.durationMs && (
                      <span className="text-slate-400 text-[9px] block mt-1">
                        Execution time: {t.durationMs}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Inspecting an Artifact
  if (selectedItem.type === 'artifact') {
    const art = artifacts.find((a) => a.short_id === selectedItem.id);
    if (!art) return null;

    return (
      <div className="flex flex-col h-full bg-white text-xs">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2 min-w-0">
            <FileCode className="w-4 h-4 text-sky-600" />
            <span className="font-semibold text-slate-800 text-sm truncate font-mono">
              {art.short_id}
            </span>
          </div>
          <button
            onClick={() => selectItem(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
              Source Location
            </span>
            <div className="p-2 rounded bg-slate-50 border border-slate-200 text-slate-800 font-mono text-[11px]">
              {art.location}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1.5">
              Evidence Flags
            </span>
            <div className="flex flex-wrap gap-1">
              {art.flags.map((flag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-mono font-semibold"
                >
                  {flag}
                </span>
              ))}
            </div>
          </div>

          {art.content && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-mono">
                  Extracted Evidence Snippet
                </span>
                <button
                  onClick={() => handleCopy(art.content || '')}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-600 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-100 overflow-x-auto whitespace-pre leading-relaxed">
                <code>{art.content}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Inspecting a Finding
  if (selectedItem.type === 'finding') {
    const finding = findings.find((f) => f.id === selectedItem.id);
    if (!finding) return null;

    return (
      <div className="flex flex-col h-full bg-white text-xs">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-slate-800 text-sm truncate font-mono">
              {finding.id}
            </span>
          </div>
          <button
            onClick={() => selectItem(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
              Title
            </span>
            <p className="text-slate-900 text-sm font-semibold leading-relaxed">
              {finding.title}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 block mb-0.5">SEVERITY</span>
              <span className="text-amber-700 uppercase font-semibold">{finding.severity}</span>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 block mb-0.5">VERIFIER STATUS</span>
              <span className="text-emerald-700 uppercase font-semibold">
                {finding.verification || 'PENDING'}
              </span>
            </div>
          </div>

          {finding.verificationNotes && (
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
                Verifier Audit Notes
              </span>
              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
                {finding.verificationNotes}
              </div>
            </div>
          )}

          {finding.evidenceIds.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1.5">
                Supporting Evidence Citations
              </span>
              <div className="space-y-1.5">
                {finding.evidenceIds.map((artId) => (
                  <button
                    key={artId}
                    onClick={() => selectItem({ type: 'artifact', id: artId })}
                    className="w-full text-left p-2 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-indigo-700 font-mono text-xs flex items-center justify-between transition-colors"
                  >
                    <span>[{artId}]</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
