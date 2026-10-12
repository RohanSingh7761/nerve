import { NerveEvent } from '../types/events';
import { LiveRunState, ToolCallState, HypothesisItem, FindingItem, ArtifactItem } from '../types/domain';

export function applyEvent(state: LiveRunState, event: NerveEvent): LiveRunState {
  const nextEventsFeed = [event, ...state.eventsFeed.slice(0, 199)];

  switch (event.type) {
    case 'run_started': {
      return {
        ...state,
        analysisId: event.payload.analysis_id,
        sha256: event.payload.sha256,
        filename: event.payload.filename || state.filename,
        currentProvider: event.payload.llm_provider || state.currentProvider,
        status: 'running',
        eventsFeed: nextEventsFeed,
      };
    }

    case 'agent_started': {
      const agent = state.agents[event.payload.agent];
      if (!agent) return { ...state, eventsFeed: nextEventsFeed };
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        agents: {
          ...state.agents,
          [event.payload.agent]: {
            ...agent,
            status: 'running',
            note: event.payload.note || `Starting execution...`,
            runCount: agent.runCount + 1,
            lastActiveTs: event.timestamp,
          },
        },
      };
    }

    case 'agent_completed': {
      const agent = state.agents[event.payload.agent];
      if (!agent) return { ...state, eventsFeed: nextEventsFeed };
      const tokensIn = (agent.tokensIn || 0) + (event.payload.tokens_in || 0);
      const tokensOut = (agent.tokensOut || 0) + (event.payload.tokens_out || 0);
      const addTokens = (event.payload.tokens_in || 0) + (event.payload.tokens_out || 0);

      return {
        ...state,
        tokensUsed: state.tokensUsed + addTokens,
        eventsFeed: nextEventsFeed,
        agents: {
          ...state.agents,
          [event.payload.agent]: {
            ...agent,
            status: 'succeeded',
            note: event.payload.summary || `Finished successfully`,
            tokensIn,
            tokensOut,
            lastActiveTs: event.timestamp,
          },
        },
      };
    }

    case 'agent_failed': {
      const agent = state.agents[event.payload.agent];
      if (!agent) return { ...state, eventsFeed: nextEventsFeed };
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        agents: {
          ...state.agents,
          [event.payload.agent]: {
            ...agent,
            status: 'failed',
            error: event.payload.error,
            note: `Failed: ${event.payload.error.slice(0, 48)}...`,
            lastActiveTs: event.timestamp,
          },
        },
        toasts: [
          {
            id: `err-${Date.now()}`,
            title: `${agent.displayName} Failed`,
            desc: event.payload.error,
            type: 'danger',
            ts: Date.now(),
          },
          ...state.toasts.slice(0, 5),
        ],
      };
    }

    case 'agent_skipped': {
      const agent = state.agents[event.payload.agent];
      if (!agent) return { ...state, eventsFeed: nextEventsFeed };
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        agents: {
          ...state.agents,
          [event.payload.agent]: {
            ...agent,
            status: 'skipped',
            note: event.payload.reason || 'Skipped by orchestrator',
          },
        },
      };
    }

    case 'agent_message': {
      const { from, to, kind, summary } = event.payload;
      const messageEntry = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        from,
        to,
        kind,
        summary,
        ts: event.timestamp,
      };

      const targetAgent = state.agents[to];
      const updatedAgents = targetAgent
        ? {
            ...state.agents,
            [to]: {
              ...targetAgent,
              note: `Received: ${summary}`,
            },
          }
        : state.agents;

      return {
        ...state,
        eventsFeed: nextEventsFeed,
        messages: [messageEntry, ...state.messages.slice(0, 49)],
        agents: updatedAgents,
      };
    }

    case 'tool_called': {
      const newTool: ToolCallState = {
        id: event.payload.call_id,
        agent: event.payload.agent,
        tool: event.payload.tool,
        argsSummary: event.payload.args_summary,
        status: 'running',
      };
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        tools: [newTool, ...state.tools.slice(0, 24)],
      };
    }

    case 'tool_completed': {
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        tools: state.tools.map((t) =>
          t.id === event.payload.call_id
            ? {
                ...t,
                status: (event.payload.cached ? 'cached' : 'succeeded') as ToolCallState['status'],
                durationMs: event.payload.duration_ms,
              }
            : t
        ),
      };
    }

    case 'tool_failed': {
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        tools: state.tools.map((t) =>
          t.id === event.payload.call_id
            ? {
                ...t,
                status: 'failed',
                error: event.payload.error,
              }
            : t
        ),
      };
    }

    case 'tool_fallback': {
      const { call_id, from_tool, to_tool, reason } = event.payload;
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        tools: state.tools.map((t) =>
          t.id === call_id
            ? {
                ...t,
                isFallback: true,
                fallbackTo: to_tool,
                error: reason,
              }
            : t
        ),
        toasts: [
          {
            id: `fallback-${Date.now()}`,
            title: `Tool Fallback: ${from_tool} → ${to_tool}`,
            desc: reason,
            type: 'warning',
            ts: Date.now(),
          },
          ...state.toasts.slice(0, 5),
        ],
      };
    }

    case 'hypothesis_proposed': {
      const hyp: HypothesisItem = {
        id: event.payload.id,
        category: event.payload.category,
        statement: event.payload.statement,
        confidence: event.payload.confidence,
        status: 'proposed',
        evidenceIds: [],
      };
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        hypotheses: [...state.hypotheses.filter((h) => h.id !== hyp.id), hyp],
      };
    }

    case 'hypothesis_status_changed': {
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        hypotheses: state.hypotheses.map((h) =>
          h.id === event.payload.id
            ? {
                ...h,
                status: event.payload.to_status,
                evidenceIds: event.payload.evidence_ids || h.evidenceIds,
              }
            : h
        ),
      };
    }

    case 'evidence_gathered': {
      const art: ArtifactItem = {
        short_id: event.payload.short_id,
        kind: event.payload.kind,
        location: event.payload.location,
        flags: event.payload.flags || [],
        content: event.payload.snippet,
      };
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        artifacts: [...state.artifacts.filter((a) => a.short_id !== art.short_id), art],
      };
    }

    case 'finding_proposed': {
      const finding: FindingItem = {
        id: event.payload.id,
        hypothesisId: event.payload.hypothesis_id,
        title: event.payload.title,
        severity: event.payload.severity,
        evidenceIds: event.payload.evidence_ids || [],
      };
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        findings: [...state.findings.filter((f) => f.id !== finding.id), finding],
      };
    }

    case 'finding_verified': {
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        findings: state.findings.map((f) =>
          f.id === event.payload.id
            ? {
                ...f,
                verification: event.payload.verification,
                verificationNotes: event.payload.notes,
              }
            : f
        ),
      };
    }

    case 'verifier_challenged': {
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        iteration: state.iteration + 1,
        toasts: [
          {
            id: `challenge-${Date.now()}`,
            title: `Verifier Challenged Finding`,
            desc: `Claim rejected: "${event.payload.reason}". Demanding additional decompile proof.`,
            type: 'warning',
            ts: Date.now(),
          },
          ...state.toasts.slice(0, 5),
        ],
      };
    }

    case 'provider_failover': {
      return {
        ...state,
        currentProvider: event.payload.to_provider,
        currentModel: event.payload.to_model,
        eventsFeed: nextEventsFeed,
        providerFailoverEvent: {
          from: event.payload.from_provider,
          to: event.payload.to_provider,
          reason: event.payload.reason,
          ts: Date.now(),
        },
        toasts: [
          {
            id: `failover-${Date.now()}`,
            title: `LLM Provider Failover`,
            desc: `${event.payload.from_provider} failed (${event.payload.reason}). Swapped live to ${event.payload.to_provider} (${event.payload.to_model}).`,
            type: 'warning',
            ts: Date.now(),
          },
          ...state.toasts.slice(0, 5),
        ],
      };
    }

    case 'injection_defense_triggered': {
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        toasts: [
          {
            id: `injection-${Date.now()}`,
            title: `Prompt Injection Blocked!`,
            desc: `Sanitizer neutralized exploit in ${event.payload.location}: "${event.payload.snippet}"`,
            type: 'danger',
            ts: Date.now(),
          },
          ...state.toasts.slice(0, 5),
        ],
      };
    }

    case 'score_computed': {
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        riskScore: event.payload.risk_score,
        verdict: event.payload.verdict,
        scoreContributions: event.payload.contributions || [],
      };
    }

    case 'report_ready': {
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        reportsReady: {
          ...state.reportsReady,
          [event.payload.kind]: true,
        },
      };
    }

    case 'run_completed': {
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        status: 'completed',
        verdict: event.payload.verdict,
        riskScore: event.payload.risk_score,
        actualCostUsd: event.payload.cost_usd ?? state.actualCostUsd,
      };
    }

    case 'run_failed': {
      return {
        ...state,
        eventsFeed: nextEventsFeed,
        status: 'failed',
        toasts: [
          {
            id: `fail-${Date.now()}`,
            title: `Analysis Run Halted`,
            desc: event.payload.error,
            type: 'danger',
            ts: Date.now(),
          },
          ...state.toasts.slice(0, 5),
        ],
      };
    }

    default:
      return { ...state, eventsFeed: nextEventsFeed };
  }
}
