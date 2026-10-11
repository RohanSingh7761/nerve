"""Nerve tools module: runners, decompiler wrappers, and intelligence utilities."""

from app.tools.androguard_tools import AndroguardAnalysisResult, analyze_apk_static
from app.tools.apkid import ApkidResult, scan_apk_protection
from app.tools.apktool import disassemble_apk, search_smali
from app.tools.intel import check_local_blocklists, extract_iocs_from_strings, query_virustotal_hash
from app.tools.jadx import decompile_apk, decompile_class, extract_snippet
from app.tools.runner import LocalSubprocessRunner, ToolExecutionResult, runner
from app.tools.safe_unzip import SafeUnzipError, safe_unzip
from app.tools.yara_scan import YaraMatch, scan_yara

__all__ = [
    "runner",
    "LocalSubprocessRunner",
    "ToolExecutionResult",
    "safe_unzip",
    "SafeUnzipError",
    "analyze_apk_static",
    "AndroguardAnalysisResult",
    "decompile_apk",
    "decompile_class",
    "extract_snippet",
    "disassemble_apk",
    "search_smali",
    "scan_apk_protection",
    "ApkidResult",
    "scan_yara",
    "YaraMatch",
    "extract_iocs_from_strings",
    "check_local_blocklists",
    "query_virustotal_hash",
]
