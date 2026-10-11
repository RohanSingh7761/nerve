import React, { useState, useEffect, useRef } from 'react';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('triage');
  const [config, setConfig] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [currentAnalysisId, setCurrentAnalysisId] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [hypotheses, setHypotheses] = useState([]);
  const [findings, setFindings] = useState([]);
  const [scoreData, setScoreData] = useState(null);
  const [reports, setReports] = useState({ executive: '', technical: '' });
  const [events, setEvents] = useState([]);
  const [activeNode, setActiveNode] = useState('idle');
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadVariant, setUploadVariant] = useState('v2_multi');
  const [benchmarkData, setBenchmarkData] = useState(null);
  const eventSourceRef = useRef(null);

  // 1. Fetch initial configuration & analyses list
  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then(setConfig)
      .catch((err) => console.error('Config fetch failed:', err));

    loadAnalyses();
    loadBenchmark();
  }, []);

  const resetToNewScan = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setCurrentAnalysisId(null);
    setAnalysisData(null);
    setHypotheses([]);
    setFindings([]);
    setScoreData(null);
    setReports({ executive: '', technical: '' });
    setEvents([]);
    setActiveNode('idle');
  };

  const loadAnalyses = async (autoSelect = false) => {
    try {
      const res = await fetch('/api/analyses');
      const data = await res.json();
      setAnalyses(data);
      if (!currentAnalysisId) {
        const activeOne = data.find((a) => a.status === 'running' || a.status === 'queued');
        if (activeOne) {
          selectAnalysis(activeOne.id);
        } else if (autoSelect && data.length > 0) {
          selectAnalysis(data[0].id);
        }
      }
    } catch (err) {
      console.error('Analyses fetch error:', err);
    }
  };

  const loadBenchmark = async () => {
    try {
      const res = await fetch('/api/eval/compare');
      const data = await res.json();
      setBenchmarkData(data);
    } catch (err) {
      console.error('Benchmark fetch error:', err);
    }
  };

  // 2. Select an analysis and load its full details
  const selectAnalysis = async (id) => {
    if (!id) {
      resetToNewScan();
      return;
    }
    setCurrentAnalysisId(id);
    setEvents([]);

    try {
      const [anaRes, hypRes, findRes, scoreRes, repExecRes, repTechRes] = await Promise.all([
        fetch(`/api/analyses/${id}`).then((r) => r.json()),
        fetch(`/api/analyses/${id}/hypotheses`).then((r) => r.json()),
        fetch(`/api/analyses/${id}/findings`).then((r) => r.json()),
        fetch(`/api/analyses/${id}/score`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/analyses/${id}/reports/executive`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/analyses/${id}/reports/technical`).then((r) => (r.ok ? r.json() : null)),
      ]);

      setAnalysisData(anaRes);
      setHypotheses(hypRes);
      setFindings(findRes);
      setScoreData(scoreRes);
      setReports({
        executive: repExecRes?.markdown || 'Executive report will appear here once generated.',
        technical: repTechRes?.markdown || 'Technical report will appear here once generated.',
      });

      // If running or queued, connect to SSE
      if (anaRes.status === 'running' || anaRes.status === 'queued') {
        startEventStream(id);
      } else {
        setActiveNode('done');
      }
    } catch (e) {
      console.error('Failed to load analysis details:', e);
    }
  };

  // 3. SSE event listener
  const startEventStream = (id) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/analyses/${id}/events`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        setEvents((prev) => [parsed, ...prev.slice(0, 50)]);

        // Animate active nodes based on event type
        const t = parsed.type;
        if (t.includes('intake')) setActiveNode('intake');
        else if (t.includes('orchestrator')) setActiveNode('orchestrator');
        else if (t.includes('static')) setActiveNode('static');
        else if (t.includes('reverse') || t.includes('jadx')) setActiveNode('reverse_eng');
        else if (t.includes('yara') || t.includes('intel')) setActiveNode('threat_intel');
        else if (t.includes('verify') || t.includes('finding')) setActiveNode('verifier');
        else if (t.includes('score')) setActiveNode('score');
        else if (t.includes('cancelled')) {
          setActiveNode('idle');
          loadAnalyses(false);
        }
        else if (t.includes('report') || t.includes('completed')) {
          setActiveNode('done');
          loadAnalyses(false);
        }
      } catch (err) {
        console.error('Event parse error:', err);
      }
    };

    es.onerror = () => {
      es.close();
    };
  };

  // 4. File upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('variant', uploadVariant);

    try {
      const res = await fetch('/api/analyses', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setIsUploading(false);
      if (data.analysis_id) {
        loadAnalyses(false);
        selectAnalysis(data.analysis_id);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setIsUploading(false);
    }
  };

  const handleCancelScan = async () => {
    if (!currentAnalysisId) return;
    try {
      await fetch(`/api/analyses/${currentAnalysisId}/cancel`, { method: 'POST' });
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setAnalysisData((prev) => (prev ? { ...prev, status: 'cancelled' } : prev));
      setActiveNode('idle');
      loadAnalyses(false);
    } catch (e) {
      console.error('Cancel failed:', e);
    }
  };

  // 5. Open Evidence Drawer
  const openArtifactDrawer = async (shortId) => {
    if (!currentAnalysisId) return;
    try {
      const res = await fetch(`/api/artifacts/${shortId}?analysis_id=${currentAnalysisId}`);
      if (res.ok) {
        const art = await res.json();
        setActiveArtifact(art);
      }
    } catch (err) {
      console.error('Artifact fetch failed:', err);
    }
  };

  const getVerdictClass = (verdict) => {
    if (verdict === 'likely_malicious') return 'likely_malicious';
    if (verdict === 'suspicious') return 'suspicious';
    return 'low_risk';
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">NERVE</div>
          <div className="brand-tagline">
            Agentic Android Malware Triage That Proves Its Claims
          </div>
        </div>

        <div className="config-badges">
          {config && (
            <>
              <div className="badge provider">
                <span>⚡ Provider:</span>
                <strong>{config.active_provider.toUpperCase()}</strong>
                <span style={{ opacity: 0.6 }}>({config.models.triage})</span>
              </div>
              <div className="badge intel">
                <span>🛡 Intel:</span>
                <strong>{config.intel_mode.toUpperCase()}</strong>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Navigation */}
      <nav className="nav-tabs">
        <button
          className={`nav-tab-btn ${activeTab === 'triage' ? 'active' : ''}`}
          onClick={() => setActiveTab('triage')}
        >
          🔍 Live Triage & Agent Graph
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'evidence' ? 'active' : ''}`}
          onClick={() => setActiveTab('evidence')}
        >
          📋 Hypotheses & Verified Claims ({findings.length})
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'score' ? 'active' : ''}`}
          onClick={() => setActiveTab('score')}
        >
          🎯 Risk Score & Explainability
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          📄 Executive & Technical Reports
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'benchmark' ? 'active' : ''}`}
          onClick={() => setActiveTab('benchmark')}
        >
          📊 v1 vs v2 Benchmark Proof
        </button>
      </nav>

      {/* Main Content Area */}
      <main>
        {/* Upload Zone */}
        <div className="upload-card">
          <div className="upload-icon">📦</div>
          <div className="upload-title">Drop an Android APK to Initiate Multi-Agent Triage</div>
          <div className="upload-subtitle">
            Statically inspected by specialized agents. Every claim is strictly validated by an independent Verifier.
          </div>

          <div className="upload-controls">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <span>Variant:</span>
              <select
                value={uploadVariant}
                onChange={(e) => setUploadVariant(e.target.value)}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                }}
              >
                <option value="v2_multi">v2 Nerve (Multi-Agent + Verifier)</option>
                <option value="v1_single">v1 Single-Agent Baseline</option>
              </select>
            </label>

            <label className="file-input-btn">
              {isUploading ? 'Uploading & Analyzing...' : 'Select APK File'}
              <input
                type="file"
                accept=".apk"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </label>

            {analyses.length > 0 && (
              <select
                value={currentAnalysisId || ''}
                onChange={(e) => {
                  if (!e.target.value) {
                    resetToNewScan();
                  } else {
                    selectAnalysis(e.target.value);
                  }
                }}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '13px',
                }}
              >
                <option value="">➕ New Scan / Drop APK</option>
                {analyses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.filename} ({a.verdict || a.status})
                  </option>
                ))}
              </select>
            )}

            {currentAnalysisId && (
              <button
                onClick={resetToNewScan}
                style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--accent-indigo)',
                  border: '1px solid var(--accent-indigo)',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                ➕ New Scan
              </button>
            )}

            {(analysisData?.status === 'running' || analysisData?.status === 'queued') && (
              <button
                onClick={handleCancelScan}
                style={{
                  background: 'rgba(244, 63, 94, 0.2)',
                  color: 'var(--accent-rose)',
                  border: '1px solid var(--accent-rose)',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                ⏹ Cancel Scan
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Live Triage & Agent Graph */}
        {activeTab === 'triage' && (
          <div>
            {/* Agent Network Visualizer */}
            <div className="network-container">
              <div className="section-title">
                <span>🤖 Multi-Agent Nervous System</span>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 400 }}>
                  (Independent Specialist Agents with Verification Separation)
                </span>
              </div>

              <div className="agent-nodes-grid">
                {[
                  { id: 'intake', icon: '📥', name: 'Intake', role: 'Hashes & APKiD' },
                  { id: 'orchestrator', icon: '🧭', name: 'Orchestrator', role: 'Supervisor' },
                  { id: 'static', icon: '🔎', name: 'Static Agent', role: 'Components & Perms' },
                  { id: 'reverse_eng', icon: '⚙️', name: 'Reverse Eng', role: 'Jadx & Smali' },
                  { id: 'threat_intel', icon: '🛡', name: 'Threat Intel', role: 'YARA & IOCs' },
                  { id: 'verifier', icon: '⚖️', name: 'Verifier Agent', role: 'Entailment & Proof' },
                  { id: 'score', icon: '🎯', name: 'Risk Scoring', role: 'Deterministic Noisy-OR' },
                  { id: 'report', icon: '📝', name: 'Report Writer', role: 'Citations [E-...]' },
                ].map((node) => (
                  <div
                    key={node.id}
                    className={`agent-node ${activeNode === node.id ? 'active' : ''} ${
                      analysisData?.status === 'completed' ? 'done' : ''
                    }`}
                  >
                    <div className="node-icon">{node.icon}</div>
                    <div className="node-name">{node.name}</div>
                    <div className="node-role">{node.role}</div>
                  </div>
                ))}
              </div>

              {/* Status and Shadow Cost Counters */}
              {analysisData && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <strong>Status:</strong>{' '}
                    <span style={{ textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
                      {analysisData.status}
                    </span>{' '}
                    | <strong>Package:</strong> {analysisData.metadata?.package_name || analysisData.filename}
                  </div>
                  <div>
                    <span>Reference Cost (cfo.ai): </span>
                    <strong style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                      ${analysisData.reference_cost_usd?.toFixed(4) || '0.0000'}
                    </strong>{' '}
                    <span style={{ color: 'var(--text-dim)' }}>(Free Tier: $0.00)</span>
                    {(analysisData.status === 'running' || analysisData.status === 'queued') && (
                      <button
                        onClick={handleCancelScan}
                        style={{
                          marginLeft: '16px',
                          background: 'rgba(244, 63, 94, 0.2)',
                          color: 'var(--accent-rose)',
                          border: '1px solid var(--accent-rose)',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        ⏹ Cancel Scan
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!analysisData && (
                <div
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px dashed var(--border-color)',
                    borderRadius: '8px',
                    padding: '20px',
                    textAlign: 'center',
                    color: 'var(--text-dim)',
                    fontSize: '13px',
                  }}
                >
                  Ready for analysis. Select an APK file above to start multi-agent triage, or choose a scan from history.
                </div>
              )}
            </div>

            {/* Live SSE Event Stream Box */}
            <div className="network-container">
              <div className="section-title">
                <span>⚡ Live Execution Trace Stream</span>
              </div>
              <div className="events-terminal">
                {events.length === 0 ? (
                  <div style={{ color: 'var(--text-dim)' }}>
                    Listening for analysis trace events...
                  </div>
                ) : (
                  events.map((ev, i) => (
                    <div key={i} className="event-line">
                      <span className="event-ts">[{ev.ts?.slice(11, 19)}]</span>
                      <span className="event-type">{ev.type}</span>
                      <span className="event-text">{JSON.stringify(ev.payload || {})}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Hypotheses & Verified Claims */}
        {activeTab === 'evidence' && (
          <div>
            <div className="section-title">
              <span>Verified Claims & Evidence Links</span>
              <span style={{ fontSize: '13px', color: 'var(--text-dim)', fontWeight: 400 }}>
                Every claim requires verified technical artifacts
              </span>
            </div>

            <div className="cards-grid">
              {findings.map((f) => (
                <div key={f.id} className="card">
                  <div>
                    <div className="card-header">
                      <div className="card-title">{f.title}</div>
                      <span
                        className="badge"
                        style={{
                          background:
                            f.verification === 'verified'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(244, 63, 94, 0.2)',
                          color:
                            f.verification === 'verified'
                              ? 'var(--accent-green)'
                              : 'var(--accent-rose)',
                          borderColor:
                            f.verification === 'verified'
                              ? 'var(--accent-green)'
                              : 'var(--accent-rose)',
                        }}
                      >
                        {f.verification?.toUpperCase() || 'UNVERIFIED'}
                      </span>
                    </div>

                    <div className="card-body">
                      <p style={{ marginBottom: '8px' }}>{f.claim}</p>
                      <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                        <strong>Verifier Note:</strong> {f.verifier_notes || 'Pending verifier judgment'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px' }}>
                      CITED EVIDENCE ARTIFACTS:
                    </div>
                    <div>
                      {f.evidence_ids?.map((eid) => (
                        <button
                          key={eid}
                          className="evidence-chip"
                          onClick={() => openArtifactDrawer(eid)}
                        >
                          📎 [E-{eid}]
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="section-title" style={{ marginTop: '24px' }}>
              <span>Behavior Hypotheses Formulated by Static Agent</span>
            </div>
            <div className="cards-grid">
              {hypotheses.map((h) => (
                <div key={h.id} className="card">
                  <div className="card-header">
                    <div className="card-title">[{h.id}] {h.category}</div>
                    <span className="badge">{h.status}</span>
                  </div>
                  <div className="card-body">
                    <p>{h.statement}</p>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
                      MITRE ATT&CK: {h.attack_technique || 'N/A'} | Confidence: {h.confidence}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Risk Score & Explainability */}
        {activeTab === 'score' && (
          <div>
            <div className="score-panel">
              <div className="score-dial">
                <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '8px' }}>
                  DETERMINISTIC RISK SCORE
                </div>
                <div className="score-value">{scoreData?.risk_score || 0}</div>
                <div className={`verdict-tag ${getVerdictClass(scoreData?.verdict)}`}>
                  {scoreData?.verdict?.replace('_', ' ') || 'CALCULATING'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px' }}>
                  Confidence: {scoreData?.confidence || 0.5}
                </div>
              </div>

              <div>
                <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>
                  Explainable Noisy-OR Contribution Breakdown
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  The score is mathematically computed over verified findings only. LLMs cannot modify the numeric score.
                </p>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-dim)' }}>
                      <th style={{ padding: '8px' }}>Rule</th>
                      <th style={{ padding: '8px' }}>Description</th>
                      <th style={{ padding: '8px' }}>Weight (w)</th>
                      <th style={{ padding: '8px' }}>Verifier Conf (v)</th>
                      <th style={{ padding: '8px' }}>Score Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoreData?.breakdown?.map((b) => (
                      <tr key={b.rule_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                          {b.rule_id}
                        </td>
                        <td style={{ padding: '8px' }}>{b.label}</td>
                        <td style={{ padding: '8px' }}>{b.weight}</td>
                        <td style={{ padding: '8px' }}>{b.verification_confidence}</td>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: 'var(--accent-amber)' }}>
                          +{b.contribution}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Reports View */}
        {activeTab === 'reports' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <button className="nav-tab-btn active">Executive Report</button>
              <button className="nav-tab-btn">Technical Report</button>
            </div>

            <div className="report-content">
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', lineHeight: 1.7 }}>
                {reports.executive}
              </pre>

              <hr style={{ borderColor: 'var(--border-color)', margin: '32px 0' }} />

              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', lineHeight: 1.7 }}>
                {reports.technical}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 5: Benchmark Proof */}
        {activeTab === 'benchmark' && benchmarkData && (
          <div className="network-container">
            <div className="section-title">
              <span>🏆 Hackathon Proof: v1 Baseline vs. v2 Nerve Multi-Agent</span>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Demonstrating measurable improvement in accuracy, elimination of hallucinated claims through the Verifier agent, and token efficiency.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-dim)' }}>
                  <th style={{ padding: '12px' }}>Evaluation Metric</th>
                  <th style={{ padding: '12px' }}>v1 Single-Agent Baseline</th>
                  <th style={{ padding: '12px', color: 'var(--accent-cyan)' }}>v2 Nerve (Multi-Agent + Verifier)</th>
                  <th style={{ padding: '12px', color: 'var(--accent-green)' }}>Improvement</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px' }}>Verdict Accuracy</td>
                  <td style={{ padding: '12px' }}>{benchmarkData.v1_single.verdict_accuracy}%</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{benchmarkData.v2_multi.verdict_accuracy}%</td>
                  <td style={{ padding: '12px', color: 'var(--accent-green)' }}>{benchmarkData.improvements.accuracy_delta}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px' }}>Unsupported / Hallucinated Claims</td>
                  <td style={{ padding: '12px', color: 'var(--accent-rose)' }}>{benchmarkData.v1_single.unsupported_claim_rate}%</td>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                    {benchmarkData.v2_multi.unsupported_claim_rate}%
                  </td>
                  <td style={{ padding: '12px', color: 'var(--accent-green)' }}>{benchmarkData.improvements.hallucination_reduction}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px' }}>Prompt-Injection Resistance</td>
                  <td style={{ padding: '12px' }}>{benchmarkData.v1_single.prompt_injection_resistance}%</td>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                    {benchmarkData.v2_multi.prompt_injection_resistance}%
                  </td>
                  <td style={{ padding: '12px', color: 'var(--accent-green)' }}>Complete resistance (Untrusted tag isolation)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px' }}>Average Tokens per Scan</td>
                  <td style={{ padding: '12px' }}>{benchmarkData.v1_single.avg_tokens.toLocaleString()}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{benchmarkData.v2_multi.avg_tokens.toLocaleString()}</td>
                  <td style={{ padding: '12px', color: 'var(--accent-green)' }}>{benchmarkData.improvements.token_reduction}</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px' }}>Reference Cost per Scan (cfo.ai)</td>
                  <td style={{ padding: '12px' }}>${benchmarkData.v1_single.ref_cost_per_scan_usd.toFixed(3)}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                    ${benchmarkData.v2_multi.ref_cost_per_scan_usd.toFixed(3)}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--accent-green)' }}>{benchmarkData.improvements.cost_reduction}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Evidence Drawer Modal */}
      {activeArtifact && (
        <div className="modal-overlay" onClick={() => setActiveArtifact(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', color: 'var(--accent-cyan)' }}>
                  Evidence Artifact: [{activeArtifact.id}]
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  Kind: {activeArtifact.kind} | Location: {activeArtifact.location}
                </div>
              </div>
              <button
                onClick={() => setActiveArtifact(null)}
                style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              SHA-256: {activeArtifact.content_sha256}
            </div>

            <div
              style={{
                background: '#07090e',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '16px',
                maxHeight: '400px',
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
              }}
            >
              {activeArtifact.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
