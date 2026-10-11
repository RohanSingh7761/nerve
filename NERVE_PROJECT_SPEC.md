# Nerve — Agentic Android Malware Triage That Proves Its Claims

> **Built for neatHack (Oct 10–12, 2026) · Track: "Build an agent that works (literally)"**
> A team of specialist agents that statically analyzes an Android APK end to end, and refuses to report anything it can't back with evidence.
>
> **Version: local-first, no Docker.** Runs entirely on your machine as native processes. No cloud hosting, no containers, no paid services, switchable LLM providers via one env variable.

---

## 0. What Changed in This Version

| Change | Detail |
|---|---|
| **No AWS / cloud hosting** | No EC2, S3, or Bedrock. Everything runs locally. Artifacts live in local folders. |
| **No Docker** | Everything runs as native processes (Python venv, Node, local Java tools, local PostgreSQL). A `doctor` command checks your setup. |
| **Dynamic analysis removed** | No emulator, no KVM requirement. Nerve is **static-analysis only** for now (listed under Future Work). |
| **No paid services** | Every component is open source or has a free tier. Paid LLM providers are *supported* but never *required*. |
| **Multi-provider LLM** | Pick a provider with `LLM_PROVIDER=<name>` and put its key in `.env`. No code changes. Optional automatic failover to other providers. |
| **Local-first intel** | Threat intel works fully offline by default (local YARA + cache). Online lookups (free API tiers) are optional. |
| **Process-level tool isolation** | Without containers, tools run as hardened subprocesses (allowlist, scrubbed environment, timeouts, safe unzip). This is weaker than a container sandbox; see §10 for the trade-off and mitigations. |
| **Shadow pricing** | Token usage is converted to a *reference* USD cost, so the cfo.ai business plan has real unit economics even when you run on free tiers. |

---

## 1. TL;DR

| | |
|---|---|
| **What** | Upload an APK → multi-agent system investigates it → explainable risk score + executive and technical reports |
| **Core idea** | **Hypothesis-driven investigation + an independent Verifier agent.** Agents propose hypotheses ("this app exfiltrates SMS"), investigate with real tools, and every claim in the final report must be tied to an artifact (decompiled method, manifest entry, IOC) that a verifier has checked. |
| **Why it's different** | Most "LLM malware analysts" are one model calling tools and narrating. Nerve separates *generating* claims from *verifying* them, survives tool and LLM-provider failures, resists prompt injection from malicious apps, and reports cost per scan. |
| **Hackathon tools** | **neatlogs** (tracing, before/after proof) · **Entire** (checkpoints, entire-graph) · **cfo.ai** (business plan) |
| **Stack** | Python · FastAPI · LangGraph · PostgreSQL · LiteLLM (library) · hardened subprocess tool runner · React + Vite + TypeScript |
| **Run it** | `cp .env.example .env` → set `LLM_PROVIDER` + key → `./scripts/setup.sh` → `./scripts/dev.sh` → open `http://localhost:5173` |

**Name rationale:** a nervous system takes signals from specialist sensors, coordinates a response, and reflexively rejects bad input. That is the architecture.

---

## 2. Problem and Pitch

**Problem.** Mobile malware triage is manual and slow. An analyst opens jadx, reads the manifest, greps strings, checks hashes, then writes a report. LLMs can speed this up, but they hallucinate behaviors that aren't in the code, and malware authors can plant text inside the app to manipulate an LLM analyst.

**Pitch.** Nerve behaves like a small security team: a static analyst, a reverse engineer, a threat-intel researcher, a skeptical reviewer, and a report writer, coordinated by an orchestrator. The reviewer's job is to kill any claim without evidence.

**Target users.** SOC and mobile security teams, app-store review pipelines, MDM/EMM vendors, banks and fintechs vetting sideloaded or third-party SDK APKs.

**Honest scope.** Static analysis can't see code that is decrypted or downloaded at runtime. Nerve detects and reports that limitation (packer/obfuscation findings, "limited visibility" section) instead of guessing.

---

## 3. Hackathon Alignment (Judging Rubric Map)

| Criterion (weight) | How Nerve earns it |
|---|---|
| **The agent (30%)** | Long multi-step task from upload to report. Planning (orchestrator), tool use (jadx/apktool/androguard/YARA), state (LangGraph + Postgres checkpoints), context (method-level snippet packing), execution (resumable runs), recovery (tool fallback chains + LLM provider failover), verification (Verifier agent), iteration (hypothesis refinement loop). Multi-agent with disagreement resolution. |
| **neatlogs + Entire + cfo.ai (25%)** | neatlogs traces every run and powers a measured v1→v2 improvement; Entire checkpoints each agent change and entire-graph maps the repo; cfo.ai plan is fed by real cost-per-scan numbers from neatlogs. See §17–19. |
| **Demo video (20%)** | 3-minute script that explicitly covers architecture, implementation, runtime, reasoning, result for each of the three tools. See §22. |
| **Building in public (15%)** | Post cadence with `#neatHack`. See §21. |
| **Usefulness + originality (10%)** | Real problem; novel angle is evidence-grounded verification plus injection-resistance, running locally on free LLMs. |

### Evidence checklist (judges verify these)

| Claim | Evidence to put in the repo (`/evidence`) |
|---|---|
| The agent improved | Two neatlogs traces (v1 vs v2) + metrics table with numbers |
| You used neatlogs | Trace links and screenshots |
| You used Entire | Checkpoints + entire-graph output |
| You used cfo.ai | Exported business plan (pricing, costs, revenue, runway) |
| Agent recovers from failure | A run where a tool *and/or an LLM provider* fails and the agent falls back (trace link) |
| Built in public | Links to `#neatHack` posts |
| Code written during the hackathon | Public repo, commits dated Oct 10–12 (do **not** import pre-existing code) |

> **Note on required tools:** neatlogs, Entire, and cfo.ai are *hackathon requirements*, not optional extras. neatlogs has a free start tier and Entire is open source. cfo.ai's hackathon page says a card is required at signup and to cancel immediately in Settings → Billing to avoid being billed; read its instructions and decide for yourself.

---

## 4. Scope

### MVP (must ship)
- APK upload, intake, static analysis
- Hypothesis generation → reverse-engineering investigation → threat-intel enrichment (offline by default)
- **Verifier agent** with deterministic + LLM checks
- Deterministic, explainable risk score
- Executive + technical reports with evidence citations
- **Provider-agnostic LLM layer** (env-selected provider, optional failover)
- Full neatlogs tracing, Postgres persistence, live React UI
- Two eval variants (v1 single-agent baseline, v2 Nerve) with numbers
- Injection-resistance test fixture
- Failure-recovery demo (tool failure and LLM provider failure)

### Stretch (only if MVP is done)
- Report PDF export
- Auto-generated YARA rules from confirmed findings
- MobSF comparison baseline (open source, can run locally)
- Fully offline mode with a local Ollama model

### Future work (explicitly out of scope now)
- **Dynamic analysis** (emulator/sandbox execution). Requires hardware virtualization (KVM) and more infra; removed for this version.
- Containerized tool sandbox (Docker) behind the same `ToolRunner` interface, for stronger isolation
- Cloud deployment

> **Honesty rule:** README and demo clearly label what is implemented vs future work.

---

## 5. System Architecture

```mermaid
flowchart LR
  subgraph Host["Your machine (native processes, no Docker)"]
    subgraph Client
      UI["React UI (Vite + TS)"]
    end

    subgraph Backend["FastAPI Backend + Worker"]
      API["REST + SSE API"]
      WRK["Analysis Worker (Postgres job queue)"]
    end

    subgraph Graph["LangGraph Multi-Agent Graph (in worker)"]
      INT["Intake (deterministic)"]
      ORCH["Orchestrator Agent"]
      STAT["Static Analysis Agent"]
      RE["Reverse Engineering Agent"]
      TI["Threat Intel Agent"]
      VER["Verifier Agent"]
      RISK["Risk Scoring (rubric + rationale)"]
      REP["Report Agent"]
    end

    LLMX["LLM Layer (LiteLLM library): provider from env, failover chain"]

    subgraph Sandbox["Tool Runner (local subprocess wrapper: allowlist, scrubbed env, timeouts)"]
      TOOLS["jadx · apktool · androguard · aapt2 · APKiD · YARA · strings"]
    end

    PG[("PostgreSQL: app data + LangGraph checkpoints")]
    FS[("Local folders: samples + artifacts")]
  end

  EXT["LLM provider (Gemini / Groq / OpenRouter / Mistral / Ollama / Anthropic / OpenAI / custom)"]
  NL["neatlogs (traces)"]
  INTEL["Optional online intel (free tiers)"]

  UI <--> API
  API <--> PG
  API --> WRK --> INT --> ORCH
  ORCH <--> STAT
  ORCH <--> RE
  ORCH <--> TI
  ORCH <--> VER
  ORCH --> RISK --> REP
  STAT --> TOOLS
  RE --> TOOLS
  TI -.-> INTEL
  Graph --> LLMX --> EXT
  Graph --> PG
  Graph --> NL
  TOOLS --> FS
```

