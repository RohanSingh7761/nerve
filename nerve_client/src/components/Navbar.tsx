import React from 'react';
import { useNerveStore } from '../state/store';
import {
  UploadCloud,
  Activity,
  ShieldAlert,
  Percent,
  FileText,
  BarChart2,
  Settings,
  Radio,
  RotateCcw,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onRunPreviousScan: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, onRunPreviousScan }) => {
  const { status, isLive } = useNerveStore();
  const isRunning = status === 'running';

  const navItems = [
    { id: 'upload', label: 'Upload & Scan', icon: UploadCloud },
    { id: 'live', label: 'Live Agent Graph', icon: Activity, badge: isRunning },
    { id: 'findings', label: 'Findings', icon: ShieldAlert },
    { id: 'score', label: 'Risk Score', icon: Percent },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'benchmark', label: 'Eval Benchmark', icon: BarChart2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 select-none z-30 shadow-xs">
      {/* Brand logo */}
      <div className="flex items-center gap-6">
        <div
          onClick={() => onSelectTab('upload')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-sm">
            <Radio className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-wider text-slate-900 font-display">
              NERVE
            </span>
            <span className="text-[10px] text-emerald-600 font-mono block -mt-1 font-semibold tracking-tight">
              AGENTIC TRIAGE
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-100 text-indigo-700 border border-slate-300 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>

                {item.badge && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute -top-0.5 -right-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Controls: Run previous scan again */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRunPreviousScan}
          className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          title="Run previous scan again"
        >
          <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
          <span>Run previous scan again</span>
        </button>
      </div>
    </nav>
  );
};
