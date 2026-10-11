"""Safe APK/Zip extraction with zip-slip and zip-bomb protection (§10)."""

from __future__ import annotations

import os
import zipfile
from pathlib import Path


class SafeUnzipError(Exception):
    """Raised when an unzipping security violation is detected."""
    pass


# Default limits
MAX_TOTAL_UNCOMPRESSED_BYTES = 500 * 1024 * 1024  # 500 MB
MAX_FILE_COUNT = 20_000
MAX_COMPRESSION_RATIO = 100.0  # 100:1


def safe_unzip(
    zip_path: str | Path,
    dest_dir: str | Path,
    max_total_bytes: int = MAX_TOTAL_UNCOMPRESSED_BYTES,
    max_files: int = MAX_FILE_COUNT,
    max_ratio: float = MAX_COMPRESSION_RATIO,
) -> list[Path]:
    """Safely extract a ZIP / APK archive into dest_dir, validating against attacks.

    Guarantees:
    - No Zip-Slip (no path traversal, absolute paths, or symlinks)
    - No Zip-Bomb (checks file count, total size, and compression ratios)
    Returns list of extracted file paths.
    """
    dest_path = Path(dest_dir).resolve()
    dest_path.mkdir(parents=True, exist_ok=True)

    extracted_files: list[Path] = []
    total_uncompressed = 0
    file_count = 0

    with zipfile.ZipFile(zip_path, "r") as zf:
        infolist = zf.infolist()

        if len(infolist) > max_files:
            raise SafeUnzipError(
                f"Archive contains too many files ({len(infolist)} > {max_files})"
            )

        for info in infolist:
            file_count += 1
            if file_count > max_files:
                raise SafeUnzipError(f"Archive exceeded max file count limit of {max_files}")

            # Check compression ratio
            if info.compress_size > 0:
                ratio = info.file_size / float(info.compress_size)
                if ratio > max_ratio and info.file_size > 1_000_000:
                    raise SafeUnzipError(
                        f"Zip bomb detected: high compression ratio ({ratio:.1f} > {max_ratio}) in {info.filename}"
                    )

            total_uncompressed += info.file_size
            if total_uncompressed > max_total_bytes:
                raise SafeUnzipError(
                    f"Archive exceeds maximum decompressed size ({total_uncompressed} > {max_total_bytes} bytes)"
                )

            # Zip Slip checks
            name = info.filename
            if name.startswith("/") or name.startswith("\\"):
                raise SafeUnzipError(f"Zip slip detected: absolute path '{name}'")
            if ".." in Path(name).parts:
                raise SafeUnzipError(f"Zip slip detected: path traversal '..' in '{name}'")

            target_file = (dest_path / name).resolve()
            try:
                target_file.relative_to(dest_path)
            except ValueError:
                raise SafeUnzipError(
                    f"Zip slip detected: target '{target_file}' outside destination '{dest_path}'"
                )

            # Extract entry
            if info.is_dir():
                target_file.mkdir(parents=True, exist_ok=True)
            else:
                target_file.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(info, "r") as src, open(target_file, "wb") as dst:
                    while chunk := src.read(65536):
                        dst.write(chunk)
                extracted_files.append(target_file)

    return extracted_files
