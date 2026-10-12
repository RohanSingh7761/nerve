import { AgentName } from '../../types/events';

export interface AgentNodeLayout {
  id: AgentName;
  position: { x: number; y: number };
}

export const AGENT_GRID_LAYOUT: Record<AgentName, { x: number; y: number }> = {
  intake: { x: 60, y: 180 },
  orchestrator: { x: 330, y: 260 },
  static: { x: 620, y: 90 },
  reverse_eng: { x: 620, y: 260 },
  threat_intel: { x: 620, y: 430 },
  verifier: { x: 920, y: 260 },
  scoring: { x: 1200, y: 160 },
  report: { x: 1200, y: 360 },
};

export interface DefaultEdgeDef {
  id: string;
  source: AgentName;
  target: AgentName;
  label?: string;
  dashed?: boolean;
}

export const DEFAULT_GRAPH_EDGES: DefaultEdgeDef[] = [
  { id: 'e-intake-orch', source: 'intake', target: 'orchestrator' },
  { id: 'e-orch-static', source: 'orchestrator', target: 'static' },
  { id: 'e-orch-rev', source: 'orchestrator', target: 'reverse_eng' },
  { id: 'e-orch-intel', source: 'orchestrator', target: 'threat_intel' },
  { id: 'e-static-rev', source: 'static', target: 'reverse_eng' },
  { id: 'e-static-ver', source: 'static', target: 'verifier' },
  { id: 'e-rev-ver', source: 'reverse_eng', target: 'verifier' },
  { id: 'e-intel-ver', source: 'threat_intel', target: 'verifier' },
  { id: 'e-ver-orch', source: 'verifier', target: 'orchestrator', dashed: true, label: 'loop' },
  { id: 'e-ver-rev', source: 'verifier', target: 'reverse_eng', dashed: true, label: 'challenge' },
  { id: 'e-ver-score', source: 'verifier', target: 'scoring' },
  { id: 'e-score-rep', source: 'scoring', target: 'report' },
];
