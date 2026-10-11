"""Reverse Engineering Agent: deep code investigation, minimal snippet extraction, and fallback chains (§6.4, §9.1)."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

from app.graph.state import ArtifactModel, FindingModel, HypothesisModel, NerveState
from app.llm.client import complete_json
from app.security.untrusted import wrap_untrusted
from app.tools.apktool import disassemble_apk, search_smali
from app.tools.jadx import decompile_apk, extract_snippet

logger = logging.getLogger("nerve.nodes.reverse_eng")

# Category to code indicator mapping
CATEGORY_INDICATORS = {
    "sms_interception": ["SmsManager", "sendTextMessage", "SMS_RECEIVED", "getDisplayMessageBody"],
    "accessibility_abuse": ["AccessibilityService", "onAccessibilityEvent", "performGlobalAction"],
    "dynamic_code_loading": ["DexClassLoader", "PathClassLoader", "loadClass", "InMemoryDexClassLoader"],
    "persistence": ["BOOT_COMPLETED", "ACTION_BOOT_COMPLETED", "startService"],
    "contact_exfiltration": ["ContactsContract", "CONTENT_URI", "HttpURLConnection"],
    "c2_communication": ["HttpURLConnection", "OkHttpClient", "WebSocket", "Retrofit"],
    "anti_analysis": ["isDebuggerConnected", "Build.FINGERPRINT", "RootBeer", "su"],
}

CATEGORY_TO_RULE = {
    "sms_interception": "R01",
    "accessibility_abuse": "R02",
    "dynamic_code_loading": "R03",
    "persistence": "R04",
    "c2_communication": "R05",
    "overlay_phishing": "R07",
    "contact_exfiltration": "R10",
}


class REAnalysisOutput(BaseModel):
    title: str
    severity: Literal["info", "low", "medium", "high", "critical"]
    claim: str
    reachability: Literal["reachable", "unreachable", "unknown"]
    supports_hypothesis: bool
    rationale: str


async def investigate_hypothesis_re(
    hypothesis: HypothesisModel,
    state: NerveState,
) -> tuple[Optional[FindingModel], list[ArtifactModel], str]:
    """Investigate a single hypothesis using RE tools with fallback chains."""
    apk_path = Path(state["apk_path"])
    workspace_dir = Path(state["workspace_dir"])
    decompiled_dir = workspace_dir / "jadx_out"
    smali_dir = workspace_dir / "apktool_out"

    category = hypothesis.category
    indicators = CATEGORY_INDICATORS.get(category, [category])

    found_snippet: Optional[str] = None
    found_location = "unknown"
    fallback_used = "jadx"

    # Step 1: Primary - Try Jadx
    try:
        if not decompiled_dir.exists():
            await decompile_apk(apk_path, decompiled_dir)

        # Search for indicator in decompiled Java files
        for ind in indicators:
            for java_file in decompiled_dir.rglob("*.java"):
                res = extract_snippet(java_file, ind, max_lines=100)
                if res:
                    found_snippet, s_line, e_line = res
                    found_location = f"{java_file.name}:{s_line}-{e_line}"
                    break
            if found_snippet:
                break
    except Exception as e:
        logger.warning("Primary jadx failed (%s); falling back to apktool/smali", e)
        fallback_used = "apktool"

    # Step 2: Fallback 1 - Try Apktool / Smali if Jadx failed or found nothing
    if not found_snippet:
        fallback_used = "apktool"
        try:
            if not smali_dir.exists():
                await disassemble_apk(apk_path, smali_dir)

            for ind in indicators:
                matches = search_smali(smali_dir, ind, max_matches=1)
                if matches:
                    m = matches[0]
                    found_snippet = m["snippet"]
                    found_location = f"{m['file']}:L{m['line']}"
                    break
        except Exception as e:
            logger.warning("Apktool fallback failed (%s); checking androguard strings", e)
            fallback_used = "androguard"

    # Step 3: Fallback 2 - Check Androguard strings & components
    if not found_snippet:
        fallback_used = "androguard"
        meta = state.get("apk_meta", {})
        strings = meta.get("strings", [])
        for ind in indicators:
            matching_strings = [s for s in strings if ind.lower() in s.lower()]
            if matching_strings:
                found_snippet = "\n".join(matching_strings[:5])
                found_location = "DEX_STRING_POOL"
                break

    if not found_snippet:
        # No evidence found in code; mark hypothesis refuted or inconclusive
        return None, [], "refuted"

    # Evidence artifact
    art_id = f"A-{hashlib.sha256(found_snippet.encode()).hexdigest()[:4].upper()}"
    snippet_artifact = ArtifactModel(
        id=art_id,
        kind="decompiled_method" if fallback_used == "jadx" else "smali",
        location=found_location,
        content=found_snippet[:2000],
        content_sha256=hashlib.sha256(found_snippet.encode()).hexdigest(),
    )

    # Use LLM to formulate candidate finding
    system_prompt = (
        "You are the Reverse Engineering Agent for Nerve.\n"
        "Analyze the code excerpt located during reverse engineering for the given hypothesis.\n"
        "State whether the code supports the hypothesis, assess reachability from entry points,\n"
        "and produce a specific factual claim. Output JSON only."
    )
    user_prompt = (
        f"Hypothesis: {hypothesis.statement}\n"
        f"Category: {hypothesis.category}\n"
        f"Code Location: {found_location} (Source tool: {fallback_used})\n"
        f"Code Excerpt:\n{found_snippet}\n"
    )

    try:
        re_eval = await complete_json(
            tier="triage",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": wrap_untrusted(user_prompt, "re-snippet")},
            ],
            schema=REAnalysisOutput,
        )
        finding_id = f"F-{hypothesis.id.replace('H-', '')}"
        candidate_finding = FindingModel(
            id=finding_id,
            hypothesis_id=hypothesis.id,
            title=re_eval.title,
            severity=re_eval.severity,
            claim=re_eval.claim,
            rule_id=CATEGORY_TO_RULE.get(category),
            reachability=re_eval.reachability,
            evidence_ids=[art_id],
        )
        new_status = "confirmed" if re_eval.supports_hypothesis else "refuted"
    except Exception as e:
        logger.warning("RE LLM evaluation failed (%s); using deterministic finding", e)
        finding_id = f"F-{hypothesis.id.replace('H-', '')}"
        candidate_finding = FindingModel(
            id=finding_id,
            hypothesis_id=hypothesis.id,
            title=f"Code artifact detected for {hypothesis.category}",
            severity="medium",
            claim=f"APK contains code implementing {hypothesis.category} at {found_location}.",
            rule_id=CATEGORY_TO_RULE.get(category),
            reachability="reachable",
            evidence_ids=[art_id],
        )
        new_status = "confirmed"

    return candidate_finding, [snippet_artifact], new_status
