#!/usr/bin/env python3
"""Create a deterministic SHA-256 manifest for the backup payload."""
import hashlib
import json
import pathlib
import sys
from datetime import datetime, timezone

root = pathlib.Path(sys.argv[1])
entries = []
for path in sorted(root.rglob("*")):
    if path.is_file() and path != root / "backup-manifest.json":
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        entries.append({
            "path": path.relative_to(root).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": digest.hexdigest(),
        })
manifest = {
    "format": "green-dream-backup-v1",
    "created_at": datetime.now(timezone.utc).isoformat(),
    "file_count": len(entries),
    "total_bytes": sum(item["bytes"] for item in entries),
    "files": entries,
}
(root / "backup-manifest.json").write_text(
    json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
)
print(f"Manifest created: {manifest['file_count']} files, {manifest['total_bytes']} bytes")
