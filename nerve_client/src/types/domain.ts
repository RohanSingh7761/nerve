import { AgentName, MessageKind, NerveEvent } from './events';

export type AgentStateStatus = 'idle' | 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface AgentInfo {
  name: AgentName;
  displayName: string;
  role: string;
  color: string;
  status: AgentStateStatus;
  note: string;
  tier?: 'triage' | 'strong' | 'verify';
  runCount: number;
  activeHypotheses: string[];
  tokensIn: number;
  tokensOut: number;
  error?: string;
  lastActiveTs?: string;
}

export interface ToolCallState {
  id: string;
  agent: AgentName;
  tool: string;
  argsSummary: string;
  status: 'running' | 'succeeded' | 'failed' | 'timeout' | 'cached';
  durationMs?: number;
  error?: string;
  isFallback?: boolean;
  fallbackTo?: string;
}

export interface MessageParticleItem {
  id: string;
  from: AgentName;
  to: AgentName;
  kind: MessageKind;
  summary: string;
  startedAt: number;
  durationMs: number;
}

export interface HypothesisItem {
  id: string;
  category: string;
  statement: string;
  confidence: number;
  status: 'proposed' | 'investigating' | 'confirmed' | 'refuted' | 'inconclusive' | 'verified' | 'unsupported';
  evidenceIds: string[];
}

export interface FindingItem {
  id: string;
  hypothesisId: string;
  title: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  ruleId?: string;
  verification?: 'verified' | 'unsupported' | 'contradicted';
  verificationNotes?: string;
  evidenceIds: string[];
}

export interface ArtifactItem {
  short_id: string;
  kind: string;
  location: string;
  flags: string[];
  content?: string;
  content_sha256?: string;
}

export interface ScoreContribution {
  rule_id: string;
  label: string;
  contribution: number;
}

export interface AnalysisSummary {
  id: string;
  sha256: string;
  filename: string;
  size_bytes: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  variant: string;
  llm_provider?: string;
  verdict?: 'low_risk' | 'suspicious' | 'likely_malicious';
  risk_score?: number;
  confidence?: number;
  limited_visibility?: boolean;
  created_at: string;
}

export interface LiveRunState {
  analysisId: string | null;
  sha256: string;
  filename: string;
  isMock: boolean;
  isLive: boolean;
  isPaused: boolean;
  speed: number;
  demoMode: boolean;
  status: 'idle' | 'running' | 'completed' | 'failed';
  verdict?: 'low_risk' | 'suspicious' | 'likely_malicious';
  riskScore?: number;
  tokensUsed: number;
  maxTokens: number;
  actualCostUsd: number;
  referenceCostUsd: number;
  iteration: number;
  maxIterations: number;
  currentProvider: string;
  currentModel: string;
  fallbackChain: string[];
  providerFailoverEvent?: { from: string; to: string; reason: string; ts: number };
  agents: Record<AgentName, AgentInfo>;
  tools: ToolCallState[];
  messages: { id: string; from: AgentName; to: AgentName; kind: MessageKind; summary: string; ts: string }[];
  particles: MessageParticleItem[];
  hypotheses: HypothesisItem[];
  findings: FindingItem[];
  artifacts: ArtifactItem[];
  scoreContributions: ScoreContribution[];
  reportsReady: { executive: boolean; technical: boolean };
  toasts: { id: string; title: string; desc: string; type: 'info' | 'warning' | 'danger' | 'success'; ts: number }[];
  eventsFeed: NerveEvent[];
  selectedItem: { type: 'agent' | 'edge' | 'artifact' | 'finding'; id: string } | null;
}
