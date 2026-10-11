"""Nerve Doctor: diagnostic checker for runtime dependencies and toolchain (§0, §13)."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

# Add backend directory to path when run directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

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
    print("\n==============================================================")
    print("               Nerve Environment Diagnostics                   ")
    print("==============================================================\n")

    # 1. Python version
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    py_ok = sys.version_info >= (3, 11)
    status_icon = "[OK]" if py_ok else "[FAIL]"
    print(f"{status_icon} Python 3.11+: {py_ver}")
    if not py_ok:
        all_ok = False

    # 2. Java runtime
    java_ok, java_msg = check_tool("Java", ["java", "-version"])
    status_icon = "[OK]" if java_ok else "[FAIL]"
    print(f"{status_icon} Java (JRE 17+): {java_msg}")
    if not java_ok:
        print("     -> Required for jadx and apktool decompilation.")

    # 3. Jadx decompiler
    jadx_ok, jadx_msg = check_tool("jadx", [settings.jadx_bin, "--version"])
    status_icon = "[OK]" if jadx_ok else "[WARN]"
    print(f"{status_icon} Jadx decompiler: {jadx_msg}")
    if not jadx_ok:
        print(f"     -> Primary decompiler not found. Nerve will fall back to apktool/androguard.")

    # 4. Apktool
    apktool_ok, apktool_msg = check_tool("apktool", [settings.apktool_bin, "--version"])
    status_icon = "[OK]" if apktool_ok else "[WARN]"
    print(f"{status_icon} Apktool disassembler: {apktool_msg}")
    if not apktool_ok:
        print(f"     -> Smali fallback disassembler not found.")

    # 5. APKiD
    apkid_ok, apkid_msg = check_tool("apkid", [settings.apkid_bin, "--version"])
    status_icon = "[OK]" if apkid_ok else "[WARN]"
    print(f"{status_icon} APKiD packer detector: {apkid_msg}")
    if not apkid_ok:
        print(f"     -> APKiD CLI not found. Nerve will use native heuristic signature scanning.")

    # 6. LLM Provider credentials
    provider = settings.llm_provider
    print(f"\n[INFO] Active LLM Provider: {provider}")
    key_map = {
        "gemini": "GEMINI_API_KEY",
        "groq": "GROQ_API_KEY",
        "openrouter": "OPENROUTER_API_KEY",
        "mistral": "MISTRAL_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "openai": "OPENAI_API_KEY",
        "custom": "CUSTOM_OPENAI_API_KEY",
        "ollama": "OLLAMA_API_BASE",
    }
    try:
        import yaml
        providers_yaml = Path(__file__).resolve().parent / "llm" / "providers.yaml"
        with open(providers_yaml, "r", encoding="utf-8") as f:
            registry = yaml.safe_load(f).get("providers", {})
        key_env = registry.get(provider, {}).get("key_env") or key_map.get(provider)
    except Exception:
        key_env = key_map.get(provider)
    if key_env:
        has_key = bool(os.getenv(key_env) or getattr(settings, key_env.lower(), ""))
        status_icon = "[OK]" if has_key else "[FAIL]"
        print(f"{status_icon} LLM API Key ({key_env}): {'CONFIGURED' if has_key else 'MISSING'}")
        if not has_key:
            all_ok = False
            print(f"     -> Set {key_env} in your .env file to enable {provider}.")

    # 7. Database URL
    db_display = settings.database_url.split('@')[-1] if '@' in settings.database_url else settings.database_url
    print(f"\n[INFO] Database Target: {db_display}")

    print("\n==============================================================\n")
    return all_ok


if __name__ == "__main__":
    success = run_doctor()
    sys.exit(0 if success else 1)
