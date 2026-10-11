import { RefreshCw, FileText, X } from 'lucide-react';

export default function DuplicateScanModal({ isOpen, modalData, onRescan, onViewExisting, onClose }) {
  if (!isOpen || !modalData) return null;

  const { data, file } = modalData;
  const sha = data.sha256 || '';
  const verdict = data.verdict || 'completed';

  const getVerdictStyle = (v) => {
    switch (v) {
      case 'likely_malicious':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'suspicious':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low_risk':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Identical APK Hash Detected
              </h3>
              <p className="text-xs text-slate-500">
                This exact APK was already analyzed.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing Analysis Summary Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Target File:</span>
            <span className="font-semibold text-slate-800 truncate max-w-[200px]">
              {file?.name || data.filename}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">SHA-256:</span>
            <span className="font-mono text-slate-700 text-[11px]">
              {sha.slice(0, 16)}...
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
            <span className="text-slate-500 font-medium">Previous Verdict:</span>
            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] border ${getVerdictStyle(verdict)}`}>
              {verdict.replace('_', ' ')}
            </span>
          </div>

          {data.created_at && (
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Analyzed:</span>
              <span>{new Date(data.created_at).toLocaleString()}</span>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Would you like to run a <strong>fresh scan from start</strong> through all 8 agents, or view the <strong>existing triage results</strong>?
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            onClick={onRescan}
            className="flex-1 inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Scan Again (From Start)</span>
          </button>

          <button
            onClick={onViewExisting}
            className="flex-1 inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            <span>View Existing</span>
          </button>
        </div>
      </div>
    </div>
  );
}
