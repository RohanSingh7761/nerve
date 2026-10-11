"""APKiD integration and packer/obfuscation detector (§6.1, §8.2 R08)."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional
import uuid

from app.config import get_settings
from app.tools.runner import runner

logger = logging.getLogger("nerve.apkid")

# Common packer and protector signatures for fallback inspection
KNOWN_PACKER_FILES = {
    "libsecexe.so": "Bangcle",
    "libsecmain.so": "Bangcle",
    "libSecShell.so": "SecNeo",
    "libDexHelper.so": "SecNeo",
    "libprotectClass.so": "360 Qihoo",
    "libjiagu.so": "360 Qihoo",
    "libtup.so": "Tencent Legu",
    "libshell.so": "Tencent Legu",
    "libbaiduprotect.so": "Baidu",
    "libnqshield.so": "NQ Shield",
    "libapssec.so": "Alibaba",
    "assets/dexguard/": "DexGuard",
}


class ApkidResult:
    def __init__(
        self,
        is_packed: bool,
        packer: Optional[str] = None,
        obfuscators: Optional[list[str]] = None,
        compiler: Optional[str] = None,
    ):
        self.is_packed = is_packed
        self.packer = packer
        self.obfuscators = obfuscators or []
        self.compiler = compiler


async def scan_apk_protection(
    apk_path: str | Path,
    agent_run_id: Optional[uuid.UUID] = None,
) -> ApkidResult:
    """Run APKiD or perform native structural inspection to detect packers and obfuscation."""
    settings = get_settings()
    apk_path = Path(apk_path).resolve()

    # Try running the APKiD CLI if configured / available
    try:
        res = await runner.run(
            binary=settings.apkid_bin,
            args=["--json", str(apk_path)],
            timeout_s=30,
            agent_run_id=agent_run_id,
        )
        if res.succeeded and res.stdout:
            data = json.loads(res.stdout)
            files = data.get("files", {})
            for f_info in files.values():
                results = f_info.get("results", {})
                packer_list = results.get("packer", [])
                anti_analysis = results.get("anti_analysis", [])
                obfuscator_list = results.get("obfuscator", [])
                compiler_list = results.get("compiler", [])

                if packer_list:
                    return ApkidResult(
                        is_packed=True,
                        packer=", ".join(packer_list),
                        obfuscators=obfuscator_list + anti_analysis,
                        compiler=compiler_list[0] if compiler_list else None,
                    )
    except Exception as e:
        logger.debug("APKiD CLI not available or failed: %s; using native heuristics", e)

    # Native heuristic check on ZIP table entries
    import zipfile

    try:
        with zipfile.ZipFile(apk_path, "r") as zf:
            namelist = zf.namelist()

        detected_packers = []
        for name in namelist:
            for sig, packer_name in KNOWN_PACKER_FILES.items():
                if sig in name and packer_name not in detected_packers:
                    detected_packers.append(packer_name)

        if detected_packers:
            return ApkidResult(
                is_packed=True,
                packer=", ".join(detected_packers),
                obfuscators=[],
                compiler=None,
            )
    except Exception as e:
        logger.warning("Error inspecting APK for packer signatures: %s", e)

    return ApkidResult(is_packed=False, packer=None, obfuscators=[])
