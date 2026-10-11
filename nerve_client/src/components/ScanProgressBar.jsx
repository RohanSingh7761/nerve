import { CheckCircle2, Loader2, AlertTriangle, Ban } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';

const STEPS = [
  { id: 'intake', label: 'Intake', desc: 'Hashes & Unpack' },
  { id: 'orchestrator', label: 'Orchestrator', desc: 'Triage Depth' },
  { id: 'static', label: 'Static Analysis', desc: 'Manifest & Perms' },
  { id: 'reverse_eng', label: 'Reverse Eng', desc: 'Jadx Decompilation' },
  { id: 'threat_intel', label: 'Threat Intel', desc: 'YARA & IOCs' },
  { id: 'verifier', label: 'Verifier Agent', desc: 'Claim Entailment' },
  { id: 'score', label: 'Risk Scoring', desc: 'Deterministic Math' },
  { id: 'report', label: 'Reports', desc: 'Citations & Export' },
];

export default function ScanProgressBar() {
  const { analysisData, activeNode } = useAnalysis();

  if (!analysisData) return null;

  const status = analysisData.status || 'queued';
  const isRunning = status === 'running' || status === 'queued';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isCancelled = status === 'cancelled';

  // Determine current active step index (0-based)
  const getStepIndex = () => {
    if (isCompleted) return 8;
    if (activeNode === 'intake') return 0;
    if (activeNode === 'orchestrator') return 1;
    if (activeNode === 'static') return 2;
    if (activeNode === 'reverse_eng') return 3;
    if (activeNode === 'threat_intel') return 4;
    if (activeNode === 'verifier') return 5;
    if (activeNode === 'score') return 6;
    if (activeNode === 'report' || activeNode === 'done') return 7;
    return 0;
  };

  const currentStepIdx = getStepIndex();
  const percentage = isCompleted
    ? 100
    : isCancelled || isFailed
    ? Math.round(((currentStepIdx + 1) / 8) * 100)
    : Math.max(12, Math.round(((currentStepIdx + 1) / 8) * 100));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 mb-6 space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          {isRunning && <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />}
          {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          {isFailed && <AlertTriangle className="w-4 h-4 text-rose-600" />}
          {isCancelled && <Ban className="w-4 h-4 text-slate-500" />}

          <h3 className="text-sm font-bold text-slate-900">
            {isCompleted && 'Triage Complete: All 8 Steps Finished Successfully'}
            {isRunning && `Executing Step ${Math.min(currentStepIdx + 1, 8)} of 8: ${STEPS[Math.min(currentStepIdx, 7)].label}`}
            {isFailed && `Scan Halted: ${analysisData.error || 'Execution encountered an error'}`}
            {isCancelled && 'Scan Cancelled by User'}
          </h3>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="text-slate-400 font-mono">
            Progress: <strong className="text-slate-800">{percentage}%</strong>
          </span>
          <span
            className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
              isCompleted
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : isRunning
                ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                : isFailed
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Visual Progress Bar Track */}
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isCompleted
              ? 'bg-emerald-500'
              : isFailed
              ? 'bg-rose-500'
              : isCancelled
              ? 'bg-slate-400'
              : 'bg-indigo-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* 8-Step Stepper Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
        {STEPS.map((step, idx) => {
          const stepDone = isCompleted || idx < currentStepIdx;
          const stepCurrent = isRunning && idx === currentStepIdx;
          const stepPending = !isCompleted && idx > currentStepIdx;

          return (
            <div
              key={step.id}
              className={`p-2.5 rounded-lg border text-center transition flex flex-col justify-between ${
                stepCurrent
                  ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                  : stepDone
                  ? 'border-emerald-200 bg-emerald-50/30'
                  : 'border-slate-200 bg-slate-50/50 opacity-70'
              }`}
            >
              <div className="flex items-center justify-center space-x-1 mb-1">
                {stepDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                {stepCurrent && <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />}
                {stepPending && <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                <span className="text-[10px] font-mono text-slate-400">{idx + 1}</span>
              </div>
              <div className="text-xs font-semibold text-slate-900 truncate">
                {step.label}
              </div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                {step.desc}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
