import { Terminal, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';

export default function TriagePage() {
  const { analysisData, activeNode, events } = useAnalysis();

  const AGENTS = [
    { id: 'intake', icon: '📥', name: 'Intake Agent', role: 'Hashes, APKiD & Unpack' },
    { id: 'orchestrator', icon: '🧭', name: 'Orchestrator', role: 'LangGraph Supervisor' },
    { id: 'static', icon: '🔎', name: 'Static Agent', role: 'Manifest & Permissions' },
    { id: 'reverse_eng', icon: '⚙️', name: 'Reverse Eng', role: 'Jadx Decompilation' },
    { id: 'threat_intel', icon: '🛡', name: 'Threat Intel', role: 'YARA & IOC Matches' },
    { id: 'verifier', icon: '⚖️', name: 'Verifier Agent', role: 'Entailment & Evidence' },
    { id: 'score', icon: '🎯', name: 'Risk Scoring', role: 'Deterministic Math' },
    { id: 'report', icon: '📝', name: 'Report Writer', role: 'Cited Technical Summary' },
  ];

  const isCompleted = analysisData?.status === 'completed';

  return (
    <div className="space-y-6">
      {/* Agents Grid Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Multi-Agent System Architecture</span>
            </h2>
            <p className="text-xs text-slate-500">
              Autonomous specialist agents operating with independent verification separation
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Graph State: <strong className="text-slate-800 font-bold uppercase">{activeNode}</strong>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {AGENTS.map((agent) => {
            const isActive = activeNode === agent.id;
            return (
              <div
                key={agent.id}
                className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                  isActive
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-2 ring-indigo-500/20'
                    : isCompleted
                    ? 'border-slate-200 bg-white hover:border-slate-300'
                    : 'border-slate-200 bg-white opacity-85'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">{agent.icon}</span>
                    {isActive ? (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : null}
                  </div>
                  <div className="font-semibold text-slate-900 text-xs mb-0.5">
                    {agent.name}
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-1">
                    {agent.role}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="uppercase font-mono">{agent.id}</span>
                  <span className={isActive ? 'text-indigo-600 font-semibold' : ''}>
                    {isActive ? 'Processing' : isCompleted ? 'Completed' : 'Standby'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live SSE Execution Events Terminal */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Live Agent Execution Stream (SSE)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {events.length} trace events captured
          </span>
        </div>

        <div className="p-4 bg-slate-50 max-h-96 overflow-y-auto font-mono text-xs space-y-2 border-inner">
          {events.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300 animate-pulse" />
              <span>Awaiting agent trace events from server...</span>
            </div>
          ) : (
            events.map((ev, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
              >
                <div className="flex items-center space-x-2.5 overflow-hidden">
                  <span className="text-[11px] text-slate-400 shrink-0">
                    [{ev.ts?.slice(11, 19) || new Date().toLocaleTimeString()}]
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                    {ev.type}
                  </span>
                  <span className="text-slate-700 truncate max-w-xl text-[11px]">
                    {typeof ev.payload === 'string'
                      ? ev.payload
                      : JSON.stringify(ev.payload || {})}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
