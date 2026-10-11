"""Intake node: deterministic hash computation, safe unzip, manifest extraction, APKiD (§6.1)."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.graph.state import ArtifactModel, NerveState
from app.security.injection_scanner import scan_for_injection
from app.tools.androguard_tools import analyze_apk_static
from app.tools.apkid import scan_apk_protection
from app.tools.safe_unzip import safe_unzip

logger = logging.getLogger("nerve.nodes.intake")


async def intake_node(state: NerveState) -> dict[str, Any]:
    """Deterministic intake analysis. No LLM calls here."""
    apk_path = Path(state["apk_path"]).resolve()
    workspace_dir = Path(state["workspace_dir"]).resolve()
    unzip_dir = workspace_dir / "unpacked"
    unzip_dir.mkdir(parents=True, exist_ok=True)

    # 1. Compute file hashes
    with open(apk_path, "rb") as f:
        data = f.read()
    sha256 = hashlib.sha256(data).hexdigest()
    md5 = hashlib.md5(data).hexdigest()
    sha1 = hashlib.sha1(data).hexdigest()

    # 2. Safe extraction
    try:
        safe_unzip(apk_path, unzip_dir)
    except Exception as e:
        logger.warning("Safe unzip warning: %s", e)

    # 3. Static metadata via Androguard
    andro_res = analyze_apk_static(apk_path)

    # 4. APKiD packer detection
    apkid_res = await scan_apk_protection(apk_path)

    apk_meta = {
        "package_name": andro_res.package_name,
        "version_name": andro_res.version_name,
        "version_code": andro_res.version_code,
        "min_sdk": andro_res.min_sdk,
        "target_sdk": andro_res.target_sdk,
        "signing_cert_sha256": andro_res.cert_sha256,
        "is_packed": apkid_res.is_packed,
        "packer": apkid_res.packer,
        "obfuscators": apkid_res.obfuscators,
        "permissions": andro_res.permissions,
        "components": {
            "activities": andro_res.activities,
            "services": andro_res.services,
            "receivers": andro_res.receivers,
            "providers": andro_res.providers,
        },
        "strings": andro_res.strings,
    }

    # 5. Injection scanner on manifest strings
    manifest_summary = (
        f"Package: {andro_res.package_name}\n"
        f"Permissions: {', '.join(andro_res.permissions)}\n"
        f"Activities: {', '.join(andro_res.activities[:10])}\n"
        f"Services: {', '.join(andro_res.services[:10])}\n"
        f"Receivers: {', '.join(andro_res.receivers[:10])}\n"
    )
    inj_result = scan_for_injection(manifest_summary)
    flags = ["injection_suspected"] if inj_result.suspected else []

    # 6. Create initial artifacts
    artifacts = [
        ArtifactModel(
            id="A-0001",
            kind="manifest",
            location="AndroidManifest.xml",
            content=manifest_summary[:3000],
            content_sha256=hashlib.sha256(manifest_summary.encode()).hexdigest(),
            flags=flags,
        ),
        ArtifactModel(
            id="A-0002",
            kind="permission",
            location="AndroidManifest.xml#permissions",
            content="\n".join(andro_res.permissions),
            content_sha256=hashlib.sha256("\n".join(andro_res.permissions).encode()).hexdigest(),
        ),
    ]

    return {
        "sha256": sha256,
        "apk_meta": apk_meta,
        "artifacts": artifacts,
    }
