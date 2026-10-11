"""Nerve Doctor: diagnostic checker for runtime dependencies and toolchain (§0, §13)."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from app.config import get_settings


def check_tool(name: str, cmd: list[str]) -> tuple[bool, str]:
    """Check if a tool is runnable and returns version output."""
    exe = shutil.which(cmd[0])
    if not exe:
        return False, "Not found on PATH"
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        output = (res.stdout or res.stderr).strip().splitlines()
        first_line = output[0] if output else "OK"
        return True, first_line[:60]
    except Exception as e:
        return False, f"Failed to execute: {e}"


def run_doctor() -> bool:
    settings = get_settings()
    all_ok = True
    print("\n══════════════════════════════════════════════════════════════")
    print("               Nerve Environment Diagnostics                   ")
    print("══════════════════════════════════════════════════════════════\n")

    # 1. Python version
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    py_ok = sys.version_info >= (3, 11)
    status_icon = "✓" if py_ok else "✗"
    print(f"[{status_icon}] Python 3.11+: {py_ver}")
    if not py_ok:
        all_ok = False

    # 2. Java runtime
    java_ok, java_msg = check_tool("Java", ["java", "-version"])
    status_icon = "✓" if java_ok else "✗"
    print(f"[{status_icon}] Java (JRE 17+): {java_msg}")
    if not java_ok:
        print("    → Required for jadx and apktool decompilation.")

    # 3. Jadx decompiler
    jadx_ok, jadx_msg = check_tool("jadx", [settings.jadx_bin, "--version"])
    status_icon = "✓" if jadx_ok else "!"
    print(f"[{status_icon}] Jadx decompiler: {jadx_msg}")
    if not jadx_ok:
        print(f"    → Primary decompiler not found. Nerve will fall back to apktool/androguard.")

    # 4. Apktool
    apktool_ok, apktool_msg = check_tool("apktool", [settings.apktool_bin, "--version"])
    status_icon = "✓" if apktool_ok else "!"
    print(f"[{status_icon}] Apktool disassembler: {apktool_msg}")
    if not apktool_ok:
        print(f"    → Smali fallback disassembler not found.")

    # 5. APKiD
    apkid_ok, apkid_msg = check_tool("apkid", [settings.apkid_bin, "--version"])
    status_icon = "✓" if apkid_ok else "!"
    print(f"[{status_icon}] APKiD packer detector: {apkid_msg}")
    if not apkid_ok:
        print(f"    → APKiD CLI not found. Nerve will use native heuristic signature scanning.")

    # 6. LLM Provider credentials
    provider = settings.llm_provider
    print(f"\n[ℹ] Active LLM Provider: {provider}")
    from app.llm.client import REGISTRY
    cfg = REGISTRY.get(provider, {})
    key_env = cfg.get("key_env")
    if key_env:
        has_key = bool(os.getenv(key_env) or getattr(settings, key_env.lower(), ""))
        status_icon = "✓" if has_key else "✗"
        print(f"[{status_icon}] LLM API Key ({key_env}): {'CONFIGURED' if has_key else 'MISSING'}")
        if not has_key:
            all_ok = False
            print(f"    → Set {key_env} in your .env file to enable {provider}.")

    # 7. Database URL
    print(f"\n[ℹ] Database URL: {settings.database_url.split('@')[-1] if '@' in settings.database_url else settings.database_url}")

    print("\n══════════════════════════════════════════════════════════════\n")
    return all_ok


if __name__ == "__main__":
    success = run_doctor()
    sys.exit(0 if success else 1)
