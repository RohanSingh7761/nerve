"""Threat intelligence tool: offline blocklists, IOC extraction, and optional online lookups (§6.5)."""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any, NamedTuple, Optional

import httpx

from app.config import PROJECT_ROOT, get_settings

logger = logging.getLogger("nerve.intel")

BLOCKLISTS_DIR = PROJECT_ROOT / "rules" / "blocklists"

# Regexes for IOC extraction
URL_REGEX = re.compile(r"https?://(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?::\d+)?(?:/[^\s\"'<>]*)?")
IP_REGEX = re.compile(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b")


class ExtractedIoc(NamedTuple):
    type: str  # url, ip, domain, hash, cert
    value: str
    reputation: str  # malicious, suspicious, unknown, no_data
    source: str  # local_blocklist, heuristic, virustotal, malwarebazaar


def load_local_blocklist(filename: str) -> dict[str, str]:
    """Load a space-separated blocklist mapping: identifier -> label/family."""
    path = BLOCKLISTS_DIR / filename
    results: dict[str, str] = {}
    if not path.is_file():
        return results

    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split(maxsplit=1)
                if len(parts) == 2:
                    results[parts[0].lower()] = parts[1]
                elif len(parts) == 1:
                    results[parts[0].lower()] = "known_malicious"
    except Exception as e:
        logger.warning("Error reading blocklist %s: %s", filename, e)

    return results


def extract_iocs_from_strings(strings: list[str]) -> list[ExtractedIoc]:
    """Extract URLs and IP addresses from strings and evaluate heuristics."""
    found: list[ExtractedIoc] = []
    seen = set()

    for s in strings:
        # URLs
        for url in URL_REGEX.findall(s):
            if url in seen:
                continue
            seen.add(url)

            # Heuristics
            reputation = "no_data"
            if any(tld in url for tld in [".onion", ".top", ".xyz", ".buzz"]):
                reputation = "suspicious"
            elif any(c2 in url for c2 in ["api.telegram.org/bot", "discord.com/api/webhooks"]):
                reputation = "suspicious"

            found.append(
                ExtractedIoc(type="url", value=url, reputation=reputation, source="heuristic")
            )

        # IPs
        for ip in IP_REGEX.findall(s):
            if ip.startswith("127.") or ip.startswith("10.") or ip.startswith("192.168."):
                continue  # skip local / RFC 1918
            if ip in seen:
                continue
            seen.add(ip)

            found.append(
                ExtractedIoc(type="ip", value=ip, reputation="no_data", source="heuristic")
            )

    return found


def check_local_blocklists(sha256: str, cert_sha256: str) -> list[ExtractedIoc]:
    """Check sample hash and certificate against local curated blocklists."""
    hits: list[ExtractedIoc] = []

    # Check hash
    hash_blocklist = load_local_blocklist("hashes.txt")
    if sha256.lower() in hash_blocklist:
        family = hash_blocklist[sha256.lower()]
        hits.append(
            ExtractedIoc(
                type="hash",
                value=sha256,
                reputation="malicious",
                source=f"local_blocklist:{family}",
            )
        )

    # Check cert
    if cert_sha256:
        cert_blocklist = load_local_blocklist("certs.txt")
        if cert_sha256.lower() in cert_blocklist:
            actor = cert_blocklist[cert_sha256.lower()]
            hits.append(
                ExtractedIoc(
                    type="cert",
                    value=cert_sha256,
                    reputation="malicious",
                    source=f"local_blocklist:{actor}",
                )
            )

    return hits


async def query_virustotal_hash(sha256: str, api_key: str) -> Optional[dict[str, Any]]:
    """Optional online lookup via VirusTotal v3 public API."""
    if not api_key:
        return None

    url = f"https://www.virustotal.com/api/v3/files/{sha256}"
    headers = {"x-apikey": api_key}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json().get("data", {}).get("attributes", {})
                stats = data.get("last_analysis_stats", {})
                malicious = stats.get("malicious", 0)
                return {
                    "malicious": malicious,
                    "suspicious": stats.get("suspicious", 0),
                    "total": sum(stats.values()),
                }
            elif resp.status_code == 404:
                return {"malicious": 0, "total": 0, "status": "not_found"}
    except Exception as exc:
        logger.warning("VirusTotal lookup failed: %s", exc)

    return None
