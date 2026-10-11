import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, Plus, BarChart3, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';

export default function Navbar() {
  const { config, analyses, currentAnalysisId } = useAnalysis();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSelectAnalysis = (e) => {
    const val = e.target.value;
    if (!val) {
      navigate('/');
    } else {
      navigate(`/analyses/${val}/triage`);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-4">
          <Link to="/" className="flex items-center space-x-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-indigo-700 transition">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 tracking-tight text-lg">NERVE</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                  v2 Agentic
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal">
                Android Malware Triage With Proof Verification
              </p>
            </div>
          </Link>
        </div>

        {/* System Badges & Actions */}
        <div className="flex items-center space-x-3">
          {config && (
            <div className="hidden md:flex items-center space-x-2 text-xs">
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-semibold text-slate-900">{config.active_provider.toUpperCase()}</span>
                <span className="text-slate-500 text-[11px]">({config.models?.triage || 'gemini-3-flash-preview'})</span>
              </div>
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Intel: <strong className="font-semibold text-slate-900">{config.intel_mode.toUpperCase()}</strong></span>
              </div>
            </div>
          )}

          {/* Quick Analysis History Dropdown */}
          {analyses.length > 0 && (
            <select
              value={currentAnalysisId || ''}
              onChange={handleSelectAnalysis}
              className="text-xs bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">History ({analyses.length} scans)</option>
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.filename.slice(0, 24)} ({a.verdict || a.status})
                </option>
              ))}
            </select>
          )}

          {/* Benchmark Link */}
          <Link
            to="/benchmark"
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              location.pathname === '/benchmark'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>v1 vs v2 Benchmark</span>
          </Link>

          {/* New Scan Action Button */}
          <Link
            to="/"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Scan</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
