-- Nerve PostgreSQL Schema
-- 16 tables covering analyses, metadata, agent runs, calls, evidence, hypotheses,
-- findings, iocs, messages, scoring, reports, events, evals, and job queue.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Analyses (one per APK submission)
CREATE TABLE IF NOT EXISTS analyses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sha256           CHAR(64) NOT NULL,
  md5              CHAR(32),
  filename         TEXT NOT NULL,
  size_bytes       BIGINT NOT NULL,
  storage_path     TEXT NOT NULL,                    -- path under SAMPLES_DIR
  status           TEXT NOT NULL CHECK (status IN
                     ('queued','running','completed','failed','cancelled')),
  variant          TEXT NOT NULL DEFAULT 'v2_multi'
                     CHECK (variant IN ('v1_single','v2_multi')),
  llm_provider     TEXT,                             -- primary provider used
  verdict          TEXT CHECK (verdict IN ('low_risk','suspicious','likely_malicious')),
  risk_score       NUMERIC(5,2),
  confidence       NUMERIC(4,3),
  langgraph_thread TEXT,
  neatlogs_trace_url TEXT,
  total_tokens_in  INTEGER DEFAULT 0,
  total_tokens_out INTEGER DEFAULT 0,
  actual_cost_usd  NUMERIC(10,5) DEFAULT 0,          -- 0 on free tiers
  reference_cost_usd NUMERIC(10,5) DEFAULT 0,        -- shadow pricing for cfo.ai
  budget           JSONB NOT NULL DEFAULT '{}'::jsonb,
  limited_visibility BOOLEAN DEFAULT FALSE,          -- packed / encrypted payload detected
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at       TIMESTAMPTZ,
  finished_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_analyses_sha256 ON analyses (sha256);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses (status, created_at);

-- 2. APK metadata
CREATE TABLE IF NOT EXISTS apk_metadata (
  analysis_id      UUID PRIMARY KEY REFERENCES analyses(id) ON DELETE CASCADE,
  package_name     TEXT,
  version_name     TEXT,
  version_code     BIGINT,
  min_sdk          INTEGER,
  target_sdk       INTEGER,
  signing_cert_sha256 CHAR(64),
  is_packed        BOOLEAN DEFAULT FALSE,
  packer           TEXT,
  obfuscators      JSONB DEFAULT '[]'::jsonb,
  permissions      JSONB DEFAULT '[]'::jsonb,
  components       JSONB DEFAULT '{}'::jsonb         -- activities/services/receivers/providers
);

-- 3. Agent runs (one row per agent invocation; maps to neatlogs spans)
CREATE TABLE IF NOT EXISTS agent_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  agent_name       TEXT NOT NULL,   -- orchestrator|static|reverse_eng|threat_intel|verifier|scoring|report
  hypothesis_id    UUID,
  iteration        INTEGER NOT NULL DEFAULT 0,
  attempt          INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL CHECK (status IN ('running','succeeded','failed','skipped')),
  tier             TEXT,            -- triage|strong|verify
  tokens_in        INTEGER DEFAULT 0,
  tokens_out       INTEGER DEFAULT 0,
  reference_cost_usd NUMERIC(10,5) DEFAULT 0,
  neatlogs_span_id TEXT,
  error            TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_analysis ON agent_runs (analysis_id, started_at);

-- 4. LLM calls (provider/model per attempt, with failover lineage)
CREATE TABLE IF NOT EXISTS llm_calls (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id     UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,
  model            TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN
                     ('ok','rate_limited','provider_error','timeout','json_invalid','repaired')),
  tokens_in        INTEGER,
  tokens_out       INTEGER,
  latency_ms       INTEGER,
  reference_cost_usd NUMERIC(10,5),
  error            TEXT,
  fallback_of      UUID REFERENCES llm_calls(id),    -- set when this attempt is a failover
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_llm_calls_run ON llm_calls (agent_run_id, created_at);

-- 5. Tool calls (with fallback lineage for recovery evidence)
CREATE TABLE IF NOT EXISTS tool_calls (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id     UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  tool_name        TEXT NOT NULL,
  args             JSONB NOT NULL DEFAULT '{}'::jsonb,
  args_hash        CHAR(64) NOT NULL,                -- for tool-output caching
  status           TEXT NOT NULL CHECK (status IN ('succeeded','failed','timeout','cached')),
  exit_code        INTEGER,
  duration_ms      INTEGER,
  output_path      TEXT,
  error            TEXT,
  fallback_of      UUID REFERENCES tool_calls(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tool_calls_cache ON tool_calls (tool_name, args_hash);

-- 6. Artifacts (the citable evidence)
CREATE TABLE IF NOT EXISTS artifacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  short_id         TEXT NOT NULL,                    -- "A-0042", used in report citations
  kind             TEXT NOT NULL CHECK (kind IN
                     ('manifest','permission','component','string','decompiled_method',
                      'smali','ioc','yara_match','intel_record','tool_error')),
  location         TEXT NOT NULL,
  content          TEXT NOT NULL,                    -- truncated excerpt
  content_sha256   CHAR(64) NOT NULL,
  flags            JSONB DEFAULT '[]'::jsonb,        -- e.g. ["injection_suspected"]
  created_by_tool_call UUID REFERENCES tool_calls(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, short_id)
);
CREATE INDEX IF NOT EXISTS idx_artifacts_analysis_kind ON artifacts (analysis_id, kind);

-- 7. Hypotheses
CREATE TABLE IF NOT EXISTS hypotheses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  short_id         TEXT NOT NULL,                    -- "H-03"
  category         TEXT NOT NULL,
  statement        TEXT NOT NULL,
  attack_technique TEXT,                             -- MITRE ATT&CK for Mobile name
  status           TEXT NOT NULL CHECK (status IN
                     ('proposed','investigating','confirmed','refuted',
                      'inconclusive','verified','unsupported')),
  confidence       NUMERIC(4,3),
  proposed_by      TEXT NOT NULL,
  parent_id        UUID REFERENCES hypotheses(id),
  iteration        INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, short_id)
);

