import React, { useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useNerveStore } from '../../state/store';
import { AgentNode } from '../graph/AgentNode';
import { MessageEdge } from '../graph/MessageEdge';
import { SynapseField } from '../graph/SynapseField';
import { AGENT_GRID_LAYOUT, DEFAULT_GRAPH_EDGES } from '../graph/layout';
import { AgentName } from '../../types/events';

import { TopBar } from './TopBar';
import { ActivityFeed } from './ActivityFeed';
import { HypothesisBoard } from './HypothesisBoard';
import { Inspector } from './Inspector';
import { Oscilloscope } from './Oscilloscope';
import { VerdictReveal } from './VerdictReveal';
import { Toasts } from './Toasts';
import { Activity, Lightbulb, Terminal, ChevronRight, ChevronLeft } from 'lucide-react';

interface LiveRunProps {
  onNavigateToReport?: () => void;
  onNavigateToFindings?: () => void;
}

const nodeTypes = {
  agentNode: AgentNode,
};

const edgeTypes = {
  messageEdge: MessageEdge,
};

export const LiveRun: React.FC<LiveRunProps> = ({
  onNavigateToReport,
  onNavigateToFindings,
}) => {
  const { demoMode, toggleDemoMode, togglePause, stepForward, selectedItem } = useNerveStore();
  const [activeTab, setActiveTab] = useState<'feed' | 'hypotheses' | 'inspector'>('feed');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Auto-switch to inspector tab when an item is selected
  useEffect(() => {
    if (selectedItem) {
      setActiveTab('inspector');
      if (sidebarCollapsed) setSidebarCollapsed(false);
    }
  }, [selectedItem]);

  // Global hotkeys (D for demo mode, Space for pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'd' || e.key === 'D') {
        toggleDemoMode();
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
      } else if (e.key === 'ArrowRight') {
        stepForward();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDemoMode, togglePause, stepForward]);

  // Build React Flow initial nodes
  const initialNodes: Node[] = useMemo(() => {
    return (Object.keys(AGENT_GRID_LAYOUT) as AgentName[]).map((agentKey) => ({
      id: agentKey,
      type: 'agentNode',
      position: AGENT_GRID_LAYOUT[agentKey],
      data: { id: agentKey },
    }));
  }, []);

  // Build React Flow initial edges
  const initialEdges: Edge[] = useMemo(() => {
    return DEFAULT_GRAPH_EDGES.map((ed) => ({
      id: ed.id,
      source: ed.source,
      target: ed.target,
      type: 'messageEdge',
      data: {
        dashed: ed.dashed,
        label: ed.label,
      },
    }));
  }, []);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex-1 flex flex-col h-full w-full min-h-0 bg-slate-50 overflow-hidden select-none">
      {/* Top Telemetry & Scrubber Bar */}
      <TopBar />

      {/* Main Workspace (Graph Canvas + Collapsible Right Sidebar) */}
      <div className="flex-1 flex min-h-0 relative w-full h-full overflow-hidden">
        {/* Graph Canvas Container */}
        <div className="flex-1 h-full relative overflow-hidden bg-slate-50">
          <SynapseField />

          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.5}
              maxZoom={1.75}
              proOptions={{ hideAttribution: true }}
              className="w-full h-full"
            >
              <Controls className="!bg-white !border-slate-200 !fill-slate-600 shadow-sm" />
              <Background color="#CBD5E1" gap={32} size={1} />
            </ReactFlow>
          </ReactFlowProvider>

          {/* Toggle sidebar button */}
          {!demoMode && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-sm"
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {sidebarCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Collapsible Right Sidebar (Hidden if demoMode or collapsed) */}
        {!demoMode && !sidebarCollapsed && (
          <aside className="w-96 h-full bg-white border-l border-slate-200 flex flex-col shrink-0 z-10 shadow-xs">
            {/* Sidebar Tab Strip */}
            <div className="h-10 border-b border-slate-200 flex items-center px-2 gap-1 shrink-0 bg-slate-50/70">
              <button
                onClick={() => setActiveTab('feed')}
                className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 text-xs font-mono font-medium transition-colors cursor-pointer ${
                  activeTab === 'feed'
                    ? 'bg-white text-indigo-700 border border-slate-300 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Live Feed</span>
              </button>

              <button
                onClick={() => setActiveTab('hypotheses')}
                className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 text-xs font-mono font-medium transition-colors cursor-pointer ${
                  activeTab === 'hypotheses'
                    ? 'bg-white text-sky-700 border border-slate-300 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Hypotheses</span>
              </button>

              <button
                onClick={() => setActiveTab('inspector')}
                className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 text-xs font-mono font-medium transition-colors cursor-pointer ${
                  activeTab === 'inspector'
                    ? 'bg-white text-amber-700 border border-slate-300 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Inspector</span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'feed' && <ActivityFeed />}
              {activeTab === 'hypotheses' && <HypothesisBoard />}
              {activeTab === 'inspector' && <Inspector />}
            </div>
          </aside>
        )}
      </div>

      {/* Bottom Oscilloscope Strip */}
      <Oscilloscope />

      {/* Overlays */}
      <Toasts />
      <VerdictReveal
        onNavigateToReport={onNavigateToReport}
        onNavigateToFindings={onNavigateToFindings}
      />
    </div>
  );
};
