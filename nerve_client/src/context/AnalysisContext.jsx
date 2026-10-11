import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AnalysisContext = createContext(null);

export function AnalysisProvider({ children }) {
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
  const [benchmarkData, setBenchmarkData] = useState(null);
  const eventSourceRef = useRef(null);

  const loadAnalyses = useCallback(async () => {
    try {
      const res = await fetch('/api/analyses');
      if (res.ok) {
        const data = await res.json();
        setAnalyses(data);
        return data;
      }
    } catch (err) {
      console.error('Analyses fetch error:', err);
    }
    return [];
  }, []);

  const startEventStream = useCallback((id) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const es = new EventSource(`/api/analyses/${id}/events`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        setEvents((prev) => [parsed, ...prev.slice(0, 99)]);

        const t = parsed.type || '';
        if (t.includes('intake')) setActiveNode('intake');
        else if (t.includes('orchestrator')) setActiveNode('orchestrator');
        else if (t.includes('static')) setActiveNode('static');
        else if (t.includes('reverse') || t.includes('jadx')) setActiveNode('reverse_eng');
        else if (t.includes('yara') || t.includes('intel')) setActiveNode('threat_intel');
        else if (t.includes('verify') || t.includes('finding')) setActiveNode('verifier');
        else if (t.includes('score')) setActiveNode('score');
        else if (t.includes('cancelled')) {
          setActiveNode('idle');
          loadAnalyses();
        } else if (t.includes('report') || t.includes('completed')) {
          setActiveNode('done');
          loadAnalyses();
        }
      } catch (err) {
        console.error('Event parse error:', err);
      }
    };

    es.onerror = () => {
      es.close();
    };
  }, [loadAnalyses]);

  // Load initial application data on mount
  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const [cfg, bench, ana] = await Promise.all([
          fetch('/api/config').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/eval/compare').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/analyses').then((r) => (r.ok ? r.json() : [])),
        ]);
        if (!ignore) {
          if (cfg) setConfig(cfg);
          if (bench) setBenchmarkData(bench);
          if (ana) setAnalyses(ana);
        }
      } catch (err) {
        console.error('Initial fetch failed:', err);
      }
    }
    init();

    return () => {
      ignore = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const selectAnalysis = useCallback(async (id) => {
    if (!id) {
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
      return;
    }

    setCurrentAnalysisId(id);
    setEvents([]);

    try {
      const [anaRes, hypRes, findRes, scoreRes, repExecRes, repTechRes] = await Promise.all([
        fetch(`/api/analyses/${id}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/analyses/${id}/hypotheses`).then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/analyses/${id}/findings`).then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/analyses/${id}/score`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/analyses/${id}/reports/executive`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/analyses/${id}/reports/technical`).then((r) => (r.ok ? r.json() : null)),
      ]);

      setAnalysisData(anaRes);
      setHypotheses(hypRes || []);
      setFindings(findRes || []);
      setScoreData(scoreRes);
      setReports({
        executive: repExecRes?.markdown || 'Executive report will appear here once generated.',
        technical: repTechRes?.markdown || 'Technical report will appear here once generated.',
      });

      if (anaRes && (anaRes.status === 'running' || anaRes.status === 'queued')) {
        startEventStream(id);
      } else {
        setActiveNode(anaRes?.status === 'completed' ? 'done' : 'idle');
      }
    } catch (e) {
      console.error('Failed to load analysis details:', e);
    }
  }, [startEventStream]);

  const cancelScan = useCallback(async (id = currentAnalysisId) => {
    if (!id) return;
    try {
      await fetch(`/api/analyses/${id}/cancel`, { method: 'POST' });
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setAnalysisData((prev) => (prev && prev.id === id ? { ...prev, status: 'cancelled' } : prev));
      setActiveNode('idle');
      await loadAnalyses();
    } catch (e) {
      console.error('Cancel failed:', e);
    }
  }, [currentAnalysisId, loadAnalyses]);

  const openArtifactDrawer = useCallback(async (shortId, analysisId = currentAnalysisId) => {
    if (!analysisId || !shortId) return;
    try {
      const res = await fetch(`/api/artifacts/${shortId}?analysis_id=${analysisId}`);
      if (res.ok) {
        const art = await res.json();
        setActiveArtifact(art);
      }
    } catch (err) {
      console.error('Artifact fetch failed:', err);
    }
  }, [currentAnalysisId]);

  const closeArtifactDrawer = useCallback(() => {
    setActiveArtifact(null);
  }, []);

  return (
    <AnalysisContext.Provider
      value={{
        config,
        analyses,
        currentAnalysisId,
        analysisData,
        hypotheses,
        findings,
        scoreData,
        reports,
        events,
        activeNode,
        activeArtifact,
        isUploading,
        setIsUploading,
        benchmarkData,
        loadAnalyses,
        selectAnalysis,
        cancelScan,
        openArtifactDrawer,
        closeArtifactDrawer,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
}
