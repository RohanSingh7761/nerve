import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileCheck, Layers, Loader2, ShieldCheck } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';

export default function UploadCard() {
  const [variant, setVariant] = useState('v2_multi');
  const [isDragging, setIsDragging] = useState(false);
  const { isUploading, setIsUploading, loadAnalyses, selectAnalysis } = useAnalysis();
  const navigate = useNavigate();

  const handleUpload = async (file) => {
    if (!file || !file.name.endsWith('.apk')) {
      alert('Please select a valid Android APK file (.apk).');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('variant', variant);

    try {
      const res = await fetch('/api/analyses', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setIsUploading(false);

      if (data.analysis_id) {
        await loadAnalyses();
        await selectAnalysis(data.analysis_id);
        navigate(`/analyses/${data.analysis_id}/triage`);
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setIsUploading(false);
      alert('Upload request failed. Ensure backend is running.');
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 md:p-8">
      <div className="max-w-2xl mx-auto text-center">
        {/* Dropzone Container */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 transition flex flex-col items-center justify-center cursor-pointer ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
          }`}
        >
          <input
            type="file"
            accept=".apk"
            onChange={onFileChange}
            disabled={isUploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />

          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mb-4">
            {isUploading ? (
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
            ) : (
              <UploadCloud className="w-7 h-7" />
            )}
          </div>

          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {isUploading ? 'Uploading & Queuing Triage...' : 'Drop an Android APK to Initiate Triage'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mb-4">
            Static multi-agent decompilation, permission review, YARA matching, and independent verifier entailment.
          </p>

          <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs hover:bg-slate-50 transition pointer-events-none">
            <FileCheck className="w-4 h-4 text-indigo-600" />
            <span>Browse Files (.apk)</span>
          </div>
        </div>

        {/* Options & Variant Picker */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <Layers className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-slate-700">Triage Variant:</span>
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              disabled={isUploading}
              className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="v2_multi">v2 Nerve (Multi-Agent + Verifier Separation)</option>
              <option value="v1_single">v1 Baseline (Single-Agent Prompt)</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Isolated Safe Decompiler Sandboxing</span>
          </div>
        </div>
      </div>
    </div>
  );
}
