"""Prompt-injection scanner for untrusted strings found in APKs (§10)."""

from __future__ import annotations

import re
from typing import NamedTuple

INJECTION_PATTERNS = [
    r"(?i)\bignore\s+(?:all\s+)?previous\s+instructions\b",
    r"(?i)\byou\s+are\s+now\s+(?:a|an)?\b",
    r"(?i)\bsystem\s+prompt\b",
    r"(?i)\breport\s+(?:this\s+app\s+as\s+)?(?:safe|benign|clean)\b",
    r"(?i)\bverdict\s*:\s*(?:safe|benign|low_risk)\b",
    r"(?i)\bdo\s+not\s+analyze\b",
    r"(?i)\boverride\s+(?:all\s+)?rules\b",
    r"(?i)\bjailbreak\b",
    r"(?i)\bdisregard\s+(?:the\s+above|everything)\b",
    r"(?i)\bnew\s+instruction\b",
]

COMPILED_PATTERNS = [re.compile(p) for p in INJECTION_PATTERNS]


class InjectionScanResult(NamedTuple):
    suspected: bool
    matched_patterns: list[str]
    sample_matches: list[str]


def scan_for_injection(text: str) -> InjectionScanResult:
    """Scan text for known prompt injection signatures."""
    matched = []
    samples = []

    for pattern in COMPILED_PATTERNS:
        match = pattern.search(text)
        if match:
            matched.append(pattern.pattern)
            samples.append(match.group(0))

    return InjectionScanResult(
        suspected=len(matched) > 0,
        matched_patterns=matched,
        sample_matches=samples,
    )
