#!/usr/bin/env python3
"""Test the offline recovery-site builder, including privacy and media boundaries."""
import json
import pathlib
import subprocess
import sys
import tempfile
import zipfile

repo = pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as temp:
    root = pathlib.Path(temp)
    for folder in ("database", "storage/objects/public-media", "storage/objects/private-media"):
        (root / folder).mkdir(parents=True, exist_ok=True)
    payload = {
        "posts": [{
            "title": "Recovered poem",
            "slug": "recovered-poem",
            "category": "THE RETURN",
            "excerpt": "A test excerpt",
            "content_html": "<p>Hello <strong>archive</strong></p><script>alert(1)</script>",
            "published_at": "2026-11-12T12:00:00Z",
            "media_path": "images/cover.jpg",
            "media_type": "image",
        }],
        "submissions": [{
            "title": "Approved signal",
            "slug": "approved-signal",
            "medium": "music",
            "body": "A public recording",
            "byline": "Contributor",
            "published_at": "2026-11-11T12:00:00Z",
            "storage_path": "audio/song.mp3",
        }],
    }
    (root / "database/public-content.json").write_text(json.dumps(payload), encoding="utf-8")
    (root / "storage/buckets.json").write_text(json.dumps([
        {"id": "public-media", "public": True},
        {"id": "private-media", "public": False},
    ]), encoding="utf-8")
    (root / "storage/objects/storage-manifest.json").write_text(json.dumps({
        "objects": [
            {"bucket": "public-media", "path": "images/cover.jpg", "bytes": 4, "sha256": "x"},
            {"bucket": "public-media", "path": "audio/song.mp3", "bytes": 4, "sha256": "y"},
            {"bucket": "private-media", "path": "secret/private.pdf", "bytes": 6, "sha256": "z"},
        ]
    }), encoding="utf-8")
    (root / "storage/objects/public-media/images").mkdir(parents=True)
    (root / "storage/objects/public-media/audio").mkdir(parents=True)
    (root / "storage/objects/private-media/secret").mkdir(parents=True)
    (root / "storage/objects/public-media/images/cover.jpg").write_bytes(b"jpeg")
    (root / "storage/objects/public-media/audio/song.mp3").write_bytes(b"mp3!")
    (root / "storage/objects/private-media/secret/private.pdf").write_bytes(b"secret")
    subprocess.run([sys.executable, str(repo / "scripts/build_recovery_site.py"), str(root)], check=True)
    page = (root / "recovery-site/index.html").read_text(encoding="utf-8")
    assert "Recovered poem" in page
    assert "Approved signal" in page
    assert "private.pdf" not in page
    assert "alert(1)" in page  # Kept only as inert JSON data; the viewer sanitizer strips script elements.
    assert "../storage/objects/public-media/images/cover.jpg" in page
    assert "../storage/objects/public-media/audio/song.mp3" in page
    assert (root / "recovery-site/README.txt").is_file()
    package = root / "recovery-site.zip"
    subprocess.run([sys.executable, str(repo / "scripts/package_recovery_site.py"), str(root), str(package)], check=True)
    with zipfile.ZipFile(package) as archive:
        names = set(archive.namelist())
        assert "recovery-site/index.html" in names
        assert "storage/objects/public-media/images/cover.jpg" in names
        assert "storage/objects/public-media/audio/song.mp3" in names
        assert not any("private-media" in name for name in names)
print("Offline recovery-site builder and package tests passed.")
