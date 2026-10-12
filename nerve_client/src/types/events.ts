export type AgentName =
  | 'intake'
  | 'orchestrator'
  | 'static'
  | 'reverse_eng'
  | 'threat_intel'
  | 'verifier'
  | 'scoring'
  | 'report';

export type MessageKind = 'handoff' | 'challenge' | 'response' | 'resolution';

export type NerveEvent = { id: number; ts: string; analysis_id: string } & (
  | { type: 'analysis_started' }
  | { type: 'agent_started'; agent: AgentName; run_id: string; tier?: 'triage' | 'strong' | 'verify'; hypothesis_id?: string; iteration: number }
  | { type: 'agent_progress'; agent: AgentName; run_id: string; note: string }
  | { type: 'agent_finished'; agent: AgentName; run_id: string; status: 'succeeded' | 'failed' | 'skipped'; duration_ms: number; error?: string }
  | { type: 'message_sent'; from: AgentName; to: AgentName; kind: MessageKind; summary: string; payload_ref?: string }
  | { type: 'tool_started'; agent: AgentName; call_id: string; tool: string; args_summary: string }
  | { type: 'tool_finished'; agent: AgentName; call_id: string; tool: string; status: 'succeeded' | 'failed' | 'timeout' | 'cached'; duration_ms: number; error?: string }
  | { type: 'fallback_used'; agent: AgentName; from_tool: string; to_tool: string; reason: string }
  | { type: 'llm_call'; agent: AgentName; run_id: string; provider: string; model: string; status: 'ok' | 'rate_limited' | 'provider_error' | 'timeout' | 'json_invalid' | 'repaired'; tokens_in: number; tokens_out: number; latency_ms: number }
  | { type: 'provider_failover'; from_provider: string; to_provider: string; reason: string }
  | { type: 'hypothesis_created'; hypothesis: { id: string; category: string; statement: string; confidence: number } }
  | { type: 'hypothesis_status'; id: string; status: 'proposed' | 'investigating' | 'confirmed' | 'refuted' | 'inconclusive' | 'verified' | 'unsupported' }
  | { type: 'artifact_created'; artifact: { short_id: string; kind: string; location: string; flags: string[] } }
  | { type: 'finding_created'; finding: { id: string; hypothesis_id: string; title: string; severity: 'info' | 'low' | 'medium' | 'high' | 'critical'; rule_id?: string } }
  | { type: 'finding_verified'; finding_id: string; verification: 'verified' | 'unsupported' | 'contradicted'; notes: string }
  | { type: 'injection_flagged'; artifact_short_id: string; pattern: string }
  | { type: 'budget_update'; tokens_used: number; max_tokens: number; actual_cost_usd: number; reference_cost_usd: number; iteration: number; max_iterations: number }
  | { type: 'score_updated'; score: number; verdict: 'low_risk' | 'suspicious' | 'likely_malicious'; contributions: { rule_id: string; label: string; contribution: number }[] }
  | { type: 'report_ready'; kind: 'executive' | 'technical' }
  | { type: 'analysis_finished'; status: 'completed' | 'failed'; verdict?: string; risk_score?: number }
);
