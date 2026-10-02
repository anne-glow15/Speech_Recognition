#!/usr/bin/env python3
"""
Download and extract a Vosk model for VoxNova.

Usage:
    python download_model.py                         # downloads the default small English model
    python download_model.py --model en-us-0.22      # downloads the large English model
    python download_model.py --list                  # shows available model shortcuts

The model is extracted into the server/ directory and a symlink/copy named
"model" is created so vosk_server.py finds it automatically.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

# Curated model list — add more from https://alphacephei.com/vosk/models
MODELS = {
    "en-us-lgraph": ("vosk-model-en-us-0.22-lgraph", "https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip"),
    "en-us-0.15":   ("vosk-model-small-en-us-0.15",   "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"),
    "en-us-0.22":   ("vosk-model-en-us-0.22",         "https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip"),
    "en-in-0.5":    ("vosk-model-small-en-in-0.4",    "https://alphacephei.com/vosk/models/vosk-model-small-en-in-0.4.zip"),
    "hi-0.22":      ("vosk-model-small-hi-0.22",       "https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip"),
    "fr-0.22":      ("vosk-model-small-fr-0.22",       "https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip"),
    "de-0.21":      ("vosk-model-small-de-0.15",       "https://alphacephei.com/vosk/models/vosk-model-small-de-0.15.zip"),
    "es-0.42":      ("vosk-model-small-es-0.42",       "https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip"),
}

DEFAULT_MODEL = "en-us-lgraph"


def progress_hook(block_num: int, block_size: int, total_size: int):
    downloaded = block_num * block_size
    if total_size > 0:
        pct = min(100, downloaded * 100 // total_size)
        mb = downloaded / (1024 * 1024)
        total_mb = total_size / (1024 * 1024)
        bar_len = 40
        filled = int(bar_len * pct // 100)
        bar = "#" * filled + "-" * (bar_len - filled)
        print(f"\r  [{bar}] {pct:3d}%  ({mb:.1f} / {total_mb:.1f} MB)", end="", flush=True)
    else:
        mb = downloaded / (1024 * 1024)
        print(f"\r  Downloaded {mb:.1f} MB ...", end="", flush=True)


def download_and_extract(model_key: str, dest_dir: Path):
    if model_key not in MODELS:
        print(f"Unknown model key: '{model_key}'")
        print(f"Available: {', '.join(MODELS.keys())}")
        sys.exit(1)

    folder_name, url = MODELS[model_key]
    model_dir = dest_dir / folder_name

    if model_dir.exists():
        print(f"[OK] Model already exists at {model_dir}")
    else:
        zip_path = dest_dir / f"{folder_name}.zip"
        print(f"Downloading {folder_name} ...")
        print(f"  URL: {url}")
        try:
            urllib.request.urlretrieve(url, str(zip_path), reporthook=progress_hook)
        except Exception as e:
            print(f"\n\n[ERROR] Download failed: {e}")
            print("You can manually download from https://alphacephei.com/vosk/models")
            sys.exit(1)
        print()  # newline after progress bar

        print(f"Extracting to {dest_dir} ...")
        with zipfile.ZipFile(str(zip_path), "r") as zf:
            zf.extractall(str(dest_dir))
        zip_path.unlink()
        print(f"[OK] Extracted {folder_name}")

    # Create a "model" symlink / copy so vosk_server.py auto-detects it
    model_link = dest_dir / "model"
    if model_link.exists() or model_link.is_symlink() or os.path.islink(str(model_link)):
        try:
            if model_link.is_symlink() or os.path.islink(str(model_link)):
                os.unlink(str(model_link))
            elif model_link.is_dir():
                os.rmdir(str(model_link))
            else:
                model_link.unlink()
        except OSError:
            shutil.rmtree(str(model_link), ignore_errors=True)

    try:
        # Try symlink first (requires dev mode or admin on Windows)
        model_link.symlink_to(model_dir.resolve(), target_is_directory=True)
        print(f"[OK] Created symlink: model -> {folder_name}")
    except OSError:
        # Fall back to a junction on Windows
        if sys.platform == "win32":
            import subprocess
            subprocess.run(
                ["cmd", "/c", "mklink", "/J", str(model_link), str(model_dir.resolve())],
                check=True, capture_output=True,
            )
            print(f"[OK] Created junction: model -> {folder_name}")
        else:
            raise

    print(f"\nDone! Start the server with:\n  cd server && python vosk_server.py\n")


def main():
    parser = argparse.ArgumentParser(description="Download a Vosk model for VoxNova")
    parser.add_argument(
        "--model", "-m",
        default=DEFAULT_MODEL,
        help=f"Model shortcut (default: {DEFAULT_MODEL}). Use --list to see options.",
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="List available model shortcuts and exit.",
    )
    args = parser.parse_args()

    if args.list:
        print("Available models:\n")
        for key, (name, url) in MODELS.items():
            default = " (default)" if key == DEFAULT_MODEL else ""
            print(f"  {key:16s}  {name}{default}")
        print(f"\nUsage:  python download_model.py --model {DEFAULT_MODEL}")
        return

    here = Path(__file__).parent
    download_and_extract(args.model, here)


if __name__ == "__main__":
    main()
