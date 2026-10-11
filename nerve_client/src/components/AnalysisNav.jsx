import { NavLink, useParams } from 'react-router-dom';
import { Activity, ShieldCheck, Target, FileText, Ban, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';

export default function AnalysisNav() {
  const { id } = useParams();
  const { analysisData, findings, cancelScan } = useAnalysis();

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            <span>COMPLETED</span>
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <Activity className="w-3 h-3 text-blue-600" />
            <span>RUNNING</span>
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>QUEUED</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300">
            <Ban className="w-3 h-3 text-slate-500" />
            <span>CANCELLED</span>
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>FAILED</span>
          </span>
        );
    }
  };

  const isRunning = analysisData?.status === 'running' || analysisData?.status === 'queued';

  return (
    <div className="bg-white border-b border-slate-200 shadow-xs mb-6">
      {/* Target APK & Status Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          {getStatusBadge(analysisData?.status || 'queued')}
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-900 text-sm">
                {analysisData?.metadata?.package_name || analysisData?.filename || 'Loading APK...'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {analysisData?.sha256?.slice(0, 12)}...
              </span>
            </div>
            {analysisData?.variant && (
              <span className="text-xs text-slate-500">
                Mode: <strong className="text-slate-700">{analysisData.variant}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex items-center space-x-2">
            <span className="text-slate-500">Shadow Cost (cfo.ai):</span>
            <span className="font-mono font-semibold text-emerald-600">
              ${(analysisData?.reference_cost_usd || 0).toFixed(4)}
            </span>
            <span className="text-slate-400">(Free Tier: $0.00)</span>
          </div>

          {isRunning && (
            <button
              onClick={() => cancelScan(id)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Cancel Scan</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-2 sm:space-x-4 -mb-px">
          <NavLink
            to={`/analyses/${id}/triage`}
            className={({ isActive }) =>
              `inline-flex items-center space-x-2 py-3 px-3 border-b-2 text-xs font-medium transition ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`
            }
          >
            <Activity className="w-4 h-4" />
            <span>Live Triage & Graph</span>
          </NavLink>

          <NavLink
            to={`/analyses/${id}/evidence`}
            className={({ isActive }) =>
              `inline-flex items-center space-x-2 py-3 px-3 border-b-2 text-xs font-medium transition ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`
            }
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verified Claims & Hypotheses</span>
            {findings?.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-700 font-semibold">
                {findings.length}
              </span>
            )}
          </NavLink>

          <NavLink
            to={`/analyses/${id}/score`}
            className={({ isActive }) =>
              `inline-flex items-center space-x-2 py-3 px-3 border-b-2 text-xs font-medium transition ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`
            }
          >
            <Target className="w-4 h-4" />
            <span>Risk Score & Explainability</span>
          </NavLink>

          <NavLink
            to={`/analyses/${id}/reports`}
            className={({ isActive }) =>
              `inline-flex items-center space-x-2 py-3 px-3 border-b-2 text-xs font-medium transition ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`
            }
          >
            <FileText className="w-4 h-4" />
            <span>Executive & Technical Reports</span>
          </NavLink>
        </nav>
      </div>
    </div>
  );
}
