import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import AnalysisNav from '../components/AnalysisNav';
import ScanProgressBar from '../components/ScanProgressBar';
import EvidenceDrawer from '../components/EvidenceDrawer';
import { useAnalysis } from '../context/AnalysisContext';

export default function AnalysisLayout() {
  const { id } = useParams();
  const { currentAnalysisId, selectAnalysis } = useAnalysis();

  useEffect(() => {
    if (id && id !== currentAnalysisId) {
      selectAnalysis(id);
    }
  }, [id, currentAnalysisId, selectAnalysis]);

  return (
    <div className="flex-1 flex flex-col">
      <AnalysisNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 w-full flex-1">
        <ScanProgressBar />
        <Outlet />
      </div>
      <EvidenceDrawer />
    </div>
  );
}
