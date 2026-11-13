#!/usr/bin/env python3
"""Package the offline recovery website with public media only."""
from __future__ import annotations

import argparse
import json
import pathlib
import zipfile

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("backup_root", type=pathlib.Path)
    parser.add_argument("output_zip", type=pathlib.Path)
    args = parser.parse_args()
    root = args.backup_root.resolve()
    site = root / "recovery-site"
    buckets_path = root / "storage" / "buckets.json"
    manifest_path = root / "storage" / "objects" / "storage-manifest.json"
    if not (site / "index.html").is_file() or not buckets_path.is_file() or not manifest_path.is_file():
        raise SystemExit("Recovery website or Storage inventory is missing.")
    buckets = json.loads(buckets_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    public_ids = {item["id"] for item in buckets if item.get("public") is True}
    content = json.loads((root / "database" / "public-content.json").read_text(encoding="utf-8"))
    if not isinstance(content, dict):
        raise SystemExit("Public content snapshot is invalid.")
    published_refs = {
        ("vha-post-media", row.get("media_path"))
        for row in content.get("posts", []) if row.get("media_path")
    }
    published_refs.update({
        ("poetry-media", row.get("storage_path"))
        for row in content.get("submissions", []) if row.get("storage_path")
    })
    expected = {
        (item["bucket"], item["path"]): item for item in manifest.get("objects", [])
        if item.get("bucket") in public_ids and (item.get("bucket"), item.get("path")) in published_refs
    }
    if len(expected) != sum(1 for item in manifest.get("objects", []) if item.get("bucket") in public_ids and (item.get("bucket"), item.get("path")) in published_refs):
        raise SystemExit("Storage manifest contains duplicate published media references.")
    files = []
    for (bucket, name), record in sorted(expected.items()):
        path = root / "storage" / "objects" / bucket / pathlib.PurePosixPath(name)
        if not path.is_file() or path.stat().st_size != int(record["bytes"]):
            raise SystemExit("A public media object is missing or has an unexpected size.")
        files.append(path)
    site_files = [path for path in site.rglob("*") if path.is_file()]
    if not site_files:
        raise SystemExit("Recovery website is empty.")
    args.output_zip.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(site_files):
            archive.write(path, path.relative_to(root).as_posix())
        for path in files:
            archive.write(path, path.relative_to(root).as_posix())
    with zipfile.ZipFile(args.output_zip) as archive:
        names = set(archive.namelist())
        if "recovery-site/index.html" not in names:
            raise SystemExit("Recovery website entry point is missing from the package.")
        for bucket, name in expected:
            expected_path = (pathlib.PurePosixPath("storage") / "objects" / bucket / pathlib.PurePosixPath(name)).as_posix()
            if expected_path not in names:
                raise SystemExit("Recovery package is missing a public media object.")
        if any(path.startswith("storage/objects/") and path.split("/")[2] not in public_ids for path in names):
            raise SystemExit("Recovery package unexpectedly contains private Storage objects.")
    print(f"Packaged offline recovery website: {len(site_files)} site files and {len(files)} public media objects.")
    print(f"Output: {args.output_zip}")

if __name__ == "__main__":
    main()
