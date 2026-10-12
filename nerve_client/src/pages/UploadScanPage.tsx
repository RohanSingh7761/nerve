import React, { useState, useEffect } from 'react';
import { useNerveStore } from '../state/store';
import {
  UploadCloud,
  FileCheck,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  Clock,
  Loader2,
} from 'lucide-react';

interface AnalysisRecord {
  id: string;
  sha256: string;
  filename: string;
  status: string;
  variant: string;
  verdict?: string;
  risk_score?: number;
  confidence?: number;
  created_at?: string;
}

interface UploadScanPageProps {
  onNavigateToLive: () => void;
  onRunPreviousScan: () => void;
}

export const UploadScanPage: React.FC<UploadScanPageProps> = ({
  onNavigateToLive,
  onRunPreviousScan,
}) => {
  const { startLiveRun } = useNerveStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [variant, setVariant] = useState<'v2_multi' | 'v1_single'>('v2_multi');
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState<{ file: File; data: any } | null>(null);

  // Fetch recent analyses from backend
  const loadRecentAnalyses = async () => {
    setLoadingAnalyses(true);
    try {
      const res = await fetch('/api/analyses?limit=10');
      if (res.ok) {
        const data = await res.json();
        setAnalyses(data);
      }
    } catch {
      // Backend not running or offline; ignore
    } finally {
      setLoadingAnalyses(false);
    }
  };

  useEffect(() => {
    loadRecentAnalyses();
  }, []);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.apk')) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError('Please select a valid Android APK file (.apk).');
      }
    }
  };

  const handleUpload = async (fileToUpload: File, forceRescan: boolean = false) => {
    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('variant', variant);
      if (forceRescan) {
        formData.append('force_rescan', 'true');
      }

      const res = await fetch('/api/analyses', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload returned status HTTP ${res.status}`);
      }

      const data = await res.json();
      setIsUploading(false);

      if (data.cached && !forceRescan) {
        setDuplicateModal({ file: fileToUpload, data });
        return;
      }

      if (data.analysis_id) {
        startLiveRun(data.analysis_id, fileToUpload.name, data.sha256);
        onNavigateToLive();
      } else {
        setError(data.error || 'Failed to dispatch analysis');
      }
    } catch (err: any) {
      setIsUploading(false);
      setError(err.message || 'Upload connection failed. Ensure backend is running.');
    }
  };

  const handleStartScan = () => {
    if (!selectedFile) {
      setError('Please select an APK file first.');
      return;
    }
    handleUpload(selectedFile, false);
  };

  const handleSelectRecent = (record: AnalysisRecord) => {
    startLiveRun(record.id, record.filename, record.sha256);
    onNavigateToLive();
  };

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto text-slate-800 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Multi-Agent Android Malware Triage Platform</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold font-display text-slate-900 tracking-tight">
              Upload an APK for Autonomous Forensic Triage
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Upload any Android package to trigger 8 LangGraph agents conducting decompilation, static analysis, threat intel, and zero-trust verifier checks.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={onRunPreviousScan}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-emerald-600" />
              <span>Run previous scan again</span>
            </button>
          </div>
        </div>

        {/* Upload Card */}
        <div className="p-6 md:p-8 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold font-display text-slate-900">
                1. Select Target Application (.apk)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                APK files are processed safely in sandboxed decompilation pipelines.
              </p>
            </div>

            {/* Architecture Variant Switcher */}
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-mono">
              <span className="text-slate-400 text-[11px] px-2 font-sans font-medium">PIPELINE:</span>
              <button
                onClick={() => setVariant('v2_multi')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  variant === 'v2_multi'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                v2 Multi-Agent (8 Agents)
              </button>
              <button
                onClick={() => setVariant('v1_single')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  variant === 'v1_single'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                v1 Single-Pass Baseline
              </button>
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${
              dragActive
                ? 'border-emerald-500 bg-emerald-50/50'
                : selectedFile
                ? 'border-emerald-400 bg-emerald-50/30'
                : 'border-slate-300 bg-slate-50/60 hover:border-emerald-500/60'
            }`}
          >
            {isUploading ? (
              <div className="py-6 flex flex-col items-center space-y-3">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                <span className="text-sm font-semibold text-slate-800">
                  Hashing & Starting Autonomous Analysis...
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Initializing LangGraph state channels
                </span>
              </div>
            ) : selectedFile ? (
              <div className="py-3 flex flex-col items-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900 block">
                    {selectedFile.name}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for triage
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-xs text-slate-500 hover:text-rose-600 px-3 py-1 rounded bg-slate-100 hover:bg-rose-50 border border-slate-200 transition-colors"
                  >
                    Change File
                  </button>
                  <button
                    onClick={handleStartScan}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <span>Start Analysis Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center space-y-3">
                <UploadCloud className="w-12 h-12 text-slate-400" />
                <div>
                  <span className="text-sm font-semibold text-slate-800 block">
                    Drag and drop your Android .apk file here
                  </span>
                  <span className="text-xs text-slate-500">
                    Supports APK binaries, split-APKs, and signed debug builds
                  </span>
                </div>

                <label className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors">
                  Browse Files
                  <input
                    type="file"
                    accept=".apk"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setSelectedFile(e.target.files[0]);
                        setError(null);
                      }
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Recent Analyses Section */}
        <div className="p-6 md:p-8 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold font-display text-slate-900">
                Recent Triage Analyses
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Past analysis runs saved in the Nerve database.
              </p>
            </div>

            <button
              onClick={loadRecentAnalyses}
              className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-mono text-slate-600 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Refresh</span>
            </button>
          </div>

          {loadingAnalyses ? (
            <div className="h-32 flex items-center justify-center text-slate-400 text-xs font-mono">
              Loading recent triage history...
            </div>
          ) : analyses.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
              <Clock className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">
                No past scans found in the database. Upload an APK above to start triage.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              <div className="grid grid-cols-12 gap-3 p-3 bg-slate-50 text-[11px] font-mono text-slate-500 uppercase font-semibold">
                <div className="col-span-5">Target Package / Hash</div>
                <div className="col-span-2">Variant</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Verdict / Score</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              {analyses.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-3 p-3.5 items-center hover:bg-slate-50/80 transition-colors text-xs"
                >
                  <div className="col-span-5">
                    <span className="font-semibold text-slate-800 block truncate">
                      {item.filename}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {item.sha256 ? `${item.sha256.slice(0, 12)}...` : item.id.slice(0, 8)}
                    </span>
                  </div>

                  <div className="col-span-2 font-mono text-[11px] text-slate-600">
                    {item.variant === 'v2_multi' ? 'v2 8-Agent' : 'v1 Baseline'}
                  </div>

                  <div className="col-span-2">
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold border ${
                        item.status === 'completed'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : item.status === 'running'
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700 animate-pulse'
                          : 'bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="col-span-2">
                    {item.verdict ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded ${
                            item.verdict === 'likely_malicious'
                              ? 'text-rose-700 bg-rose-50 border border-rose-200'
                              : item.verdict === 'suspicious'
                              ? 'text-amber-700 bg-amber-50 border border-amber-200'
                              : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                          }`}
                        >
                          {item.verdict.replace(/_/g, ' ')}
                        </span>
                        {item.risk_score !== undefined && (
                          <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                            {item.risk_score.toFixed(2)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 font-mono text-[11px]">—</span>
                    )}
                  </div>

                  <div className="col-span-1 text-right">
                    <button
                      onClick={() => handleSelectRecent(item)}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 text-[11px] font-mono transition-colors cursor-pointer"
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Duplicate Scan Resolution Modal */}
        {duplicateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Existing Hash Detected
                  </h3>
                  <p className="text-xs text-slate-500">
                    This exact APK binary was previously triaged.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">File:</span>
                  <span className="text-slate-800 font-bold truncate max-w-[200px]">
                    {duplicateModal.file.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Previous Verdict:</span>
                  <span className="text-rose-700 font-bold uppercase">
                    {duplicateModal.data.verdict || 'Completed'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Would you like to run a fresh scan from start across all 8 agents, or inspect existing results?
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    const f = duplicateModal.file;
                    setDuplicateModal(null);
                    handleUpload(f, true);
                  }}
                  className="flex-1 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Scan Again (From Start)
                </button>
                <button
                  onClick={() => {
                    const id = duplicateModal.data.analysis_id;
                    const f = duplicateModal.file.name;
                    setDuplicateModal(null);
                    startLiveRun(id, f);
                    onNavigateToLive();
                  }}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 cursor-pointer transition-colors"
                >
                  View Existing
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
