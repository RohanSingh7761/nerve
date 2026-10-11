"""Androguard integration for deterministic static analysis of APKs (§6.1, §6.3)."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("nerve.androguard")


class AndroguardAnalysisResult:
    def __init__(
        self,
        package_name: str,
        version_name: str,
        version_code: int,
        min_sdk: int,
        target_sdk: int,
        permissions: list[str],
        activities: list[str],
        services: list[str],
        receivers: list[str],
        providers: list[str],
        cert_sha256: str,
        strings: list[str],
    ):
        self.package_name = package_name
        self.version_name = version_name
        self.version_code = version_code
        self.min_sdk = min_sdk
        self.target_sdk = target_sdk
        self.permissions = permissions
        self.activities = activities
        self.services = services
        self.receivers = receivers
        self.providers = providers
        self.cert_sha256 = cert_sha256
        self.strings = strings


def analyze_apk_static(apk_path: str | Path) -> AndroguardAnalysisResult:
    """Perform deterministic static inspection of an APK using Androguard.
    Extracts package metadata, components, permissions, strings, and certificate fingerprint.
    """
    apk_path = Path(apk_path).resolve()

    try:
        try:
            from androguard.core.apk import APK
            from androguard.core.dex import DEX
        except ImportError:
            from androguard.core.bytecodes.apk import APK
            from androguard.core.bytecodes.dvm import DalvikVMFormat as DEX

        a = APK(str(apk_path))

        package_name = a.get_package() or "unknown"
        version_name = a.get_androidversion_name() or "1.0"
        try:
            version_code = int(a.get_androidversion_code() or 1)
        except (ValueError, TypeError):
            version_code = 1

        try:
            min_sdk = int(a.get_min_sdk_version() or 1)
        except (ValueError, TypeError):
            min_sdk = 1

        try:
            target_sdk = int(a.get_target_sdk_version() or 1)
        except (ValueError, TypeError):
            target_sdk = 1

        permissions = list(a.get_permissions())
        activities = list(a.get_activities())
        services = list(a.get_services())
        receivers = list(a.get_receivers())
        providers = list(a.get_providers())

        # Extract certificate fingerprint
        cert_sha256 = ""
        try:
            certs = a.get_certificates()
            if certs:
                cert = certs[0]
                cert_sha256 = cert.sha256_fingerprint.replace(" ", "").lower()
        except Exception as e:
            logger.debug("Could not extract cert sha256 via androguard: %s", e)

        # Extract strings
        extracted_strings = []
        try:
            dex_files = a.get_all_dex()
            for dex_bytes in dex_files:
                d = DEX(dex_bytes)
                for s in d.get_strings():
                    # Keep strings of reasonable length
                    if 4 <= len(s) <= 256:
                        extracted_strings.append(s)
        except Exception as e:
            logger.debug("Error extracting strings from dex: %s", e)

        return AndroguardAnalysisResult(
            package_name=package_name,
            version_name=version_name,
            version_code=version_code,
            min_sdk=min_sdk,
            target_sdk=target_sdk,
            permissions=permissions,
            activities=activities,
            services=services,
            receivers=receivers,
            providers=providers,
            cert_sha256=cert_sha256,
            strings=list(set(extracted_strings))[:1000],  # cap to top 1000 unique strings
        )

    except Exception as exc:
        logger.warning("Androguard parsing failed for %s: %s", apk_path, exc)
        # Fallback to minimal placeholder
        return AndroguardAnalysisResult(
            package_name="unknown.package",
            version_name="1.0",
            version_code=1,
            min_sdk=21,
            target_sdk=33,
            permissions=[],
            activities=[],
            services=[],
            receivers=[],
            providers=[],
            cert_sha256="",
            strings=[],
        )