### Key architectural decisions

1. **Orchestrator is a supervisor, not a router.** It plans, spawns per-hypothesis investigations in parallel, enforces budget, and **settles disagreements** between agents (e.g., Static says "suspicious", Reverse Engineering finds the code is unreachable).
2. **Agents communicate through typed shared state *and* explicit messages** (`agent_messages` table: handoffs, challenges, resolutions), so multi-agent behavior is visible and auditable.
3. **Generator/verifier separation.** The Verifier never sees the generating agent's reasoning, only the claim plus cited artifacts.
4. **Provider-agnostic LLM calls.** Agents never import a provider SDK. They call one internal `llm.complete(tier, ...)` function; the provider is chosen by env. Agent decisions use **structured JSON validated by Pydantic**, not native function-calling, so even small or free models work.
5. **Process-level isolation.** Tools run as hardened subprocesses behind a `ToolRunner` interface (allowlisted commands, scrubbed environment so API keys never reach them, workspace-confined paths, timeouts). Only the worker process (LLM calls, optional intel) holds credentials and reaches the network. This is weaker than containers; see §10.
6. **Untrusted-by-default.** Everything derived from the APK (strings, class names, resources, comments) is treated as hostile data.
7. **Durable state.** LangGraph checkpoints in Postgres so a run can resume after a crash.
8. **Cost and rate-limit awareness.** Orchestrator decides investigation depth from static confidence and remaining token budget; the LLM layer throttles for free-tier limits.

---

## 6. Agents (Detailed)

### 6.1 Intake (deterministic node, not an LLM agent)
- Compute SHA-256/MD5/SHA-1, file size, store the original APK in `SAMPLES_DIR` as `<sha256>.sample` (non-executable name, read-only permissions). Extraction uses safe unzip (§10).
- Unzip, parse the manifest via aapt2/androguard, extract signing certificate fingerprint.
- Run APKiD for packer/obfuscator detection.
- Create the `analyses` row, start the LangGraph thread (`thread_id`).
- **Cache check:** if the SHA-256 was analyzed before (same variant and config), return the cached result. Saves tokens and makes demos reliable.

### 6.2 Orchestrator Agent
- **Role:** plan, delegate, enforce budget, resolve conflicts, decide when to stop.
- **Model tier:** `strong` (low call count).
- **Inputs:** `apk_meta`, static summary, hypothesis list, verifier outcomes, budget state.
- **Outputs:** investigation plan (which hypotheses, how deep), fan-out instructions, conflict resolutions, stop decision. All as validated JSON.
- **Policy examples:**
  - Static confidence high-benign and no dangerous permissions → shallow path (skip RE, quick report).
  - Hypothesis `refuted` by RE but `supported` by Static → `challenge` message to both agents, one more targeted evidence pass, then decide (`inconclusive` is allowed).
  - Token budget > 80% consumed → stop low-priority hypotheses, list them as "not investigated."

### 6.3 Static Analysis Agent
- **Tools:** androguard (permissions, components, call graph), aapt2, manifest parser, string/URL/IP extractor, certificate parser.
- **Produces:** artifacts (`manifest`, `string`, `permission`, `component`) and an initial **hypothesis list** tagged with a behavior category:
  - `sms_interception`, `accessibility_abuse`, `overlay_phishing`, `dynamic_code_loading`, `persistence`, `contact_exfiltration`, `c2_communication`, `device_admin_abuse`, `anti_analysis`, `excess_permissions`.
- Map categories to MITRE ATT&CK for Mobile technique names where applicable (verify IDs before publishing).
- **Model tier:** `triage` (cheap/fast) over structured summaries, never raw dumps.

### 6.4 Reverse Engineering Agent
- **Tools:** jadx (decompile specific classes/methods), apktool (smali), androguard (xrefs, call paths).
- **Per hypothesis:** locate relevant API usage (e.g., `SmsManager.sendTextMessage`, `AccessibilityService`, `DexClassLoader`), trace a **static call-graph path** from an entry point (receiver/service/activity) to the sensitive call, and extract the **minimal snippet** (≤ ~150 lines) as an artifact with class/method location.
- **Output:** evidence links (`supports` / `contradicts`) and an updated hypothesis status.
- **Static reachability** distinguishes dead code from code reachable from an entry point (key for resolving Static vs RE conflicts). Reflection/dynamic loading are flagged as "reachability unknown."
- **Tool selection** is an LLM-chosen JSON action from an allowlist (`{"action": "decompile_method", "args": {...}}`), validated before execution.
- **Fallback chain:** see §9.

