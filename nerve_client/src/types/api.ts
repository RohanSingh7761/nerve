export interface BackendConfig {
  active_provider: string;
  models: {
    triage: string;
    strong: string;
    verify: string;
  };
  usable_providers: string[];
  fallback_chain: string[];
  verifier_override_provider: string;
  intel_mode: 'offline' | 'online';
  toolchain_mode: 'full' | 'minimal';
  reference_prices: {
    in_per_1m: number;
    out_per_1m: number;
  };
}

export interface ScoreBreakdownRow {
  rule_id: string;
  label: string;
  weight: number;
  verification_confidence: number;
  contribution: number;
}

export interface EvalCompareMetrics {
  sample_count: number;
  v1: {
    accuracy: number;
    fpr: number;
    unsupported_claim_rate: number;
    avg_tokens: number;
    avg_reference_cost: number;
    avg_latency_s: number;
    injection_resistance_rate: number;
    recovery_success_rate: number;
  };
  v2: {
    accuracy: number;
    fpr: number;
    unsupported_claim_rate: number;
    avg_tokens: number;
    avg_reference_cost: number;
    avg_latency_s: number;
    injection_resistance_rate: number;
    recovery_success_rate: number;
  };
  samples: Array<{
    sha256: string;
    family: string;
    ground_truth: 'benign' | 'malicious';
    predicted_v1: string;
    predicted_v2: string;
    cost_v1: number;
    cost_v2: number;
    trace_url_v2?: string;
  }>;
}
