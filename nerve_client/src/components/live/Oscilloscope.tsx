import React, { useEffect, useState } from 'react';
import { useNerveStore } from '../../state/store';
import { AGENT_PALETTE } from '../../motion/tokens';
import { AgentName } from '../../types/events';

export const Oscilloscope: React.FC = () => {
  const agents = useNerveStore((state) => state.agents);
  const status = useNerveStore((state) => state.status);
  const isRunning = status === 'running';

  // Tick generator for oscilloscope animation
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setPhase((p) => (p + 1) % 100);
    }, 80);
    return () => clearInterval(interval);
  }, [isRunning]);

  const agentKeys = Object.keys(agents) as AgentName[];

  return (
    <div className="h-12 bg-slate-50 border-t border-slate-200 flex items-center px-4 gap-4 select-none shrink-0 z-10 overflow-hidden shadow-2xs">
      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 uppercase shrink-0 font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>Synaptic Oscilloscope</span>
      </div>

      <div className="flex-1 grid grid-cols-8 gap-2 h-7 items-center">
        {agentKeys.map((agentKey) => {
          const agent = agents[agentKey];
          const color = AGENT_PALETTE[agentKey];
          const active = agent.status === 'running';

          return (
            <div
              key={agentKey}
              className={`h-full rounded px-2 flex items-center justify-between border transition-all ${
                active
                  ? 'bg-indigo-50 border-indigo-300 shadow-2xs'
                  : 'bg-white border-slate-200 opacity-80'
              }`}
            >
              <span
                className="text-[9px] font-mono uppercase truncate font-bold"
                style={{ color }}
              >
                {agentKey.slice(0, 7)}
              </span>

              {/* Mini signal waveform */}
              <div className="w-12 h-3 flex items-center justify-end overflow-hidden">
                {active ? (
                  <svg className="w-full h-full" viewBox="0 0 50 12">
                    <path
                      d={`M 0 6 Q 10 ${phase % 2 === 0 ? 1 : 11}, 20 6 T 40 ${
                        phase % 2 === 0 ? 11 : 1
                      } T 50 6`}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.5}
                      className="animate-pulse"
                    />
                  </svg>
                ) : (
                  <div
                    className="w-full h-0.5 rounded opacity-40"
                    style={{ backgroundColor: color }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
