"""YARA rules scanner for offline Android threat detection (§6.5, §9.1)."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, NamedTuple

from app.config import PROJECT_ROOT

logger = logging.getLogger("nerve.yara")

YARA_RULES_DIR = PROJECT_ROOT / "rules" / "yara"


class YaraMatch(NamedTuple):
    rule: str
    meta: dict[str, Any]
    strings: list[tuple[int, str, bytes]]


def scan_yara(target_path: str | Path) -> list[YaraMatch]:
    """Scan file with all valid YARA rules in rules/yara/ directory."""
    matches: list[YaraMatch] = []
    target_path = Path(target_path).resolve()

    if not target_path.exists():
        return matches

    try:
        import yara

        if not YARA_RULES_DIR.is_dir():
            return matches

        rule_files = list(YARA_RULES_DIR.glob("*.yar")) + list(YARA_RULES_DIR.glob("*.yara"))
        if not rule_files:
            return matches

        # Compile each rule file separately so one broken rule does not abort the scan (§9.1)
        for rf in rule_files:
            try:
                compiled = yara.compile(filepath=str(rf))
                raw_matches = compiled.match(str(target_path))
                for m in raw_matches:
                    matches.append(
                        YaraMatch(
                            rule=m.rule,
                            meta=dict(m.meta),
                            strings=m.strings,
                        )
                    )
            except Exception as e:
                logger.warning("Skipping invalid YARA rule file %s: %s", rf.name, e)

    except ImportError:
        logger.debug("yara-python not installed; skipping YARA scans")
    except Exception as exc:
        logger.warning("Error running YARA scan: %s", exc)

    return matches
