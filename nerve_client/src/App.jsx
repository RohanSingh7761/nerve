import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnalysisProvider } from './context/AnalysisContext';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import AnalysisLayout from './layouts/AnalysisLayout';
import TriagePage from './pages/TriagePage';
import EvidencePage from './pages/EvidencePage';
import ScorePage from './pages/ScorePage';
import ReportsPage from './pages/ReportsPage';
import BenchmarkPage from './pages/BenchmarkPage';

export default function App() {
  return (
    <BrowserRouter>
      <AnalysisProvider>
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Home Dashboard */}
              <Route path="/" element={<DashboardPage />} />

              {/* Benchmark Proof */}
              <Route path="/benchmark" element={<BenchmarkPage />} />

              {/* Analysis Routes */}
              <Route path="/analyses/:id" element={<AnalysisLayout />}>
                <Route index element={<Navigate to="triage" replace />} />
                <Route path="triage" element={<TriagePage />} />
                <Route path="evidence" element={<EvidencePage />} />
                <Route path="score" element={<ScorePage />} />
                <Route path="reports" element={<ReportsPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AnalysisProvider>
    </BrowserRouter>
  );
}
