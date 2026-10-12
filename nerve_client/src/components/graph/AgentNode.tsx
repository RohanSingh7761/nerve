import React, { useMemo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { AgentInfo } from '../../types/domain';
import { useNerveStore } from '../../state/store';
import { ToolChips } from './ToolChips';
import { ShieldCheck, Cpu, AlertCircle, CheckCircle2 } from 'lucide-react';

export const AgentNode: React.FC<NodeProps> = ({ id, selected }) => {
  const agent = useNerveStore((state) => state.agents[id as AgentInfo['name']]);
  const allTools = useNerveStore((state) => state.tools);
  const selectItem = useNerveStore((state) => state.selectItem);

  const tools = useMemo(() => {
    return allTools.filter((t) => t.agent === id);
  }, [allTools, id]);

  if (!agent) return null;

  const isRunning = agent.status === 'running';
  const isSucceeded = agent.status === 'succeeded';
  const isFailed = agent.status === 'failed';
  const isSelected = selected;

  const tierColors: Record<string, string> = {
    triage: 'bg-slate-100 text-slate-700 border-slate-300',
    strong: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    verify: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <div
      onClick={() => selectItem({ type: 'agent', id: agent.name })}
      className={`relative w-[240px] rounded-xl p-3.5 transition-all duration-300 cursor-pointer select-none bg-white border ${
        isSelected
          ? 'ring-2 ring-indigo-500 border-transparent shadow-lg'
          : isRunning
          ? 'border-transparent shadow-md'
          : 'border-slate-200 hover:border-slate-300 shadow-sm'
      }`}
      style={{
        boxShadow: isRunning
          ? `0 0 16px ${agent.color}35, 0 4px 12px rgba(0,0,0,0.06)`
          : undefined,
        borderColor: isRunning ? agent.color : undefined,
      }}
    >
      {/* React Flow Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!w-2.5 !h-2.5 !bg-slate-300 !border-white -left-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!w-2.5 !h-2.5 !bg-slate-300 !border-white -right-1.5"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="!w-2.5 !h-2.5 !bg-slate-300 !border-white -top-1.5"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="!w-2.5 !h-2.5 !bg-slate-300 !border-white -bottom-1.5"
      />

      {/* Top row: Agent Name, Tier Badge, Status Indicator */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform duration-300"
            style={{
              backgroundColor: agent.color,
              boxShadow: isRunning ? `0 0 6px ${agent.color}` : 'none',
              transform: isRunning ? 'scale(1.2)' : 'scale(1)',
            }}
          />
          <span className="font-semibold text-[13px] text-slate-800 truncate tracking-tight">
            {agent.displayName}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {agent.tier && (
            <span
              className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                tierColors[agent.tier] || tierColors.triage
              }`}
            >
              {agent.tier}
            </span>
          )}

          {agent.runCount > 1 && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold">
              x{agent.runCount}
            </span>
          )}
        </div>
      </div>

      {/* Role description */}
      <div className="text-[11px] text-slate-500 line-clamp-1 mb-2 leading-relaxed">
        {agent.role}
      </div>

      {/* Live Note / Pulse indicator */}
      <div
        className={`rounded-md p-2 text-[11px] font-mono leading-tight transition-colors ${
          isRunning
            ? 'bg-indigo-50/70 text-indigo-900 border border-indigo-200'
            : isFailed
            ? 'bg-rose-50 text-rose-800 border border-rose-200'
            : isSucceeded
            ? 'bg-slate-50 text-slate-700 border border-slate-200'
            : 'bg-slate-50/60 text-slate-500 border border-slate-100'
        }`}
      >
        <div className="flex items-start gap-1.5">
          {isRunning && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping mt-1 shrink-0" />
          )}
          {isSucceeded && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          )}
          {isFailed && (
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="break-words line-clamp-2">
            {agent.note}
          </span>
        </div>
      </div>

      {/* Docked Tools */}
      <ToolChips tools={tools} />

      {/* Footer: Token usage telemetry if available */}
      {(agent.tokensIn > 0 || agent.tokensOut > 0) && (
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-2 pt-1.5 border-t border-slate-100">
          <span>TOKENS</span>
          <span className="tabular-nums text-slate-700 font-semibold">
            {((agent.tokensIn + agent.tokensOut) / 1000).toFixed(1)}k
          </span>
        </div>
      )}
    </div>
  );
};
