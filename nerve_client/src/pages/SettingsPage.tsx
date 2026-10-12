import React from 'react';
import { Cpu, Activity, CheckCircle2, Wrench } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto text-slate-800">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-900">
            System & Engine Configuration
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Telemetry pipelines, LLM provider fallback routing, and forensic tools status.
          </p>
        </div>

        {/* Neatlogs Tracing Card */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Activity className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-sm font-display text-slate-900">
                Neatlogs Agentic Tracing & Telemetry
              </h2>
            </div>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-50 border border-emerald-300 text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Active & Instrumenting</span>
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            All 8 agents stream inputs, outputs, tool invocations, and token latencies to Neatlogs via OpenTelemetry auto-instrumentation on LiteLLM and LangGraph callbacks.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase block mb-1 font-semibold">Project ID</span>
              <span className="text-slate-800 font-semibold">8508c472-dbc0-4684-a889-bb43c98eb977</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase block mb-1 font-semibold">Ingest Endpoint</span>
              <span className="text-slate-800 font-semibold">https://api.neatlogs.com/v1/traces</span>
            </div>
          </div>
        </div>

        {/* LLM Provider Fallback Router */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-sm font-display text-slate-900">
              Provider Failover Chain (LiteLLM Router)
            </h2>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            If rate limits (HTTP 429) or timeouts occur on the primary model, the router instantly fails over without dropping LangGraph state.
          </p>

          <div className="space-y-2 font-mono text-xs">
            <div className="p-3 rounded-lg bg-indigo-50/60 border border-indigo-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                <span className="text-slate-800 font-semibold">1. Primary Tier:</span>
                <span className="text-indigo-700 font-semibold">Google Gemini (gemini-2.5-flash)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300 font-semibold">
                ACTIVE
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-slate-500">2. Secondary Failover:</span>
                <span className="text-slate-700 font-medium">Groq (openai/gpt-oss-120b)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-semibold">
                STANDBY
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-slate-500">3. Tertiary Failover:</span>
                <span className="text-slate-700 font-medium">Cerebras (llama-3.3-70b)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-semibold">
                STANDBY
              </span>
            </div>
          </div>
        </div>

        {/* Forensic Engines & Tools Health */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-sm font-display text-slate-900">
              Forensics Engine Health
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] text-slate-400 uppercase block mb-1 font-semibold">JADX</span>
              <span className="text-emerald-700 font-semibold">v1.5.0 (Ready)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] text-slate-400 uppercase block mb-1 font-semibold">APKTool</span>
              <span className="text-emerald-700 font-semibold">v2.9.3 (Ready)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] text-slate-400 uppercase block mb-1 font-semibold">YARA Engine</span>
              <span className="text-emerald-700 font-semibold">48 Rules Indexed</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] text-slate-400 uppercase block mb-1 font-semibold">Database</span>
              <span className="text-emerald-700 font-semibold">SQLite Async</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
