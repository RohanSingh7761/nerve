import React, { useState } from 'react';
import { useNerveStore } from './state/store';
import { Navbar } from './components/Navbar.tsx';
import { UploadScanPage } from './pages/UploadScanPage.tsx';
import { LiveRun } from './components/live/LiveRun.tsx';
import { FindingsPage } from './pages/FindingsPage.tsx';
import { ScorePage } from './pages/ScorePage.tsx';
import { ReportsPage } from './pages/ReportsPage.tsx';
import { BenchmarkPage } from './pages/BenchmarkPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';

export default function App() {
  // Default to 'live' (agent graph page) upon opening as requested
  const [currentTab, setCurrentTab] = useState<string>('live');
  const { demoMode, startMockRun } = useNerveStore();

  const handleRunPreviousScan = () => {
    startMockRun();
    setCurrentTab('live');
  };

  return (
    <div className="min-h-screen h-screen w-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Top Navbar is hidden in demo mode for clean 1080p recording */}
      {!demoMode && (
        <Navbar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onRunPreviousScan={handleRunPreviousScan}
        />
      )}

      {/* Main Tab Screen */}
      <main className="flex-1 flex overflow-hidden">
        {currentTab === 'upload' && (
          <UploadScanPage
            onNavigateToLive={() => setCurrentTab('live')}
            onRunPreviousScan={handleRunPreviousScan}
          />
        )}
        {currentTab === 'live' && (
          <LiveRun
            onNavigateToReport={() => setCurrentTab('reports')}
            onNavigateToFindings={() => setCurrentTab('findings')}
          />
        )}
        {currentTab === 'findings' && <FindingsPage />}
        {currentTab === 'score' && <ScorePage />}
        {currentTab === 'reports' && <ReportsPage />}
        {currentTab === 'benchmark' && <BenchmarkPage />}
        {currentTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