-- 8. Hypothesis <-> evidence
CREATE TABLE IF NOT EXISTS hypothesis_evidence (
  hypothesis_id    UUID NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  artifact_id      UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  stance           TEXT NOT NULL CHECK (stance IN ('supports','contradicts','neutral')),
  note             TEXT,
  PRIMARY KEY (hypothesis_id, artifact_id)
);

-- 9. Findings (candidate claims that go through verification)
CREATE TABLE IF NOT EXISTS findings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  hypothesis_id    UUID REFERENCES hypotheses(id),
  title            TEXT NOT NULL,
  severity         TEXT NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  claim            TEXT NOT NULL,
  rule_id          TEXT,                             -- R01..R10
  reachability     TEXT CHECK (reachability IN ('reachable','unreachable','unknown')),
  verification     TEXT CHECK (verification IN ('verified','unsupported','contradicted')),
  verification_confidence NUMERIC(4,3),
  verifier_notes   TEXT,
  verified_by_run  UUID REFERENCES agent_runs(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_findings_analysis ON findings (analysis_id, verification);

CREATE TABLE IF NOT EXISTS finding_evidence (
  finding_id       UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  artifact_id      UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  PRIMARY KEY (finding_id, artifact_id)
);

-- 10. IOCs
CREATE TABLE IF NOT EXISTS iocs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('url','domain','ip','hash','cert')),
  value            TEXT NOT NULL,
  reputation       TEXT CHECK (reputation IN ('malicious','suspicious','unknown','no_data')),
  source           TEXT,                             -- local_yara | local_blocklist | virustotal | malwarebazaar
  artifact_id      UUID REFERENCES artifacts(id),
  UNIQUE (analysis_id, type, value)
);

-- 11. Inter-agent messages (makes multi-agent behavior auditable)
CREATE TABLE IF NOT EXISTS agent_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  from_agent       TEXT NOT NULL,
  to_agent         TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('handoff','challenge','response','resolution')),
  payload          JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Score breakdown (explainability)
CREATE TABLE IF NOT EXISTS score_breakdown (
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  rule_id          TEXT NOT NULL,
  label            TEXT NOT NULL,
  weight           NUMERIC(4,3) NOT NULL,
  verification_confidence NUMERIC(4,3) NOT NULL,
  contribution     NUMERIC(5,3) NOT NULL,
  finding_id       UUID REFERENCES findings(id),
  PRIMARY KEY (analysis_id, rule_id)
);

-- 13. Reports
CREATE TABLE IF NOT EXISTS reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('executive','technical')),
  markdown         TEXT NOT NULL,
  citation_check   JSONB,                            -- {total_claims, cited, stripped}
  pdf_path         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, kind)
);

-- 14. Live event stream (feeds SSE and UI timeline)
CREATE TABLE IF NOT EXISTS analysis_events (
  id               BIGSERIAL PRIMARY KEY,
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  ts               TIMESTAMPTZ NOT NULL DEFAULT now(),
  type             TEXT NOT NULL,   -- agent_started|tool_failed|fallback_used|provider_failover|finding_verified|injection_flagged|...
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_events_analysis ON analysis_events (analysis_id, id);

-- 15. Evaluation (before/after proof for judges)
CREATE TABLE IF NOT EXISTS eval_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant          TEXT NOT NULL CHECK (variant IN ('v1_single','v2_multi')),
  llm_provider     TEXT NOT NULL,
  models           JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {"triage": "...", "strong": "...", "verify": "..."}
  git_sha          TEXT NOT NULL,
  neatlogs_project TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eval_results (
  eval_run_id      UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  sample_sha256    CHAR(64) NOT NULL,
  split            TEXT NOT NULL CHECK (split IN ('dev','test')),
  ground_truth     TEXT NOT NULL CHECK (ground_truth IN ('benign','malicious')),
  predicted_verdict TEXT,
  correct          BOOLEAN,
  total_claims     INTEGER,
  unsupported_claims INTEGER,
  injection_resisted BOOLEAN,
  tokens_total     INTEGER,
  reference_cost_usd NUMERIC(10,5),
  latency_s        NUMERIC(8,2),
  trace_url        TEXT,
  PRIMARY KEY (eval_run_id, sample_sha256)
);

-- 16. Job queue (Postgres-based worker)
CREATE TABLE IF NOT EXISTS jobs (
  id               BIGSERIAL PRIMARY KEY,
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  state            TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','claimed','done','failed')),
  claimed_by       TEXT,
  claimed_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs (state, id);
