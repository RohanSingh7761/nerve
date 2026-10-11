import { useState } from 'react';
import { X, Copy, Check, FileCode, Hash, Database } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';

export default function EvidenceDrawer() {
  const { activeArtifact, closeArtifactDrawer } = useAnalysis();
  const [copied, setCopied] = useState(false);

  if (!activeArtifact) return null;

  const contentStr =
    typeof activeArtifact.data === 'string'
      ? activeArtifact.data
      : JSON.stringify(activeArtifact.data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(contentStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 h-full flex flex-col transform transition-transform">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-slate-900 text-sm">
                  Technical Evidence Artifact
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-800">
                  [E-{activeArtifact.short_id || activeArtifact.id?.slice(0, 8)}]
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                Type: {activeArtifact.type || 'generic_evidence'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition"
              title="Copy Evidence Payload"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Payload</span>
                </>
              )}
            </button>

            <button
              onClick={closeArtifactDrawer}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metadata Details */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white text-xs grid grid-cols-2 gap-3 text-slate-600">
          <div className="flex items-center space-x-2">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">SHA-256:</span>
            <span className="font-mono text-slate-800 text-[11px] truncate">
              {activeArtifact.sha256 || 'N/A'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">MIME / Size:</span>
            <span className="font-mono text-slate-800 text-[11px]">
              {activeArtifact.mime_type || 'application/json'} ({activeArtifact.size_bytes || contentStr.length} bytes)
            </span>
          </div>
        </div>

        {/* Payload Content Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs">
            <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
              Extracted Raw Artifact Evidence
            </div>
            <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap break-all leading-relaxed bg-slate-50 p-4 rounded-md border border-slate-200 overflow-x-auto max-h-[60vh]">
              {contentStr}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white text-xs text-slate-500 flex justify-between items-center">
          <span>Cryptographically tied to immutable SQLite/Postgres artifact store</span>
          <button
            onClick={closeArtifactDrawer}
            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