### 6.5 Threat Intelligence Agent
- **Offline by default (no keys, no network):**
  - **YARA** matching against a curated local ruleset vendored in the repo (check each ruleset's license).
  - **Local hash/cert blocklists** you ship in `/rules` (small, hand-curated for the demo set).
  - **IOC extraction and local heuristics** (suspicious TLDs, raw IPs, URL shorteners, base64'd endpoints).
  - **Signing certificate reuse** across analyzed samples in your own DB.
- **Optional online lookups (free tiers, set `INTEL_MODE=online`):** hash reputation via VirusTotal public API and/or MalwareBazaar (abuse.ch). Both need free API keys and are rate limited, so everything is cached. Check each service's terms for your use.
- Unknown IOCs are labeled `no_data`, **never "clean."**
- All lookups are stored as `intel_record` artifacts so they can be cited like any other evidence.
- **Model tier:** `triage` (only to summarize results into structured findings).

### 6.6 Verifier Agent (the differentiator)
Detailed in §8. Takes each **candidate finding** and decides `verified | unsupported | contradicted`, with notes. Only verified findings reach the score and report.
- **Model tier:** `verify`. If you've configured an optional second provider (`LLM_PROVIDER_VERIFY`), the verifier uses a different model family from the generators to reduce correlated errors.
- **Output is strictly structured JSON** (enum + short rationale), so injected text can't steer free-form behavior.

### 6.7 Risk Scoring
- Deterministic rubric over **verified findings only** (§8.2). An LLM writes the human-readable rationale but cannot change the number.

### 6.8 Report Agent
- Generates two reports from verified findings only:
  - **Executive report:** verdict, score, top 3 risks, business impact, recommended action (block / quarantine / allow / escalate).
  - **Technical report:** per-finding evidence with code excerpts, IOC table, permission analysis, ATT&CK mapping, "unverified leads", "not investigated", "limited visibility" (packed/encrypted payloads), methodology, confidence.
- **Citation rule:** every factual sentence carries an `[E-<artifact_id>]` reference. A post-check strips or flags any sentence lacking a valid reference.
- **Model tier:** `strong`.

---

## 7. End-to-End Flow

```mermaid
flowchart TD
  A["Upload APK"] --> B["Intake: hash, unzip, manifest, APKiD, cache check"]
  B -->|cache hit| Z["Return cached report"]
  B --> C["Orchestrator: initial plan + token budget"]
  C --> D["Static Analysis Agent: artifacts + hypotheses"]
  D --> E{"Orchestrator: depth decision"}
  E -->|shallow: low risk signals| S["Risk Scoring"]
  E -->|deep| F["Fan-out: one investigation per hypothesis (parallel, LLM throttled)"]
  F --> G["Reverse Engineering Agent: trace code, extract snippets"]
  F --> H["Threat Intel Agent: YARA, IOCs, cert, optional hash lookup"]
  G --> I["Candidate findings + evidence links"]
  H --> I
  I --> J["Verifier Agent: verified / unsupported / contradicted"]
  J --> K{"Conflicts or gaps?"}
  K -->|yes, iterations and budget remain| L["Orchestrator: challenge message, targeted re-investigation"]
  L --> F
  K -->|no, or budget exhausted| S
  S --> R["Report Agent: executive + technical, cited"]
  R --> V["Citation post-check"]
  V --> Y["Persist, stream to UI, finish"]
```

### Hypothesis lifecycle

```mermaid
stateDiagram-v2
  [*] --> proposed
  proposed --> investigating: orchestrator assigns
  investigating --> confirmed: RE/TI evidence supports
  investigating --> refuted: evidence contradicts
  investigating --> inconclusive: tool failure or reachability unknown
  confirmed --> verified: Verifier passes
  confirmed --> unsupported: Verifier rejects
  refuted --> [*]
  inconclusive --> investigating: retry within budget
  verified --> [*]
  unsupported --> [*]
```

### Step-by-step narration
1. **Upload** via UI → `POST /analyses` stores the APK and creates a job.
2. **Intake** computes hashes, parses the manifest, runs APKiD, checks cache.
3. **Orchestrator** sets a plan and budget (e.g., max tokens per analysis, max 3 investigation iterations).
4. **Static Analysis** emits artifacts and hypotheses.
5. **Depth decision.** Low-signal APKs take the shallow path.
6. **Fan-out.** For each prioritized hypothesis, RE and TI run in parallel (LangGraph `Send`); LLM calls are throttled by a shared semaphore/rate limiter.
7. **Candidate findings** are assembled with evidence links.
8. **Verifier** checks each finding (§8).
9. **Conflict handling.** Contradictions or promising-but-unsupported findings trigger a targeted re-investigation round, up to the iteration cap.
10. **Scoring** over verified findings.
11. **Reports** generated and citation-checked.
12. **Everything streams** to the UI via SSE and is traced in neatlogs.

---

## 8. Verification, Scoring, and Shared State

### 8.1 Verification protocol (core novelty)

A candidate finding passes **deterministic checks first, then LLM entailment**:

| Step | Check | Type |
|---|---|---|
| 1 | Finding cites ≥ 1 artifact | Deterministic |
| 2 | Every cited artifact exists and its `content_sha256` matches the stored content | Deterministic |
| 3 | Any code snippet quoted in the claim appears **verbatim** in the cited artifact | Deterministic |
| 4 | For code-behavior claims, a static call-graph path exists (entry point → sensitive call), or the claim is downgraded to "present, reachability unknown/unreachable" | Deterministic + RE |
| 5 | Verifier LLM judges: *does the cited evidence entail the claim?* Output: `verified / unsupported / contradicted` + one-sentence rationale | LLM (structured JSON) |
| 6 | No existing artifact marked `contradicts` for the same hypothesis | Deterministic |

**Outcome rules**
- `verified` → eligible for scoring and report.
- `unsupported` → dropped from the score; listed under "Unverified leads."
- `contradicted` → triggers an orchestrator challenge/resolution round.

This produces the measurable **unsupported-claim rate** used in the v1 vs v2 comparison (§20).

### 8.2 Risk scoring (explainable, deterministic)

Score uses **only verified findings**. Aggregation is noisy-OR so independent evidence compounds:

```
risk = 100 × ( 1 − Π ( 1 − w_i × v_i ) )
```

`w_i` = rule weight, `v_i` = verification confidence in [0, 1] (0 if not verified).

| Rule | Behavior | Weight `w` |
|---|---|---|
| R01 | SMS interception/sending + network exfiltration path | 0.55 |
| R02 | Accessibility service abuse (auto-click, overlay, keylogging patterns) | 0.55 |
| R03 | Dynamic code loading of embedded/remote payload | 0.35 |
| R04 | Persistence (boot receiver, hidden launcher icon, device admin) | 0.25 |
| R05 | Communication with an IOC flagged by reputation sources | 0.50 |
| R06 | Known-malicious hash or family YARA match | 0.85 |
| R07 | Overlay/credential phishing against targeted app packages | 0.60 |
| R08 | Packer / heavy obfuscation (APKiD) | 0.15 |
| R09 | Permissions far exceed declared purpose | 0.10 |
| R10 | Contacts/call-log/location harvesting + upload | 0.40 |

**Verdict bands (initial):** `< 30` low risk · `30–60` suspicious · `≥ 60` likely malicious.
**Confidence:** based on the number of independent evidence kinds (static + code + intel) and the fraction of hypotheses investigated. Packed apps cap confidence (limited visibility).

**Worked example:** R01 (verified, v=1) + R05 (verified, v=1): `1 − (0.45 × 0.50) = 0.775` → **77.5 → likely malicious**. A benign utility with only R09: **10 → low**.

Every contribution is stored in `score_breakdown` and shown in the UI. Weights are starting points: tune on a dev split, report on a separate test split.

### 8.3 State model (Pydantic / TypedDict)

```python
from typing import Annotated, Literal, Optional, TypedDict
from operator import add
from pydantic import BaseModel

class Artifact(BaseModel):
    id: str                       # "A-0042"
    kind: Literal["manifest","permission","component","string","decompiled_method",
                  "smali","ioc","yara_match","intel_record","tool_error"]
    location: str                 # "com.foo.SmsReceiver#onReceive" or "AndroidManifest.xml:L34"
    content: str                  # truncated excerpt (<= ~150 lines)
    content_sha256: str
    created_by_tool_call: Optional[str] = None

class Hypothesis(BaseModel):
    id: str                       # "H-03"
    category: str
    statement: str
    status: Literal["proposed","investigating","confirmed","refuted",
                    "inconclusive","verified","unsupported"]
    confidence: float
    proposed_by: str
    iteration: int = 0

class Finding(BaseModel):
    id: str
    hypothesis_id: str
    title: str
    severity: Literal["info","low","medium","high","critical"]
    claim: str
    evidence_ids: list[str]
    verification: Optional[Literal["verified","unsupported","contradicted"]] = None
    verifier_notes: Optional[str] = None

class NerveState(TypedDict):
    analysis_id: str
    sha256: str
    apk_meta: dict
    plan: dict
    budget: dict          # {"max_tokens": 120000, "tokens_used": 0, "max_iterations": 3}
    iteration: int
    hypotheses: Annotated[list[Hypothesis], "merge by id"]
    artifacts: Annotated[list[Artifact], add]
    findings: Annotated[list[Finding], "merge by id"]
    messages: Annotated[list[dict], add]      # inter-agent challenge/resolution log
    score: Optional[dict]
    reports: Optional[dict]
```

### 8.4 Graph sketch (adjust to the installed LangGraph version)

```python
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

g = StateGraph(NerveState)
g.add_node("intake", intake)
g.add_node("orchestrator", orchestrator)
g.add_node("static", static_agent)
g.add_node("investigate", investigate_hypothesis)   # runs RE + TI for ONE hypothesis
g.add_node("verify", verifier_agent)
g.add_node("resolve", orchestrator_resolve)         # conflict handling + stop decision
g.add_node("score", risk_scoring)
g.add_node("report", report_agent)

g.add_edge(START, "intake")
g.add_edge("intake", "orchestrator")
g.add_edge("orchestrator", "static")

def depth_router(state):
    if state["plan"]["depth"] == "shallow":
        return "score"
    return [Send("investigate", {"hypothesis": h, **state})
            for h in state["plan"]["prioritized_hypotheses"]]

g.add_conditional_edges("static", depth_router)
g.add_edge("investigate", "verify")
g.add_edge("verify", "resolve")

def loop_router(state):
    if needs_more_work(state) and within_budget(state):
        return [Send("investigate", {"hypothesis": h, **state})
                for h in state["plan"]["retry_hypotheses"]]
    return "score"

g.add_conditional_edges("resolve", loop_router)
g.add_edge("score", "report")
g.add_edge("report", END)

graph = g.compile(checkpointer=checkpointer)   # Postgres checkpointer: resumable runs
```

---

## 9. Failure Recovery

Recovery must be **visible in a neatlogs trace** (the rubric asks for a run where an action failed and shows what the agent did next). Nerve has two recovery layers.

### 9.1 Tool fallback chains

| Primary | Failure examples | Fallback 1 | Fallback 2 | Last resort |
|---|---|---|---|---|
| jadx decompile | crash, timeout, obfuscation errors | apktool → smali analysis | androguard bytecode/xref analysis | manifest + string evidence only; hypothesis marked `inconclusive` |
| Online hash lookup (optional) | rate limit, 429, outage, no key | MalwareBazaar / alternate | local intel cache and YARA | record `no_data`, never "clean" |
| YARA ruleset | compile error in one rule file | skip that file, log, continue | n/a | note reduced coverage in report |

### 9.2 LLM provider failover

| Failure | Response |
|---|---|
| Rate limit / quota exhausted (common on free tiers) | Back off, then switch to the next provider in `LLM_FALLBACK_PROVIDERS` |
| Provider outage or timeout | Same, with each attempt logged in `llm_calls` (`fallback_of`) |
| Malformed JSON | One automatic repair prompt, then retry on the next provider |
| All providers exhausted | Mark the step failed, continue with partial state, say so in the report |

### 9.3 Mechanisms
- Each tool call is logged in `tool_calls` with `fallback_of`; each LLM attempt in `llm_calls` with `fallback_of`.
- Per-tool timeouts, bounded retries (max 2), exponential backoff.
- **Resumability:** if the worker dies mid-run, restart resumes from the last LangGraph checkpoint.
- **Demo-able fault injection:** `NERVE_FAULT=jadx_crash` forces the primary decompiler to fail; `NERVE_FAULT=llm_rate_limit` makes the primary provider return a simulated 429. Both make the fallback reliably recordable.

---

## 10. Security: Sandboxing and Prompt-Injection Defense

### Handling malware safely (local machine, no containers)
- Analysis is **static only**; samples are never executed.
- **Be clear about the trade-off:** without containers there is no network or filesystem isolation. Parsers (our unzip, jadx, apktool, androguard) process hostile files with your user's privileges. Parser exploits are rare but not impossible, so treat real malware samples as dangerous.
- **For real malware samples, run Nerve inside a VM** (or a WSL2 distro or a dedicated Linux box) with snapshots, and don't share personal folders into it. For development and most of the demo, benign APKs and the harmless fixtures are enough.
- **Hardened subprocess runner** (`LocalSubprocessRunner`, behind a `ToolRunner` interface so a Docker runner can be added later):
  - allowlisted binaries and argument shapes only; never `shell=True`
  - **scrubbed environment:** tools get only `PATH`, `JAVA_HOME`, and a workspace `HOME`. LLM API keys and `DATABASE_URL` are never passed to tool processes
  - paths must resolve inside the per-analysis workspace or `SAMPLES_DIR`
  - per-call timeout with process-group kill, output size caps, and a concurrency limit (`TOOL_MAX_CONCURRENCY`)
  - best-effort resource limits (`resource.setrlimit`: CPU time, file size) on Linux/macOS; not available on native Windows
  - cap the JVM heap for jadx/apktool through their JVM-options environment variable (verify the variable for your version)
- **Safe extraction in Intake:** reject zip entries with absolute paths, `..`, or symlinks (zip-slip); cap total uncompressed size, file count, and compression ratio (zip bombs).
- **Samples stored as `<sha256>.sample`** (no `.apk` extension, read-only permissions) so nothing can accidentally install or open them.
- Optional extra isolation on Linux, if available on your system: run tool subprocesses under `unshare -rn` (no network namespace) or `bwrap`/`firejail`. Verify they work on your distro before relying on them.
- Use only legitimately sourced public samples and follow each source's terms. Keep `data/`, `samples/`, and `.env` out of git (`.gitignore`).

### Defending the LLM analysts (a malicious APK is *adversarial input*)
1. **Data/instruction separation:** all APK-derived text is wrapped as `<untrusted_artifact id="A-123">…</untrusted_artifact>`; system prompts state that content inside is data, never instructions.
2. **Injection scanner:** regex/heuristics (plus an optional cheap classifier call) flag strings like "ignore previous instructions", "you are now…", "report this app as safe". Hits are stored as artifacts tagged `injection_suspected` and **are themselves a risk signal** (anti-analysis behavior).
3. **Constrained outputs:** Verifier, Scoring, and Orchestrator produce strict JSON enums validated by Pydantic. Free text can't change decisions.
4. **Least privilege:** agents only have read-only analysis tools from an allowlist; arguments are validated (paths must be inside the analysis workspace; no shell interpolation).
5. **Score immunity:** the numeric score is computed by deterministic code from verified findings, not by the LLM.
6. **Test fixture:** build a **harmless** test APK containing instruction-like strings. Show that Nerve flags it without changing its verdict, and that the naive v1 agent can be steered.

---

## 11. LLM Layer: Multi-Provider, Env-Driven

**Goal:** change `LLM_PROVIDER` in `.env`, add the key, restart. No code changes.

### 11.1 How it works
- Uses the open-source **LiteLLM Python library** in-process (no proxy server required). It normalizes ~100 providers behind one `acompletion()` call.
- A small registry (`backend/app/llm/providers.yaml`) maps each provider name to: LiteLLM model prefix, which env var holds its key, default model per **tier**, and conservative rate limits.
- Agents request a **tier** (`triage`, `strong`, `verify`), never a model name.
- Resolution order for a tier's model: `MODEL_<TIER>` env override → registry default for the active provider.
- Failover chain: `LLM_PROVIDER` first, then each of `LLM_FALLBACK_PROVIDERS` (providers with a missing key are skipped with a warning).

### 11.2 Supported providers (all configurable; none required except one you choose)

| `LLM_PROVIDER` | Key env var | Notes |
|---|---|---|
| `gemini` | `GEMINI_API_KEY` | Google AI Studio key; has a free tier (limits change, verify) |
| `groq` | `GROQ_API_KEY` | Free tier with tight rate limits (verify); very fast |
| `openrouter` | `OPENROUTER_API_KEY` | Some models are free (ids end in `:free`); availability varies |
| `mistral` | `MISTRAL_API_KEY` | Has a free experimentation tier (verify) |
| `ollama` | `OLLAMA_API_BASE` | **Fully local and free**, no key. Needs a capable machine; small models are weaker at the Verifier/Orchestrator roles |
| `anthropic` | `ANTHROPIC_API_KEY` | Paid; supported if you already have a key |
| `openai` | `OPENAI_API_KEY` | Paid; supported if you already have a key |
| `custom` | `CUSTOM_OPENAI_BASE_URL`, `CUSTOM_OPENAI_API_KEY` | Any OpenAI-compatible endpoint (e.g., the hackathon-provided LiteLLM proxy, LM Studio, vLLM) |

> Free-tier limits and model names change often. Treat the defaults in `providers.yaml` as best-effort starting points, and override with `MODEL_TRIAGE` / `MODEL_STRONG` / `MODEL_VERIFY` when needed.

### 11.3 Registry sketch (`providers.yaml`)

```yaml
# Model names are best-effort defaults. Verify against each provider's current model list.
providers:
  gemini:
    prefix: gemini
    key_env: GEMINI_API_KEY
    models: { triage: gemini-2.0-flash, strong: gemini-2.5-flash, verify: gemini-2.5-flash }
    rpm: 10
  groq:
    prefix: groq
    key_env: GROQ_API_KEY
    models: { triage: llama-3.1-8b-instant, strong: llama-3.3-70b-versatile, verify: llama-3.3-70b-versatile }
    rpm: 20
  openrouter:
    prefix: openrouter
    key_env: OPENROUTER_API_KEY
    models: { triage: "meta-llama/llama-3.3-70b-instruct:free", strong: "meta-llama/llama-3.3-70b-instruct:free", verify: "meta-llama/llama-3.3-70b-instruct:free" }
    rpm: 10
  mistral:
    prefix: mistral
    key_env: MISTRAL_API_KEY
    models: { triage: mistral-small-latest, strong: mistral-large-latest, verify: mistral-large-latest }
    rpm: 10
  ollama:
    prefix: ollama
    base_env: OLLAMA_API_BASE
    models: { triage: "llama3.1:8b", strong: "qwen2.5:14b", verify: "qwen2.5:14b" }
    rpm: 1000
  anthropic:
    prefix: anthropic
    key_env: ANTHROPIC_API_KEY
    models: { triage: claude-haiku-5-5, strong: claude-sonnet-5-5, verify: claude-sonnet-5-5 }
    rpm: 50
  openai:
    prefix: openai
    key_env: OPENAI_API_KEY
    models: { triage: gpt-4o-mini, strong: gpt-4o, verify: gpt-4o }   # verify current names
    rpm: 50
  custom:
    prefix: openai                      # OpenAI-compatible
    key_env: CUSTOM_OPENAI_API_KEY
    base_env: CUSTOM_OPENAI_BASE_URL
    models: {}                          # must be set via MODEL_TRIAGE / MODEL_STRONG / MODEL_VERIFY
    rpm: 30
```

### 11.4 Client sketch (`llm/client.py`)

```python
import os, asyncio, yaml, json, time
import litellm
from pydantic import BaseModel, ValidationError

REGISTRY = yaml.safe_load(open("app/llm/providers.yaml"))["providers"]
_sem = asyncio.Semaphore(int(os.getenv("LLM_MAX_CONCURRENCY", "2")))   # throttle fan-out

def provider_chain() -> list[str]:
    chain = [os.environ["LLM_PROVIDER"]] + [
        p.strip() for p in os.getenv("LLM_FALLBACK_PROVIDERS", "").split(",") if p.strip()
    ]
    usable = []
    for p in chain:
        cfg = REGISTRY[p]
        key_env, base_env = cfg.get("key_env"), cfg.get("base_env")
        if (key_env and not os.getenv(key_env)) or (base_env and not os.getenv(base_env)):
            log.warning("provider %s skipped: missing credentials", p)
            continue
        usable.append(p)
    return usable

def model_for(provider: str, tier: str) -> str:
    cfg = REGISTRY[provider]
    name = os.getenv(f"MODEL_{tier.upper()}") or cfg["models"][tier]
    return f'{cfg["prefix"]}/{name}'

async def complete_json(tier: str, messages: list[dict], schema: type[BaseModel], agent_run_id: str):
    prev_call_id = None
    for provider in provider_chain():
        cfg = REGISTRY[provider]
        kwargs = dict(model=model_for(provider, tier), messages=messages,
                      temperature=0, timeout=60)
        if cfg.get("base_env"):
            kwargs["api_base"] = os.environ[cfg["base_env"]]
        if provider == "custom":
            kwargs["api_key"] = os.environ["CUSTOM_OPENAI_API_KEY"]
        async with _sem:                                  # + per-provider RPM limiter
            t0 = time.time()
            try:
                resp = await litellm.acompletion(**kwargs)
                data = parse_and_validate(resp, schema)   # strip fences, json.loads, Pydantic
                prev_call_id = log_llm_call(agent_run_id, provider, kwargs["model"], resp, "ok", prev_call_id)
                return data
            except (litellm.RateLimitError, litellm.Timeout,
                    litellm.ServiceUnavailableError, litellm.APIConnectionError) as e:
                prev_call_id = log_llm_call(agent_run_id, provider, kwargs["model"], None, "provider_error", prev_call_id, err=str(e))
                continue                                  # failover to next provider
            except (ValidationError, json.JSONDecodeError):
                # one repair attempt on the same provider, then fail over
                ...
    raise AllProvidersFailed()
```

### 11.5 Provider-agnostic design rules
1. **No native tool-calling dependency.** Agents choose actions through JSON (`{"action": ..., "args": ...}`) validated by Pydantic. Works with small/free/local models.
2. **Temperature 0**, short prompts, schema shown in the prompt, one repair attempt on invalid JSON.
3. **Rate limiting:** global concurrency semaphore (`LLM_MAX_CONCURRENCY`) plus per-provider RPM limits from the registry, so LangGraph's parallel fan-out doesn't trigger 429s.
4. **Context discipline:** small-context models (especially local ones) make snippet packing (§12) mandatory.
5. **Response cache (dev only):** `LLM_CACHE=true` caches by prompt hash to save quota while developing. **Turn it off for official eval runs.**
6. **Provider recorded everywhere:** each `agent_runs`/`llm_calls` row stores provider and model; neatlogs spans carry them as tags. Eval results store the provider so results are reproducible.

---

## 12. Cost, Quota, and Context Management

Since the default setup runs on free tiers, the scarce resources are **requests per minute, daily quota, and context size**, not dollars.

| Technique | Detail |
|---|---|
| **Model tiering** | `triage` for extraction and summaries; `strong` for orchestrator decisions and reports; `verify` for the Verifier. Tier→model mapping lives in the provider registry, so swapping providers keeps the architecture intact. |
| **Snippet packing** | Never send whole decompiled apps. Send method-level snippets (≤ ~150 lines) selected by call-graph xrefs. |
| **Structured summaries first** | Agents reason over compact JSON; raw code is fetched on demand by artifact ID. |
| **Caching** | By SHA-256 (whole analysis) and by (tool, args) hash (tool outputs); optional LLM response cache for development. |
| **Per-analysis token budget** | `max_tokens` per analysis and per agent, enforced by the orchestrator via `budget` in state. |
| **Adaptive depth** | Shallow path for low-signal APKs. |
| **Throttling** | Semaphore + RPM limiter + provider failover (§11). |
| **Eval pacing** | Run the eval set slowly in the background; resume where it stopped (results are saved per sample). |

### Shadow pricing (for the cfo.ai business plan)
Free-tier runs cost $0, which makes unit economics meaningless. Nerve therefore also computes a **reference cost**:

```
reference_cost_usd = tokens_in × REF_PRICE_IN_PER_1M / 1e6 + tokens_out × REF_PRICE_OUT_PER_1M / 1e6
```

`REF_PRICE_*` are configurable assumptions (set them to the public list price of the paid model you'd use in production). The UI and neatlogs-derived reports show both **actual cost ($0 on free tiers)** and **reference cost**. The business plan uses the reference cost and says so explicitly.

---

## 13. Tech Stack

| Layer | Choice | Cost | Why |
|---|---|---|---|
| **Runtime** | Native processes: Python venv, Node.js, Java, local PostgreSQL. No Docker | Free | Fastest to start; no container tooling to learn or debug |
| **Language (backend)** | Python 3.11 | Free | Best ecosystem for androguard, YARA, LangGraph |
| **API** | FastAPI + Uvicorn | Free | Async, typed, SSE support |
| **Agent orchestration** | **LangGraph** + `langgraph-checkpoint-postgres` | Free | Stateful graphs, fan-out via `Send`, durable checkpoints |
| **LLM abstraction** | **LiteLLM** (Python library, in-process) | Free | One interface for Gemini, Groq, OpenRouter, Mistral, Ollama, Anthropic, OpenAI, custom |
| **LLM providers** | Chosen via `LLM_PROVIDER` (see §11) | Free tiers or local | Swap with one env var |
| **Validation** | Pydantic v2 | Free | Strict structured outputs |
| **Database** | **PostgreSQL 16** (SQLAlchemy 2 async + asyncpg; plain SQL init script) | Free | Evidence graph + LangGraph checkpoints + job queue |
| **Job queue** | Postgres table + `SELECT … FOR UPDATE SKIP LOCKED` | Free | No Redis, fewer moving parts |
| **Artifact storage** | Local folders (`SAMPLES_DIR`, `ARTIFACTS_DIR`) | Free | No S3 needed |
| **Static/RE tools** | jadx, apktool, androguard, aapt2, APKiD, `yara-python` | Free/open source | Standard Android static toolchain |
| **Threat intel** | Local YARA + local blocklists (default); optional VirusTotal / MalwareBazaar free tiers | Free | Works offline |
| **Tool isolation** | Hardened local subprocess wrapper (`ToolRunner` interface; a Docker implementation is future work) | Free | Allowlist, scrubbed env, timeouts, safe unzip; use a VM for real samples |
| **Frontend** | **React 18 + Vite + TypeScript** | Free | Fast iteration |
| **UI libs** | Tailwind CSS, shadcn/ui, TanStack Query, **React Flow** (live agent graph), Recharts, `react-markdown`, a code highlighter | Free | Demo-friendly visuals |
| **Realtime** | Server-Sent Events | Free | One-way stream is enough |
| **Observability** | **neatlogs** SDK | Free start tier; hackathon-required | Traces for every agent/tool/LLM call |
| **Dev workflow** | **Entire** (checkpoints, entire-graph) | Open source; hackathon-required | Context for each agent change |
| **Business planning** | **cfo.ai** | Hackathon-required; see signup note in §3 | Pricing/cost/runway model |
| **CI (optional)** | GitHub Actions (lint + tests) | Free tier | Commit history shows work during the hackathon |

> **Verify before relying on:** exact neatlogs SDK init/instrumentation calls (docs.neatlogs.com/sdk), Entire usage (entire.io docs), current model names and free-tier limits for your chosen provider.

---

## 14. Data Model (PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Analyses (one per APK submission)
CREATE TABLE analyses (
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
CREATE INDEX idx_analyses_sha256 ON analyses (sha256);
CREATE INDEX idx_analyses_status ON analyses (status, created_at);

-- 2. APK metadata
CREATE TABLE apk_metadata (
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
CREATE TABLE agent_runs (
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
CREATE INDEX idx_agent_runs_analysis ON agent_runs (analysis_id, started_at);

-- 4. LLM calls (provider/model per attempt, with failover lineage)
CREATE TABLE llm_calls (
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
CREATE INDEX idx_llm_calls_run ON llm_calls (agent_run_id, created_at);

-- 5. Tool calls (with fallback lineage for recovery evidence)
CREATE TABLE tool_calls (
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
CREATE INDEX idx_tool_calls_cache ON tool_calls (tool_name, args_hash);

-- 6. Artifacts (the citable evidence)
CREATE TABLE artifacts (
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
CREATE INDEX idx_artifacts_analysis_kind ON artifacts (analysis_id, kind);

-- 7. Hypotheses
CREATE TABLE hypotheses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  short_id         TEXT NOT NULL,                    -- "H-03"
  category         TEXT NOT NULL,
  statement        TEXT NOT NULL,
  attack_technique TEXT,                             -- MITRE ATT&CK for Mobile name (verify)
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
CREATE TABLE hypothesis_evidence (
  hypothesis_id    UUID NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  artifact_id      UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  stance           TEXT NOT NULL CHECK (stance IN ('supports','contradicts','neutral')),
  note             TEXT,
  PRIMARY KEY (hypothesis_id, artifact_id)
);

-- 9. Findings (candidate claims that go through verification)
CREATE TABLE findings (
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
CREATE INDEX idx_findings_analysis ON findings (analysis_id, verification);

CREATE TABLE finding_evidence (
  finding_id       UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  artifact_id      UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  PRIMARY KEY (finding_id, artifact_id)
);

-- 10. IOCs
CREATE TABLE iocs (
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
CREATE TABLE agent_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  from_agent       TEXT NOT NULL,
  to_agent         TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('handoff','challenge','response','resolution')),
  payload          JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Score breakdown (explainability)
CREATE TABLE score_breakdown (
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
CREATE TABLE reports (
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
CREATE TABLE analysis_events (
  id               BIGSERIAL PRIMARY KEY,
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  ts               TIMESTAMPTZ NOT NULL DEFAULT now(),
  type             TEXT NOT NULL,   -- agent_started|tool_failed|fallback_used|provider_failover|finding_verified|injection_flagged|...
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_events_analysis ON analysis_events (analysis_id, id);

-- 15. Evaluation (before/after proof for judges)
CREATE TABLE eval_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant          TEXT NOT NULL CHECK (variant IN ('v1_single','v2_multi')),
  llm_provider     TEXT NOT NULL,
  models           JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {"triage": "...", "strong": "...", "verify": "..."}
  git_sha          TEXT NOT NULL,
  neatlogs_project TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE eval_results (
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
CREATE TABLE jobs (
  id               BIGSERIAL PRIMARY KEY,
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  state            TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','claimed','done','failed')),
  claimed_by       TEXT,
  claimed_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jobs_state ON jobs (state, id);
```

> LangGraph's Postgres checkpointer creates its own tables via its `setup()` call, in the same database.

---

## 15. API Design

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/analyses` | Upload APK (multipart), optional `variant`; returns `analysis_id` |
| `GET` | `/api/analyses/{id}` | Status, verdict, score, token/cost summary, active provider |
| `GET` | `/api/analyses/{id}/events` | **SSE** stream of `analysis_events` |
| `GET` | `/api/analyses/{id}/graph` | Agent runs, tool calls, LLM calls, messages (React Flow view) |
| `GET` | `/api/analyses/{id}/hypotheses` | Hypotheses with evidence and status |
| `GET` | `/api/analyses/{id}/findings` | Findings with verification status |
| `GET` | `/api/analyses/{id}/score` | Score breakdown |
| `GET` | `/api/analyses/{id}/reports/{kind}` | `executive` or `technical` markdown |
| `GET` | `/api/artifacts/{short_id}?analysis_id=` | Evidence drawer content |
| `GET` | `/api/config` | Active provider, tier→model mapping, fallback chain (never returns keys) |
| `POST` | `/api/eval/run` | Kick off an eval run for a variant |
| `GET` | `/api/eval/compare?a=&b=` | v1 vs v2 comparison table |

---

## 16. Frontend (React)

| View | Contents |
|---|---|
| **Header** | Active LLM provider and models (from `/api/config`), fallback chain, intel mode |
| **Upload** | Drag-and-drop APK, variant toggle (v1/v2) for demo, token budget setting |
| **Live Run** | **React Flow** graph of agents lighting up as events arrive; event timeline (SSE); live token counters (actual + reference cost); failure, fallback, and **provider-failover** badges |
| **Hypotheses & Findings** | Cards with status chips (`proposed → verified`), verification badge, reachability tag, click-through to **evidence drawer** (code snippet, location, hash) |
| **Score** | Recharts breakdown by rule, verdict, confidence, "why this score" |
| **Reports** | Tabs for Executive and Technical; clickable `[E-…]` citations open the evidence drawer; "limited visibility" banner for packed apps |
| **Intel** | IOC table with reputation and source (local vs online) |
| **Eval dashboard** | v1 vs v2 bars: accuracy, unsupported-claim rate, tokens/reference cost, latency; links to neatlogs traces |
| **Security panel** | Injection flags raised, sandbox status |

---

## 17. neatlogs Integration Plan

**Initialization:** set up the neatlogs SDK once at API/worker start per its docs (verify exact calls at docs.neatlogs.com/sdk).

**What to trace**
- One **trace per analysis**, with child spans for: each LangGraph node/agent run, every **LLM call (provider, model, tokens, latency)**, every tool call (args, exit code, duration), every retry/fallback/provider failover, every verifier decision.
- **Tags/metadata on every trace:** `analysis_id`, `sha256`, `variant` (v1_single | v2_multi), `llm_provider`, `git_sha`, `eval_run_id`.
- Store `neatlogs_trace_url` in `analyses` and `eval_results` so the UI links straight to traces.

**How neatlogs is used to *build and improve* (not just log)**
1. Run v1 (single agent) on the dev set → find failures in traces (hallucinated claims, wasted tokens on huge code dumps, 429 storms from parallel calls, wrong tool order).
2. Fix → run v2 → compare traces side by side.
3. Use latency/token breakdown to find bottlenecks (e.g., full jadx decompile dominating, or a verbose prompt) → targeted decompile, tighter context. Record before/after numbers.
4. Capture **two recovery traces**: `NERVE_FAULT=jadx_crash` (tool fallback) and `NERVE_FAULT=llm_rate_limit` (provider failover).

**Deliverables for judges:** link/screenshot of v1 trace, v2 trace, both recovery traces, and the metrics table (§20).

---

## 18. Entire Integration Plan

- Use Entire **checkpoints** to save the context behind each meaningful change. Create one at each milestone:
  1. Graph skeleton + state model
  2. LLM provider layer + registry
  3. Static agent + artifact store
  4. RE agent + tool fallback chain
  5. Verifier agent (the big one)
  6. Injection defenses
  7. Scoring + reports
  8. Eval harness + v1 baseline
- Open PRs for key changes (e.g., "Add Verifier agent", "Add provider failover") with the checkpoint attached, so context and decisions travel with the change.
- Run **entire-graph** on the repo to map relationships across modules; include the output in `/evidence/entire/` and show it in the demo.
- Follow Entire's docs for exact commands (verify before the demo).

---

## 19. cfo.ai Business Plan Inputs

Use cfo.ai to model pricing, costs, revenue, and runway; export it to `/evidence/cfo-ai/`.

**Inputs to enter (replace assumptions with measured data from neatlogs and your DB):**

| Input | Source |
|---|---|
| Tokens per APK (shallow vs deep) | neatlogs / `analyses.total_tokens_*` |
| **Reference** inference cost per APK | `analyses.reference_cost_usd` (shadow pricing, §12) |
| Compute time per APK | neatlogs latency; apply a typical VM hourly rate assumption |
| Cache hit rate | `analyses` table (repeat SHA-256) |
| Threat-intel costs | Free tiers now; note the paid-plan cost you'd need at scale |
| Fixed monthly infra | Assumption for a small hosted deployment (not used in the hackathon build) |

**Pricing hypotheses to test (assumptions, not facts):**
- **Per-scan:** pay-as-you-go priced at a multiple of reference cost per scan.
- **Team plan:** monthly seats + included scans; overage per scan.
- **API/enterprise:** volume pricing for app-store pipelines and MDM vendors.

**Scenarios:** Base vs Growth (customers, scans/month, margin, runway). Show **gross margin sensitivity to cost per scan**, which ties the business to the agent's cost-aware design. The story: *"adaptive depth and caching cut reference cost per scan from X to Y, raising gross margin from A% to B%."* (Fill from real numbers.) State clearly that your hackathon runs used free tiers and that the plan uses reference pricing.

---

## 20. Evaluation Plan

### Variants
| Variant | Description |
|---|---|
| **v1_single** | One ReAct-style agent, same tools, same provider/models, no hypothesis structure, no Verifier, no injection defenses |
| **v2_multi (Nerve)** | Full system |
| *(optional)* MobSF | Open-source classical baseline, run locally if time allows |

Both variants use the **same provider and models** in an eval run. Record them in `eval_runs`.

### Dataset (small and honest)
- ~10–12 malicious APKs from public research sources reachable quickly (e.g., MalwareBazaar). AndroZoo/Drebin/AMD/CICMalDroid are excellent but may require access approval, so use them only if available in time.
- ~8–10 benign APKs (e.g., open-source apps from F-Droid) to measure false positives.
- **Dev/test split:** tune on dev, report on test.
- Plus the harmless **injection fixture**.
- State dataset size and limitations plainly; don't overclaim.

### Practical notes for free tiers
- Run evals paced and resumable; results save per sample.
- Disable `LLM_CACHE` for official runs.
- If the primary provider's quota runs out mid-eval, record which provider answered each call, or finish the run on the same provider the next day. Don't mix providers within one comparison.

### Metrics (fill with real numbers)

| Metric | v1_single | v2_multi (Nerve) |
|---|---|---|
| Verdict accuracy (test) | _ | _ |
| False-positive rate on benign | _ | _ |
| **Unsupported-claim rate** (claims without valid evidence ÷ total claims) | _ | _ |
| Injection fixture: verdict manipulated? | _ | _ |
| Avg tokens per APK | _ | _ |
| Avg reference cost per APK (USD) | _ | _ |
| Avg latency per APK (s) | _ | _ |
| Completes when jadx is faulted? | _ | _ |
| Completes when primary LLM provider is rate-limited? | _ | _ |
| Explanation faithfulness (manual spot-check of 10 findings) | _ | _ |

---

## 21. Building in Public

Post on X with **#neatHack** throughout; keep links in `/evidence/public-posts.md`.

| When | Post idea |
|---|---|
| Early | Problem + architecture sketch (the improved diagram) |
| After v1 works | Screenshot of a neatlogs trace of the single agent hallucinating a claim |
| Provider layer | "One env var swaps Gemini → Groq → local Ollama" short clip |
| After Verifier | "Before/after: unsupported claims from X% → Y%" |
| Injection test | Short clip: hostile strings trying to steer the agent, Nerve flagging them |
| Recovery | Clip of tool fallback and provider failover in the live graph |
| Pre-submission | Demo teaser + repo link |
| Submission | Quote post of the official neatlogs submission post (team, project name, public repo, demo link) |

The community prize rewards genuine engagement. Reply to comments and share real learnings.

---

## 22. Demo Video Script (≤ 3:00)

| Time | Segment |
|---|---|
| 0:00–0:20 | **Hook:** "LLM malware analysts hallucinate and can be prompt-injected by the malware itself. Nerve proves every claim, and runs locally on free models." |
| 0:20–0:50 | **Architecture** (diagram): agents, verifier, sandbox, provider layer, Postgres/LangGraph; one line per hackathon tool |
| 0:50–1:50 | **Live run** on a real APK in the React UI: agent graph lighting up, hypotheses appearing, evidence drawer, verifier rejecting one claim, score breakdown, cited report |
| 1:50–2:10 | **Recovery:** fault-injected jadx failure → fallback to apktool/androguard; simulated 429 → provider failover (shown in UI and neatlogs) |
| 2:10–2:30 | **Injection test:** hostile strings flagged; v1 steered, Nerve not |
| 2:30–2:45 | **Before/after numbers** from neatlogs v1 vs v2 |
| 2:45–3:00 | **Business** (cfo.ai: reference cost/scan → price → margin) and close |

### Required tool coverage (rules ask for all five aspects per tool)

| Tool | Architecture | Implementation | Runtime | Reasoning | Result |
|---|---|---|---|---|---|
| **neatlogs** | Where spans are emitted | Instrumentation in nodes/tools/LLM layer | Live trace view | How traces revealed failures and bottlenecks | v1 vs v2 numbers |
| **Entire** | Checkpoints per milestone + entire-graph | Workflow used | Checkpoint on a PR | How context guided agent changes | Cleaner history/graph output |
| **cfo.ai** | Cost model tied to agent cost | Inputs from neatlogs + shadow pricing | Scenario toggle | Pricing logic | Margin and runway outcome |

---

## 23. Local Setup (No Docker) and Repository Structure

### Prerequisites

| Requirement | Used for | Notes |
|---|---|---|
| Python 3.11+ | Backend, androguard, YARA, LangGraph | Use a venv |
| Node.js 20+ | React frontend | |
| Java 17+ (JRE) | jadx, apktool | |
| PostgreSQL 16 | App data, LangGraph checkpoints, job queue | Native install via your OS package manager/installer |
| jadx | Decompiler | Release zip or package manager; set `JADX_BIN` if not on `PATH` |
| apktool | Smali and resources | Package manager, or the official jar + wrapper script; set `APKTOOL_BIN` |
| pip packages | androguard, apkid, yara-python, litellm, langgraph, fastapi, ... | `pip install -e backend` |
| *Optional:* Ollama | Fully local LLM | Free; needs a capable machine |
| *Optional:* aapt2 | Extra manifest parsing | Android SDK build-tools; androguard already parses manifests, so skip if inconvenient |

**OS notes**
- **macOS:** Homebrew covers most of it (for example `brew install python@3.11 node openjdk postgresql@16 jadx apktool`). Verify formula names on your machine.
- **Linux (Ubuntu/Debian):** `apt` for Python venv, OpenJDK 17 JRE, PostgreSQL, Node; jadx from its GitHub releases; apktool from its official site (the `apt` version can be old).
- **Windows:** use **WSL2 (Ubuntu)** and follow the Linux steps. APKiD and yara-python are painful on native Windows. If you can't use WSL2, run in minimal mode below.

### Minimal toolchain mode (pure pip, fewest installs)
Set `TOOLCHAIN_MODE=minimal` to run with only Python packages: androguard handles manifest parsing, bytecode/xrefs, and its built-in decompiler; jadx and apktool are skipped. The Reverse Engineering Agent loses jadx-quality source, and the report says so. This is also the last link of the jadx fallback chain (§9), so it's a useful safety net if a Java tool won't install in time.

### Quickstart

```bash
git clone <your-repo> nerve && cd nerve
cp .env.example .env              # set LLM_PROVIDER and that provider's key
./scripts/setup.sh                # venv, pip install, npm install, create DB, apply schema
cd backend && python -m app.doctor   # checks Java, jadx, apktool, Postgres, provider key, neatlogs key
cd .. && ./scripts/dev.sh         # starts API (with embedded worker) + frontend
# open http://localhost:5173
```

Manual database setup (what `setup.sh` automates):

```bash
createuser -P nerve               # dev password: nerve
createdb -O nerve nerve
psql -U nerve -d nerve -f backend/app/db/schema.sql
```

Run the pieces yourself instead of `dev.sh`:

```bash
# terminal 1: API (+ embedded worker when EMBEDDED_WORKER=true)
cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8000
# terminal 2: frontend (Vite proxies /api to :8000)
cd frontend && npm run dev
# terminal 3 (only if EMBEDDED_WORKER=false)
cd backend && source .venv/bin/activate && python -m app.worker
```

Notes:
- Use `--reload` only while developing. A reload kills in-flight analyses, but LangGraph checkpoints let them resume.
- To switch providers: edit `LLM_PROVIDER` (and add the new key), then restart the API.
- For the demo recording, run without `--reload`.

### `app.doctor` (setup checker)
Prints a table of: Python/Node/Java versions, `jadx`/`apktool`/`apkid`/`yara` availability and versions, Postgres connectivity and schema, the active provider chain with which keys are present (never printing keys), neatlogs key presence, and `TOOLCHAIN_MODE` in effect. Run it first in Block A to avoid losing hours to a missing tool.

### Tool runner (replaces the container sandbox)

```python
# backend/app/tools/runner.py  (sketch)
class ToolRunner(Protocol):
    async def run(self, tool: str, args: list[str], *, workspace: Path, timeout_s: int) -> ToolResult: ...

ALLOWED_TOOLS = {            # binary env var + argument validators per tool
    "jadx":    {"bin_env": "JADX_BIN",    "validate": validate_jadx_args},
    "apktool": {"bin_env": "APKTOOL_BIN", "validate": validate_apktool_args},
    "apkid":   {"bin_env": "APKID_BIN",   "validate": validate_apkid_args},
}

class LocalSubprocessRunner:
    _sem = asyncio.Semaphore(int(os.getenv("TOOL_MAX_CONCURRENCY", "2")))

    async def run(self, tool, args, *, workspace, timeout_s):
        spec = ALLOWED_TOOLS[tool]                      # KeyError => tool not allowed
        spec["validate"](args, workspace)               # paths must resolve inside workspace/SAMPLES_DIR
        env = {"PATH": os.environ["PATH"],              # scrubbed: NO API keys, NO DATABASE_URL
               "JAVA_HOME": os.environ.get("JAVA_HOME", ""),
               "HOME": str(workspace)}
        async with self._sem:
            proc = await asyncio.create_subprocess_exec(
                os.environ.get(spec["bin_env"], tool), *args,
                cwd=workspace, env=env,
                stdout=PIPE, stderr=PIPE,
                start_new_session=True,                 # own process group, killable on timeout
                preexec_fn=set_rlimits if os.name == "posix" else None,
            )
            try:
                out, err = await asyncio.wait_for(proc.communicate(), timeout_s)
            except asyncio.TimeoutError:
                kill_process_group(proc)
                return ToolResult(status="timeout", ...)
        return ToolResult(status="succeeded" if proc.returncode == 0 else "failed",
                          stdout=cap(out), stderr=cap(err), exit_code=proc.returncode)
```

A `DockerRunner` implementing the same `ToolRunner` interface can be added later without touching any agent code.

### Repository structure

```
nerve/
├── README.md                    # pitch, architecture, quickstart, evidence index
├── .env.example
├── .gitignore                   # .env, data/, samples/, node_modules, .venv
├── scripts/
│   ├── setup.sh                 # venv, deps, DB creation, schema, npm install
│   └── dev.sh                   # starts API + frontend
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py              # FastAPI app, SSE, embedded worker startup
│   │   ├── config.py
│   │   ├── doctor.py            # setup checker
│   │   ├── db/                  # models, session, schema.sql
│   │   ├── api/                 # routers: analyses, evidence, config, eval
│   │   ├── worker.py            # SKIP LOCKED job runner (embedded or standalone)
│   │   ├── graph/
│   │   │   ├── state.py         # NerveState + models
│   │   │   ├── build.py         # StateGraph wiring
│   │   │   ├── routing.py       # depth/loop routers, budget checks
│   │   │   └── nodes/
│   │   │       ├── intake.py
│   │   │       ├── orchestrator.py
│   │   │       ├── static_agent.py
│   │   │       ├── reverse_eng.py
│   │   │       ├── threat_intel.py
│   │   │       ├── verifier.py
│   │   │       ├── scoring.py
│   │   │       └── report.py
│   │   ├── tools/
│   │   │   ├── runner.py        # ToolRunner interface + LocalSubprocessRunner
│   │   │   ├── safe_unzip.py    # zip-slip and zip-bomb protections
│   │   │   ├── jadx.py  apktool.py  androguard_tools.py  apkid.py  yara_scan.py
│   │   │   └── intel.py         # offline intel + optional online lookups
│   │   ├── security/            # injection scanner, untrusted wrapper, arg validation
│   │   ├── llm/
│   │   │   ├── providers.yaml   # provider registry (§11)
│   │   │   ├── client.py        # tiers, failover, rate limiting, JSON repair
│   │   │   └── pricing.py       # shadow pricing
│   │   ├── obs/                 # neatlogs setup + span helpers
│   │   └── eval/                # dataset loader, v1 baseline agent, metrics
│   └── tests/
├── frontend/
│   ├── package.json
│   └── src/ (pages, components, hooks/useSSE, api client, graph view)
├── rules/
│   ├── yara/                    # vendored public YARA rules (check licenses)
│   └── blocklists/              # small local hash/cert lists for the demo set
├── fixtures/                    # harmless test APKs (incl. injection fixture)
├── data/                        # (gitignored) SAMPLES_DIR and ARTIFACTS_DIR live here
├── evidence/
│   ├── neatlogs/                # trace links + screenshots (v1 vs v2, recovery runs)
│   ├── entire/                  # checkpoints + entire-graph output
│   ├── cfo-ai/                  # exported business plan
│   └── public-posts.md          # #neatHack links
└── docs/                        # diagrams, this spec
```

### `.env.example`

```bash
############ LLM PROVIDER (change only this line to switch) ############
# gemini | groq | openrouter | mistral | ollama | anthropic | openai | custom
LLM_PROVIDER=gemini

# Optional: automatic failover when the primary is rate-limited or down (comma-separated, in order)
LLM_FALLBACK_PROVIDERS=

############ KEYS (fill only the ones you use) ############
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
MISTRAL_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
# Local Ollama (no key); runs natively on your machine
OLLAMA_API_BASE=http://localhost:11434
# Any OpenAI-compatible endpoint (e.g., hackathon-provided LiteLLM proxy, LM Studio, vLLM)
CUSTOM_OPENAI_BASE_URL=
CUSTOM_OPENAI_API_KEY=

############ OPTIONAL MODEL OVERRIDES (defaults come from providers.yaml) ############
MODEL_TRIAGE=
MODEL_STRONG=
MODEL_VERIFY=
# Optional: use a different provider just for the Verifier (different model family)
LLM_PROVIDER_VERIFY=

############ LLM BEHAVIOR ############
LLM_MAX_CONCURRENCY=2
LLM_CACHE=false              # true only while developing; keep false for eval runs
NERVE_MAX_TOKENS=120000      # per-analysis token budget
NERVE_MAX_ITERATIONS=3

############ SHADOW PRICING (USD per 1M tokens; assumptions for the business plan) ############
REF_PRICE_IN_PER_1M=
REF_PRICE_OUT_PER_1M=

############ TOOLCHAIN (native, no Docker) ############
TOOLCHAIN_MODE=full          # full | minimal (minimal = androguard only, no Java tools)
JADX_BIN=jadx
APKTOOL_BIN=apktool
APKID_BIN=apkid
JAVA_HOME=
TOOL_TIMEOUT_S=120
TOOL_MAX_CONCURRENCY=2
SAMPLES_DIR=./data/samples
ARTIFACTS_DIR=./data/artifacts

############ PROCESS MODEL ############
EMBEDDED_WORKER=true         # run the job worker inside the API process

############ THREAT INTEL ############
INTEL_MODE=offline           # offline | online
VT_API_KEY=                  # optional, free tier
MALWAREBAZAAR_API_KEY=       # optional, free

############ DATABASE (native local PostgreSQL) ############
DATABASE_URL=postgresql+asyncpg://nerve:nerve@localhost:5432/nerve

############ OBSERVABILITY (variable names per neatlogs docs) ############
NEATLOGS_API_KEY=

############ DEMO / TESTING ############
NERVE_FAULT=                 # jadx_crash | llm_rate_limit
```

---

## 24. Build Timeline (≈ 36 hours remaining)

| Block | Goal | Done when |
|---|---|---|
| **A (≈4h)** | Repo + `setup.sh` and `doctor`, local Postgres schema, FastAPI skeleton, neatlogs wired, **LLM provider layer with registry + one provider working**, Intake node with safe unzip, `LocalSubprocessRunner` wrapping jadx/apktool/androguard | Upload an APK → hashes + manifest in DB + an LLM call traced in neatlogs. **First public post + first Entire checkpoint.** |
| **B (≈5h)** | v1 single-agent baseline (needed for the comparison) + minimal UI (upload, results) | v1 produces a report end to end; trace captured |
| **C (≈7h)** | LangGraph v2: Static → hypotheses → RE/TI fan-out → candidate findings; artifact store; SSE events; offline YARA intel | Hypotheses with evidence visible in UI |
| **D (≈5h)** | **Verifier**, tool fallback chains, provider failover, fault flags, orchestrator conflict resolution | Unsupported claims dropped; both recovery runs captured |
| **E (≈4h)** | Injection scanner + fixture, scoring, reports with citation post-check | Fixture test passes; reports cited |
| **F (≈4h)** | Eval run v1 vs v2 on dataset (paced for free-tier limits), metrics table, evidence folder | Real numbers recorded |
| **G (≈3h)** | cfo.ai plan, demo recording, README, final posts, **submit** (window opens 7:00 PM IST on Oct 12; planned close ~11:55 PM IST; confirm the final cutoff on Discord) | Quote-post submitted |

Prepare the demo APK set and cached results early so the final recording never depends on live APIs or free-tier quota. Test provider switching once in Block A so it's proven early.

---

## 25. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Not enough time | MVP/stretch split; cut PDF export and MobSF baseline first |
| Free-tier rate limits / daily quota | Throttling, caching, provider failover chain, small eval set, paced evals, optional local Ollama |
| Weak free or local models break structured output | JSON-schema prompts, Pydantic validation, one repair attempt, failover; keep tool selection as constrained JSON actions |
| Model names / free tiers change | Registry file + `MODEL_*` env overrides; verify on the day |
| jadx instability on obfuscated apps | Fallback chain (a feature, not a bug) |
| Packed apps hide behavior from static analysis | Detect and report "limited visibility"; cap confidence; list dynamic analysis as future work |
| Online intel unavailable or rate limited | Offline-by-default intel, cache, `no_data` never "clean" |
| Small dataset undermines claims | State size honestly; emphasize unsupported-claim and robustness metrics, which don't need a large dataset |
| Handling real malware locally (no container isolation) | Static-only, hardened subprocesses with scrubbed env, safe unzip, `.sample` file names, **use a VM/WSL2 for real samples**, samples gitignored |
| Native tool installs fail or eat time (Java, jadx, apktool, APKiD, yara) | Run `doctor` first; WSL2 on Windows; `TOOLCHAIN_MODE=minimal` (androguard only) as a safety net; pin versions you know work |
| Pre-existing code rule | Start the repo fresh from Oct 10; commit often so history shows work during the event |
| Over-claiming | README and demo label implemented vs future work |

---

## 26. Submission Checklist

- [ ] Public GitHub repo, commits dated Oct 10–12 (no pre-built code imported); no API keys or samples committed
- [ ] README: pitch, architecture, quickstart (`LLM_PROVIDER` + key), limitations, evidence index
- [ ] `/evidence/neatlogs`: v1 trace, v2 trace, tool-recovery trace, provider-failover trace, metrics table
- [ ] `/evidence/entire`: checkpoints + entire-graph output
- [ ] `/evidence/cfo-ai`: business plan (pricing, costs, revenue, runway)
- [ ] `/evidence/public-posts.md`: `#neatHack` post links
- [ ] Demo video ≤ 3 min covering neatlogs, Entire, cfo.ai (architecture, implementation, runtime, reasoning, result each)
- [ ] Team registered on Luma with a consistent team name; web check-in completed
- [ ] Submit via public **quote post** of the official neatlogs submission post on X (team, project name = **Nerve**, repo, demo link) inside the window; check Discord for the final cutoff

---

## 27. Future Work

- **Dynamic analysis agent:** emulator-based runtime monitoring (needs hardware virtualization/KVM) to observe unpacked payloads and real network behavior; would close the "limited visibility" gap for packed apps.
- **Containerized tool sandbox (Docker)** with an isolated network, as a second `ToolRunner` implementation.
- Cloud deployment and multi-user auth.
- Auto-generated YARA rules from verified findings; feedback loop from analyst corrections.
- Larger public benchmark evaluation.

---

## 28. Glossary

- **Hypothesis:** a testable statement about malicious behavior.
- **Artifact:** a citable piece of evidence (code excerpt, manifest entry, IOC, intel record).
- **Finding:** a claim tied to evidence that must pass verification before it can affect score or report.
- **Verifier:** independent agent that checks claims against artifacts.
- **Tier:** an abstract model role (`triage`, `strong`, `verify`) mapped to a concrete model by the active provider.
- **Shadow pricing:** computing a reference USD cost from token counts so unit economics stay meaningful on free tiers.
- **Noisy-OR:** probability combination where independent evidence compounds toward 1.
