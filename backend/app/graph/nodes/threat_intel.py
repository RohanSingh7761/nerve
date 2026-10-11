"""Threat Intelligence Agent: YARA rule scanning, local blocklists, and IOC evaluation (§6.5)."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Any, Optional

from app.config import get_settings
from app.graph.state import ArtifactModel, FindingModel, NerveState
from app.tools.intel import check_local_blocklists, extract_iocs_from_strings, query_virustotal_hash
from app.tools.yara_scan import scan_yara

logger = logging.getLogger("nerve.nodes.threat_intel")


async def threat_intel_node(state: NerveState) -> dict[str, Any]:
    """Runs offline YARA checks, blocklist matching, and IOC extraction."""
    apk_path = Path(state["apk_path"])
    sha256 = state.get("sha256", "")
    meta = state.get("apk_meta", {})
    cert_sha256 = meta.get("signing_cert_sha256", "")
    strings = meta.get("strings", [])

    new_artifacts: list[ArtifactModel] = []
    new_findings: list[FindingModel] = []
    settings = get_settings()

    # 1. Local Blocklist Match
    blocklist_hits = check_local_blocklists(sha256, cert_sha256)
    for hit in blocklist_hits:
        art_id = f"A-INTEL-{hit.type.upper()}"
        content_desc = f"Hit on blocklist: {hit.value} ({hit.source})"
        new_artifacts.append(
            ArtifactModel(
                id=art_id,
                kind="intel_record",
                location=f"blocklist:{hit.type}",
                content=content_desc,
                content_sha256=hashlib.sha256(content_desc.encode()).hexdigest(),
            )
        )
        new_findings.append(
            FindingModel(
                id=f"F-INTEL-{hit.type.upper()}",
                hypothesis_id="H-INTEL",
                title=f"Known Malicious {hit.type.capitalize()} on Blocklist",
                severity="critical",
                claim=f"Sample or signing certificate matched known malicious blocklist entry ({hit.source}).",
                rule_id="R06",
                evidence_ids=[art_id],
                verification="verified",
                verification_confidence=1.0,
                verifier_notes="Matched verified deterministic blocklist entry.",
            )
        )

    # 2. YARA Scan
    yara_matches = scan_yara(apk_path)
    for ym in yara_matches:
        art_id = f"A-YARA-{ym.rule[:8]}"
        content_desc = f"YARA rule '{ym.rule}' matched. Meta: {ym.meta}"
        new_artifacts.append(
            ArtifactModel(
                id=art_id,
                kind="yara_match",
                location=f"rules/yara/{ym.rule}",
                content=content_desc,
                content_sha256=hashlib.sha256(content_desc.encode()).hexdigest(),
            )
        )
        new_findings.append(
            FindingModel(
                id=f"F-YARA-{ym.rule[:8]}",
                hypothesis_id="H-YARA",
                title=f"YARA Detection: {ym.rule}",
                severity=ym.meta.get("severity", "high"),
                claim=f"APK matched YARA signature '{ym.rule}': {ym.meta.get('description', '')}.",
                rule_id="R06",
                evidence_ids=[art_id],
                verification="verified",
                verification_confidence=0.95,
                verifier_notes="YARA rule pattern matched in binary.",
            )
        )

    # 3. IOC extraction
    extracted_iocs = extract_iocs_from_strings(strings)
    suspicious_iocs = [ioc for ioc in extracted_iocs if ioc.reputation == "suspicious"]
    if suspicious_iocs:
        ioc_lines = "\n".join([f"- {i.type}: {i.value} (rep: {i.reputation})" for i in suspicious_iocs[:10]])
        art_id = "A-IOC-SUSP"
        new_artifacts.append(
            ArtifactModel(
                id=art_id,
                kind="ioc",
                location="strings#iocs",
                content=ioc_lines,
                content_sha256=hashlib.sha256(ioc_lines.encode()).hexdigest(),
            )
        )
        new_findings.append(
            FindingModel(
                id="F-IOC-SUSP",
                hypothesis_id="H-IOC",
                title="Suspicious Network Endpoints / C2 Indicators Detected",
                severity="medium",
                claim="Analysis of application strings revealed suspicious network endpoints or C2 patterns.",
                rule_id="R05",
                evidence_ids=[art_id],
            )
        )

    # 4. Optional online VirusTotal check
    if settings.intel_mode == "online" and settings.vt_api_key:
        vt_data = await query_virustotal_hash(sha256, settings.vt_api_key)
        if vt_data and vt_data.get("malicious", 0) > 0:
            art_id = "A-VT-REC"
            vt_desc = f"VirusTotal score: {vt_data['malicious']} / {vt_data.get('total', 70)} engines flagged as malicious."
            new_artifacts.append(
                ArtifactModel(
                    id=art_id,
                    kind="intel_record",
                    location="virustotal.com/api/v3",
                    content=vt_desc,
                    content_sha256=hashlib.sha256(vt_desc.encode()).hexdigest(),
                )
            )
            new_findings.append(
                FindingModel(
                    id="F-VT-FLAG",
                    hypothesis_id="H-INTEL",
                    title="VirusTotal Reputation Alert",
                    severity="high",
                    claim=f"Sample hash recognized on VirusTotal with {vt_data['malicious']} detection engines.",
                    rule_id="R05",
                    evidence_ids=[art_id],
                )
            )

    return {
        "artifacts": new_artifacts,
        "findings": new_findings,
        "messages": [
            {
                "from_agent": "threat_intel",
                "to_agent": "orchestrator",
                "type": "handoff",
                "payload": {
                    "yara_matches": len(yara_matches),
                    "blocklist_hits": len(blocklist_hits),
                },
            }
        ],
    }
