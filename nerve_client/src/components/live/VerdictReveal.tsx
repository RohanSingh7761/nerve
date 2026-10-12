import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNerveStore } from '../../state/store';
import { ArrowRight, X, FileText } from 'lucide-react';
import { VERDICT_STAMP_SPRING } from '../../motion/tokens';

interface VerdictRevealProps {
  onNavigateToReport?: () => void;
  onNavigateToFindings?: () => void;
}

export const VerdictReveal: React.FC<VerdictRevealProps> = ({
  onNavigateToReport,
  onNavigateToFindings,
}) => {
  const { status, verdict, riskScore, scoreContributions, filename } = useNerveStore();
  const [dismissed, setDismissed] = React.useState(false);

  // Reset dismissed state if run resets or starts again
  React.useEffect(() => {
    if (status === 'running') {
      setDismissed(false);
    }
  }, [status]);

  if (status !== 'completed' || !verdict || dismissed) {
    return null;
  }

  const isMalicious = verdict === 'likely_malicious';
  const isSuspicious = verdict === 'suspicious';

  const verdictColor = isMalicious
    ? '#DC2626'
    : isSuspicious
    ? '#D97706'
    : '#059669';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-xl rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl text-slate-800 overflow-hidden"
          style={{
            boxShadow: `0 20px 40px -15px ${verdictColor}30`,
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-semibold block mb-1">
              Autonomous Triage Complete
            </span>
            <h2 className="text-xl font-bold font-display text-slate-900 truncate">
              {filename}
            </h2>
          </div>

          {/* Central Score & Stamp Container */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            {/* Score Ring */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1 font-semibold">
                Risk Score
              </span>
              <div
                className="text-4xl font-extrabold font-mono tabular-nums tracking-tight"
                style={{ color: verdictColor }}
              >
                {(riskScore ?? 0).toFixed(3)}
              </div>
              <span className="text-[11px] text-slate-500 font-mono mt-0.5 font-medium">scale: 0.0 - 1.0</span>
            </div>

            <div className="w-px h-16 bg-slate-200 hidden sm:block" />

            {/* Dramatic Animated Stamp */}
            <motion.div
              initial={{ scale: 2.2, opacity: 0, rotate: -15 }}
              animate={{ scale: 1, opacity: 1, rotate: -4 }}
              transition={VERDICT_STAMP_SPRING}
              className="px-6 py-2.5 rounded-lg border-4 font-display font-extrabold text-xl sm:text-2xl tracking-widest uppercase shadow-md select-none"
              style={{
                borderColor: verdictColor,
                color: verdictColor,
                backgroundColor: `${verdictColor}12`,
              }}
            >
              {verdict.replace(/_/g, ' ')}
            </motion.div>
          </div>

          {/* Noisy-OR Score Contribution Breakdown */}
          {scoreContributions.length > 0 && (
            <div className="mb-6 space-y-2">
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold block mb-2">
                Bayesian Rule Attribution (Noisy-OR)
              </span>
              <div className="space-y-1.5 font-mono text-xs">
                {scoreContributions.map((c) => (
                  <div
                    key={c.rule_id}
                    className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between"
                  >
                    <span className="text-slate-700 truncate max-w-[280px] font-medium">
                      {c.label}
                    </span>
                    <span className="text-amber-700 font-bold tabular-nums ml-2">
                      +{(c.contribution * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTAs */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => {
                setDismissed(true);
                onNavigateToFindings?.();
              }}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Explore Findings</span>
            </button>

            <button
              onClick={() => {
                setDismissed(true);
                onNavigateToReport?.();
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View Full Report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
