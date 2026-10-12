import React, { useState } from 'react';
import { useNerveStore } from '../../state/store';
import { NerveEvent } from '../../types/events';
import { AGENT_PALETTE } from '../../motion/tokens';
import { Activity, Wrench, MessageSquare, Lightbulb, ShieldAlert, CheckCircle } from 'lucide-react';

export const ActivityFeed: React.FC = () => {
  const events = useNerveStore((state) => state.eventsFeed);
  const selectItem = useNerveStore((state) => state.selectItem);
  const [filter, setFilter] = useState<'all' | 'agent' | 'tool' | 'hypothesis' | 'finding'>('all');

  const filteredEvents = events.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'agent') return e.type.startsWith('agent_');
    if (filter === 'tool') return e.type.startsWith('tool_');
    if (filter === 'hypothesis') return e.type.startsWith('hypothesis_');
    if (filter === 'finding') return e.type.startsWith('finding_') || e.type.startsWith('verifier_');
    return true;
  });

  const getEventIcon = (event: NerveEvent) => {
    if (event.type.startsWith('tool_')) return <Wrench className="w-3.5 h-3.5 text-indigo-600" />;
    if (event.type === 'agent_message') return <MessageSquare className="w-3.5 h-3.5 text-purple-600" />;
    if (event.type.startsWith('hypothesis_')) return <Lightbulb className="w-3.5 h-3.5 text-sky-600" />;
    if (event.type === 'finding_verified') return <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />;
    if (event.type.startsWith('finding_')) return <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />;
    return <Activity className="w-3.5 h-3.5 text-slate-400" />;
  };

  const getEventDescription = (event: NerveEvent): string => {
    const p = event.payload as any;
    switch (event.type) {
      case 'run_started':
        return `Started analysis on ${p.filename || 'APK'}`;
      case 'agent_started':
        return `${p.agent}: ${p.note || 'started'}`;
      case 'agent_completed':
        return `${p.agent}: ${p.summary || 'completed'}`;
      case 'agent_message':
        return `${p.from} → ${p.to}: "${p.summary}"`;
      case 'tool_called':
        return `${p.agent} called tool ${p.tool} (${p.args_summary})`;
      case 'tool_fallback':
        return `Fallback: ${p.from_tool} → ${p.to_tool}`;
      case 'tool_completed':
        return `Tool completed in ${p.duration_ms}ms`;
      case 'hypothesis_proposed':
        return `Hypothesis [${p.id}]: ${p.statement}`;
      case 'hypothesis_status_changed':
        return `Hypothesis [${p.id}] marked ${p.to_status}`;
      case 'finding_proposed':
        return `Finding: ${p.title} (${p.severity})`;
      case 'finding_verified':
        return `Verified finding [${p.id}]: ${p.verification}`;
      case 'verifier_challenged':
        return `Verifier challenged: ${p.reason}`;
      case 'provider_failover':
        return `Provider failover: ${p.from_provider} → ${p.to_provider}`;
      case 'injection_defense_triggered':
        return `Neutralized prompt injection in ${p.location}`;
      case 'score_computed':
        return `Computed risk score: ${p.risk_score} (${p.verdict})`;
      case 'report_ready':
        return `Generated ${p.kind} report`;
      case 'run_completed':
        return `Run completed with verdict: ${p.verdict} (score: ${p.risk_score})`;
      default:
        return event.type;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white select-none text-xs">
      {/* Header & Filter pills */}
      <div className="p-3 border-b border-slate-200 flex flex-col gap-2 shrink-0 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800 tracking-wide uppercase text-[11px] font-mono">
            Live Synaptic Feed
          </span>
          <span className="text-[10px] text-slate-500 font-mono tabular-nums font-semibold">
            {events.length} events
          </span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
          {(['all', 'agent', 'tool', 'hypothesis', 'finding'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-colors shrink-0 cursor-pointer ${
                filter === f
                  ? 'bg-indigo-50 border border-indigo-300 text-indigo-700 font-semibold'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-100">
        {filteredEvents.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-slate-400 text-[11px] font-mono">
            Waiting for analysis events...
          </div>
        ) : (
          filteredEvents.map((ev, idx) => {
            const agentName = (ev.payload as any)?.agent || (ev.payload as any)?.from;
            const agentColor = agentName ? (AGENT_PALETTE as any)[agentName] : undefined;

            return (
              <div
                key={idx}
                onClick={() => {
                  if (agentName) selectItem({ type: 'agent', id: agentName });
                }}
                className="pt-1.5 first:pt-0 group flex items-start gap-2 hover:bg-slate-50 p-1.5 rounded transition-colors cursor-pointer"
              >
                <div className="mt-0.5 shrink-0">{getEventIcon(ev)}</div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span
                      className="font-mono text-[10px] uppercase font-bold"
                      style={{ color: agentColor || '#475569' }}
                    >
                      {agentName || ev.type.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-[9px] text-slate-400 tabular-nums">
                      {ev.timestamp.split('T')[1]?.slice(0, 8) || ev.timestamp}
                    </span>
                  </div>

                  <p className="text-slate-700 text-[11px] leading-relaxed break-words">
                    {getEventDescription(ev)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
