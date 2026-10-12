import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNerveStore } from '../../state/store';
import { AlertTriangle, AlertOctagon, Info, X } from 'lucide-react';

export const Toasts: React.FC = () => {
  const toasts = useNerveStore((state) => state.toasts);
  const dismissToast = useNerveStore((state) => state.dismissToast);

  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const isDanger = t.type === 'danger';
          const isWarning = t.type === 'warning';

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              className={`pointer-events-auto p-3.5 rounded-xl border shadow-lg flex items-start gap-3 backdrop-blur-md ${
                isDanger
                  ? 'bg-rose-50/95 border-rose-300 text-rose-900 shadow-rose-950/10'
                  : isWarning
                  ? 'bg-amber-50/95 border-amber-300 text-amber-900 shadow-amber-950/10'
                  : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-900/10'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isDanger ? (
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                ) : isWarning ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                ) : (
                  <Info className="w-4 h-4 text-indigo-600" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-xs tracking-tight">{t.title}</h4>
                <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed break-words font-sans">
                  {t.desc}
                </p>
              </div>

              <button
                onClick={() => dismissToast(t.id)}
                className="text-slate-400 hover:text-slate-700 p-0.5 shrink-0 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
