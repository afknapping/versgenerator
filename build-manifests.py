#!/usr/bin/env python3
"""Regenerates data/mountain/manifest.json and data/water/manifest.json -
run this after adding or removing photos in either folder.

No build step for the app itself; this is just a small helper so the
static site knows what image files exist (a static site can't list a
directory on its own).
"""
import json
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
FOLDERS = ["mountain", "water"]

for name in FOLDERS:
    folder = DATA_DIR / name
    folder.mkdir(parents=True, exist_ok=True)
    files = sorted(
        p.name for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS
    )
    manifest_path = folder / "manifest.json"
    manifest_path.write_text(json.dumps(files, indent=2) + "\n")
    print(f"{name}: {len(files)} photo(s) -> {manifest_path}")
