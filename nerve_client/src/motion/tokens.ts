import { AgentName, MessageKind } from '../types/events';

export const MOTION_TOKENS = {
  nodeHaloPulse: 1.6,
  orbitingSpark: 2.2,
  particleTravelMinMs: 700,
  particleTravelMaxMs: 1100,
  edgeCooldownMs: 3000,
  fanOutStaggerMs: 120,
  toolChipSpring: { stiffness: 420, damping: 26 },
  fallbackArrowDrawMs: 500,
  verdictStampSpring: { stiffness: 500, damping: 22 },
  failureShakeMs: 400,
  counterTickMs: 600,
  gaugeSweepMs: 1200,
  feedRowEnterMs: 180,
} as const;

export const VERDICT_STAMP_SPRING = MOTION_TOKENS.verdictStampSpring;
export const PARTICLE_TRAVEL_MIN_MS = MOTION_TOKENS.particleTravelMinMs;

export const AGENT_PALETTE: Record<AgentName, string> = {
  intake: '#64748B',
  orchestrator: '#4F46E5',
  static: '#0284C7',
  reverse_eng: '#059669',
  threat_intel: '#E11D48',
  verifier: '#D97706',
  scoring: '#EA580C',
  report: '#7C3AED',
};

export const MESSAGE_KIND_COLORS: Record<MessageKind, string> = {
  handoff: '#4F46E5',
  request: '#0284C7',
  evidence: '#059669',
  challenge: '#D97706',
  fallback: '#EA580C',
  resolution: '#7C3AED',
};
