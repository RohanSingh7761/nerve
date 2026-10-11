"""Untrusted artifact data wrapper for prompt injection defense (§10)."""

from __future__ import annotations


def wrap_untrusted(content: str, artifact_id: str, kind: str = "data") -> str:
    """Wrap untrusted text derived from the APK so LLM prompts clearly isolate data from instructions."""
    # Escape any existing closing tags inside the content to prevent tag breakout
    sanitized = content.replace("</untrusted_artifact>", "</_untrusted_artifact>")
    return (
        f'<untrusted_artifact id="{artifact_id}" kind="{kind}">\n'
        f"{sanitized}\n"
        f"</untrusted_artifact>"
    )
