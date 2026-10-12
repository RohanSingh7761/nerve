import { NerveEvent } from '../types/events';

export interface SSEConnection {
  close: () => void;
}

export function subscribeToAnalysisEvents(
  analysisId: string,
  onEvent: (event: NerveEvent) => void,
  onDone?: (status: string) => void,
  onError?: (err: Event) => void
): SSEConnection {
  const url = `/api/analyses/${analysisId}/events`;
  const eventSource = new EventSource(url);

  const handleMessage = (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      if (e.type === 'done' || data.status === 'completed' || data.status === 'failed') {
        if (e.type === 'done') {
          onDone?.(data.status || 'completed');
          return;
        }
      }

      const nerveEvent: NerveEvent = {
        type: data.type || e.type,
        timestamp: data.ts || new Date().toISOString(),
        payload: data.payload || {},
      } as NerveEvent;

      onEvent(nerveEvent);
    } catch {
      // ignore parse errors on keepalive comments
    }
  };

  // Generic message handler
  eventSource.onmessage = handleMessage;

  // Specific event types dispatched by FastAPI EventSourceResponse
  const KNOWN_EVENT_TYPES = [
    'run_started',
    'agent_started',
    'agent_completed',
    'agent_failed',
    'agent_skipped',
    'agent_message',
    'tool_called',
    'tool_completed',
    'tool_failed',
    'tool_fallback',
    'hypothesis_proposed',
    'hypothesis_status_changed',
    'evidence_gathered',
    'finding_proposed',
    'finding_verified',
    'verifier_challenged',
    'provider_failover',
    'injection_defense_triggered',
    'score_computed',
    'report_ready',
    'run_completed',
    'run_failed',
  ];

  KNOWN_EVENT_TYPES.forEach((type) => {
    eventSource.addEventListener(type, handleMessage);
  });

  eventSource.addEventListener('done', (e) => {
    try {
      const parsed = JSON.parse(e.data);
      onDone?.(parsed.status);
    } catch {
      onDone?.('completed');
    }
    eventSource.close();
  });

  eventSource.onerror = (err) => {
    onError?.(err);
  };

  return {
    close: () => {
      eventSource.close();
    },
  };
}
