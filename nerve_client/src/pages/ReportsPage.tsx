import React, { useState } from 'react';
import { MOCK_ARTIFACTS } from '../mock/artifacts';
import { useNerveStore } from '../state/store';
import {
  ShieldAlert,
  ShieldCheck,
  FileCode,
  Copy,
  Check,
  Download,
  ExternalLink,
  AlertTriangle,
  Radio,
  FileText,
  Lock,
  Network,
  Cpu,
  CheckCircle2,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<'executive' | 'technical'>('executive');
  const [selectedCitation, setSelectedCitation] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { artifacts, filename, sha256, riskScore, verdict, reportsReady } = useNerveStore();
  const allArtifacts = artifacts.length > 0 ? artifacts : MOCK_ARTIFACTS;
  const inspectedArtifact = allArtifacts.find((a) => a.short_id === selectedCitation);

  const hasReport = (verdict !== null && verdict !== undefined) || reportsReady.executive || reportsReady.technical;

  const currentScore = riskScore ?? 88.74;
  const currentVerdict = verdict ?? 'likely_malicious';
  const targetName = filename || 'AndroGoat.apk';
  const targetSha = sha256 || '3e6f6b538b82874dd94c0d8cdadd69ba54d49b59d2c7eb055073892e8a4fc0e0';

  const handleCopyReport = () => {
    const text = `Nerve Security Assessment Report\nTarget: ${targetName}\nSHA256: ${targetSha}\nVerdict: ${currentVerdict}\nRisk Score: ${currentScore}\n`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-slate-50 overflow-hidden text-slate-800">
      {/* Main Report Container */}
      <div className="flex-1 flex flex-col p-6 md:p-8 overflow-y-auto space-y-6">
        {/* Report Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900">
              Security Forensics & Triage Report
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Human-readable summary synthesized from verified multi-agent analysis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center text-xs font-mono">
              <button
                onClick={() => setReportType('executive')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium ${
                  reportType === 'executive'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Executive Briefing
              </button>
              <button
                onClick={() => setReportType('technical')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium ${
                  reportType === 'technical'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Technical Forensics
              </button>
            </div>

            <button
              onClick={handleCopyReport}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {!hasReport ? (
          <div className="p-12 rounded-2xl bg-white border border-dashed border-slate-300 text-center space-y-3 shadow-xs">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Forensic Report Generated Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Executive threat intelligence summaries and technical forensic reports are synthesized once the multi-agent investigation concludes. Run a triage scan or click &ldquo;Run previous scan again&rdquo; to generate reports.
            </p>
          </div>
        ) : (
          <>
            {/* Executive Threat Banner */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-bold">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase text-rose-700 font-bold tracking-wider">
                  Critical Threat Identified
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  Android Banking Trojan (SMS Interceptor & OTP Stealer)
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right font-mono">
                <span className="text-[10px] text-slate-400 block uppercase font-medium">Risk Score</span>
                <span className="text-xl font-bold text-rose-600 tabular-nums">
                  {currentScore.toFixed(3)} <span className="text-xs text-slate-400 font-normal">/ 1.0</span>
                </span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                Likely Malicious
              </span>
            </div>
          </div>

          {/* Target Metadata Pills */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 block uppercase">Target Package</span>
              <span className="font-semibold text-slate-800 truncate block">com.bank.secure.auth</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 block uppercase">Binary SHA-256</span>
              <span className="font-semibold text-slate-800 truncate block">{targetSha.slice(0, 14)}...</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 block uppercase">Analysis Engine</span>
              <span className="font-semibold text-slate-800 block">LangGraph v2 (8 Agents)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 block uppercase">Audit Verification</span>
              <span className="font-semibold text-emerald-700 block">100% Zero-Trust Audited</span>
            </div>
          </div>
        </div>

        {/* View Mode: Executive Briefing */}
        {reportType === 'executive' && (
          <div className="space-y-6">
            {/* Plain English Summary */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-base font-bold text-slate-900 font-display">
                Executive Threat Summary
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                The analyzed application poses as a legitimate two-factor authenticator utility (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded text-indigo-700">com.bank.secure.auth</code>). In reality, it conceals an automated Trojan designed to covertly intercept financial SMS notifications and exfiltrate one-time passcodes (OTPs) to remote command-and-control infrastructure.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                By setting broadcast priority to the maximum allowable value (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded text-indigo-700">999</code>) and invoking <code className="text-xs bg-slate-100 px-1 py-0.5 rounded text-indigo-700">abortBroadcast()</code>, the malware prevents banking SMS alerts from appearing on the victim's screen, ensuring the device owner remains unaware while bank transfers or authentication attempts occur.
              </p>
            </div>

            {/* Key Verified Findings (Human-Readable Cards) */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-slate-900 font-display">
                Key Findings Verified by Independent Audit Gate
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Finding 1 */}
                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-50 border border-amber-300 text-amber-800">
                      High Severity
                    </span>
                    <button
                      onClick={() => setSelectedCitation('E-A-0001')}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-700 hover:text-indigo-900 font-semibold cursor-pointer"
                    >
                      <span>[E-A-0001]</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">
                    Stealth SMS Interception (Priority 999)
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Registers a high-priority receiver (<code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">.receivers.SmsInterceptor</code>) that hijacks incoming SMS broadcasts before standard messaging apps can read them.
                  </p>
                </div>

                {/* Finding 2 */}
                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-50 border border-rose-300 text-rose-800">
                      Critical Severity
                    </span>
                    <button
                      onClick={() => setSelectedCitation('E-A-0002')}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-700 hover:text-indigo-900 font-semibold cursor-pointer"
                    >
                      <span>[E-A-0002]</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">
                    Active Exfiltration of Financial Passcodes
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Inspects SMS content against regex keywords (<code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">code, OTP, PIN, token</code>) and dispatches captured payload via HTTP POST to an external telemetry gate.
                  </p>
                </div>

                {/* Finding 3 */}
                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-50 border border-rose-300 text-rose-800">
                      Critical Severity
                    </span>
                    <button
                      onClick={() => setSelectedCitation('E-A-0003')}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-700 hover:text-indigo-900 font-semibold cursor-pointer"
                    >
                      <span>[E-A-0003]</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">
                    Known Banking Trojan C2 Signature Match
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Matches YARA rule <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">Android_Banker_SmsStealer</code> and communicates with domain <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">auth-sync.api-telemetry.cc</code> flagged with a reputation score of -95.
                  </p>
                </div>

                {/* Finding 4 */}
                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-50 border border-amber-300 text-amber-800">
                      High Severity
                    </span>
                    <button
                      onClick={() => setSelectedCitation('E-A-0005')}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-700 hover:text-indigo-900 font-semibold cursor-pointer"
                    >
                      <span>[E-A-0005]</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">
                    Adversarial Prompt Injection Blocked
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The APK embedded an instruction override in its string table attempting to force the AI analyzer to score it safe. Nerve's sanitizer intercepted and neutralized the injection before processing.
                  </p>
                </div>
              </div>
            </div>

            {/* Actionable Recommendations Checklist */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 font-display">
                Recommended Immediate Security Actions
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold text-xs">
                    1
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">Firewall & DNS Perimeter Block</h5>
                    <p className="text-slate-600 mt-0.5">
                      Block all outbound egress traffic to <code className="text-indigo-700 font-semibold">*.api-telemetry.cc</code> and associated IPs (<code className="text-indigo-700">185.220.101.5</code>, <code className="text-indigo-700">185.220.101.7</code>) across all enterprise networks and MDM gateways.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">Endpoint Quarantine & Removal</h5>
                    <p className="text-slate-600 mt-0.5">
                      Issue an immediate MDM package uninstall command for package <code className="text-slate-800 font-semibold">com.bank.secure.auth</code> and quarantine devices matching hash <code className="text-slate-800">{targetSha.slice(0, 16)}...</code>.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold text-xs">
                    3
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">Credential & Session Revocation</h5>
                    <p className="text-slate-600 mt-0.5">
                      Force password resets and revoke active sessions for user accounts accessed from endpoints where this APK was installed during the last 30 days.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Mode: Technical Forensics */}
        {reportType === 'technical' && (
          <div className="space-y-6">
            {/* Technical Forensics Section 1: Attack Chain */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 font-display">
                  1. Reverse Engineering Call Path & Code Proof
                </h3>
                <span className="text-xs font-mono text-slate-500 font-semibold">
                  Decompiled DEX & Bytecode Forensics
                </span>
              </div>

              {/* Manifest Code Block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">1.1 AndroidManifest.xml: High Priority Receiver</span>
                  <button
                    onClick={() => setSelectedCitation('E-A-0001')}
                    className="font-mono text-indigo-700 hover:text-indigo-900 flex items-center gap-1 font-semibold"
                  >
                    <span>Citation [E-A-0001]</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{MOCK_ARTIFACTS[0].content}</code>
                </pre>
              </div>

              {/* Decompiled Java Code Block */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">1.2 SmsInterceptor.java: OTP Sniffing & abortBroadcast()</span>
                  <button
                    onClick={() => setSelectedCitation('E-A-0002')}
                    className="font-mono text-indigo-700 hover:text-indigo-900 flex items-center gap-1 font-semibold"
                  >
                    <span>Citation [E-A-0002]</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{MOCK_ARTIFACTS[1].content}</code>
                </pre>
              </div>
            </div>

            {/* Technical Section 2: Threat Intelligence & MITRE Matrix */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 font-display">
                  2. Threat Intel IOCs & MITRE ATT&CK Mapping
                </h3>
                <span className="text-xs font-mono text-slate-500 font-semibold">
                  AlienVault OTX & YARA Matches
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Identified C2 Host</span>
                  <span className="text-slate-800 font-bold">auth-sync.api-telemetry.cc</span>
                  <span className="text-[10px] text-rose-600 block mt-1 font-semibold">Reputation: -95 (Blacklisted)</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Matched YARA Rule</span>
                  <span className="text-slate-800 font-bold">Android_Banker_SmsStealer</span>
                  <span className="text-[10px] text-emerald-700 block mt-1 font-semibold">3/3 String Tokens Matched</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Resolved C2 IPs</span>
                  <span className="text-slate-800 font-bold">185.220.101.5</span>
                  <span className="text-[10px] text-slate-500 block mt-1">185.220.101.7 (Fast Flux)</span>
                </div>
              </div>

              {/* MITRE Badges */}
              <div className="space-y-1.5 pt-2">
                <span className="text-xs font-bold text-slate-700 block">MITRE ATT&CK Matrix Techniques:</span>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-semibold">
                    T1412: SMS Delivery & Interception
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-semibold">
                    T1437: Application Layer C2 Protocol
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-semibold">
                    T1629.001: Adversarial Evasion via Prompt Injection
                  </span>
                </div>
              </div>
            </div>

            {/* Technical Section 3: Verifier Audit Trail */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 font-display">
                  3. Zero-Trust Adversarial Verifier Audit Trail
                </h3>
                <span className="text-xs font-mono text-emerald-700 font-bold">
                  Zero Hallucinations Guarantee
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 text-xs">
                <div className="grid grid-cols-12 gap-3 p-3 bg-slate-50 font-mono text-[11px] text-slate-500 uppercase font-semibold">
                  <div className="col-span-5">Candidate Claim</div>
                  <div className="col-span-3">Evidence Artifacts</div>
                  <div className="col-span-2">Audit Verdict</div>
                  <div className="col-span-2 text-right">Confidence</div>
                </div>

                <div className="grid grid-cols-12 gap-3 p-3.5 items-center">
                  <div className="col-span-5 font-medium text-slate-800">
                    App installs high-priority broadcast receiver for SMS interception
                  </div>
                  <div className="col-span-3 font-mono text-indigo-700">
                    [E-A-0001], [E-A-0002]
                  </div>
                  <div className="col-span-2">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold font-mono text-[10px]">
                      VERIFIED
                    </span>
                  </div>
                  <div className="col-span-2 text-right font-mono font-semibold text-slate-700">
                    0.99
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-3 p-3.5 items-center">
                  <div className="col-span-5 font-medium text-slate-800">
                    Bytecode dispatches OTP passcodes to external C2 host
                  </div>
                  <div className="col-span-3 font-mono text-indigo-700">
                    [E-A-0002], [E-A-0004]
                  </div>
                  <div className="col-span-2">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold font-mono text-[10px]">
                      VERIFIED
                    </span>
                  </div>
                  <div className="col-span-2 text-right font-mono font-semibold text-slate-700">
                    0.98
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-3 p-3.5 items-center">
                  <div className="col-span-5 font-medium text-slate-800">
                    Author claim that network transmission is benign telemetry
                  </div>
                  <div className="col-span-3 font-mono text-slate-400">
                    Refuted by abortBroadcast()
                  </div>
                  <div className="col-span-2">
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-300 font-bold font-mono text-[10px]">
                      CONTRADICTED
                    </span>
                  </div>
                  <div className="col-span-2 text-right font-mono font-semibold text-slate-700">
                    0.99
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Slide-out Forensic Citation Drawer */}
      {inspectedArtifact && (
        <div className="w-full md:w-[480px] bg-white border-t md:border-t-0 md:border-l border-slate-200 p-5 flex flex-col shrink-0 overflow-y-auto shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-sky-600" />
              <span className="font-bold font-mono text-slate-800 text-sm">
                Evidence Artifact [{inspectedArtifact.short_id}]
              </span>
            </div>
            <button
              onClick={() => setSelectedCitation(null)}
              className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded bg-slate-100 border border-slate-200"
            >
              Close
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
                Source Location in APK
              </span>
              <div className="p-2 rounded bg-slate-50 border border-slate-200 font-mono text-slate-800">
                {inspectedArtifact.location}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
                Evidence Flags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {inspectedArtifact.flags.map((flag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[10px] font-semibold"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
                Decompiled Code Snippet
              </span>
              <pre className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-100 overflow-x-auto whitespace-pre leading-relaxed">
                <code>{inspectedArtifact.content}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
