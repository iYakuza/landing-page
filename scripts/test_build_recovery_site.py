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
    for folder in ("database", "storage/objects/vha-post-media", "storage/objects/poetry-media", "storage/objects/poetry-media-staging"):
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
            "media_type": "image", "contact_email": "private@example.invalid", "ip_hash": "private-ip-hash",
        }, {
            "title": "WFH", "slug": "wfh", "category": "THE RECONNECTION",
            "content_html": "<p>Local image test</p>", "published_at": "2026-10-15T12:00:00Z",
            "media_url": "/landing-page/posts/imported/wfh/media/featured.jpg",
            "media_path": None, "media_type": "image",
        }, {
            "title": "External video", "slug": "external-video", "category": "THE RETURN",
            "content_html": "<p>External video reference</p>", "published_at": "2026-10-14T12:00:00Z",
            "media_url": "https://video.example.invalid/watch/123", "media_path": None, "media_type": "video",
        }, {
            "title": "Unsafe media", "slug": "unsafe-media", "category": "THE RETURN",
            "content_html": "<p>Unsafe media reference</p>", "published_at": "2026-10-13T12:00:00Z",
            "media_url": "javascript:alert(1)", "media_path": None, "media_type": "video",
        }],
        "submissions": [{
            "title": "Approved signal",
            "slug": "approved-signal",
            "medium": "music",
            "body": "A public recording",
            "byline": "Contributor",
            "published_at": "2026-11-11T12:00:00Z",
            "storage_path": "audio/song.mp3", "contact_email": "private@example.invalid", "moderation_note": "private moderation note",
        }, {
            "title": "External song", "slug": "external-song", "medium": "music",
            "body": "A linked recording", "byline": "Contributor", "published_at": "2026-11-09T12:00:00Z",
            "media_url": "https://audio.example.invalid/track.mp3", "storage_path": None,
        }],
        "transmissions": [{
            "title": "A shared thought", "message": "A consent-approved message",
            "display_name": "A contributor", "created_at": "2026-11-10T12:00:00Z",
            "contact_email": "private@example.invalid", "moderation_note": "private moderation note",
        }],
    }
    (root / "database/public-content.json").write_text(json.dumps(payload), encoding="utf-8")
    (root / "storage/buckets.json").write_text(json.dumps([
        {"id": "vha-post-media", "public": True},
        {"id": "poetry-media", "public": True},
        {"id": "poetry-media-staging", "public": False},
    ]), encoding="utf-8")
    (root / "storage/objects/storage-manifest.json").write_text(json.dumps({
        "objects": [
            {"bucket": "vha-post-media", "path": "images/cover.jpg", "bytes": 4, "sha256": "x"},
            {"bucket": "poetry-media", "path": "audio/song.mp3", "bytes": 4, "sha256": "y"},
            {"bucket": "poetry-media", "path": "unpublished/hidden.png", "bytes": 6, "sha256": "h"},
            {"bucket": "poetry-media-staging", "path": "secret/private.pdf", "bytes": 6, "sha256": "z"},
        ]
    }), encoding="utf-8")
    (root / "storage/objects/vha-post-media/images").mkdir(parents=True)
    (root / "storage/objects/poetry-media/audio").mkdir(parents=True)
    (root / "storage/objects/poetry-media/unpublished").mkdir(parents=True)
    (root / "storage/objects/poetry-media-staging/secret").mkdir(parents=True)
    (root / "storage/objects/vha-post-media/images/cover.jpg").write_bytes(b"jpeg")
    source = root / "source"
    local_asset = source / "posts/imported/wfh/media/featured.jpg"
    local_asset.parent.mkdir(parents=True)
    local_asset.write_bytes(b"repo image")
    (root / "storage/objects/poetry-media/audio/song.mp3").write_bytes(b"mp3!")
    wordpress = root / "wordpress"
    (wordpress / "media").mkdir(parents=True, exist_ok=True)
    (wordpress / "posts.json").write_text(json.dumps([
        {"id": 3014, "date": "2026-11-07T00:41:57", "link": "https://emanuelstefancu.wordpress.com/2026/11/07/the-god-beneath-the-noise/", "title": "Legacy poem", "categories": ["Poetry"], "content_html": "<p>Legacy content <strong>survives</strong></p>", "excerpt_html": "<p>Legacy excerpt</p>"},
        {"id": 9999, "date": "2026-11-07T00:41:57", "link": "https://evil.example/legacy", "title": "Untrusted link", "categories": ["Poetry"], "content_html": "<p>Do not show</p>"},
    ]), encoding="utf-8")
    (wordpress / "media/1710-fall-in-eden.mp3").write_bytes(b"mp3!")
    (wordpress / "media-manifest.json").write_text(json.dumps({
        "site_url": "https://emanuelstefancu.wordpress.com",
        "count": 1,
        "total_bytes": 4,
        "objects": [{
            "id": 1710, "date": "2026-07-01T00:00:00", "mime_type": "audio/mpeg",
            "title": "Fall in Eden", "source_url": "https://emanuelstefancu.wordpress.com/wp-content/uploads/2026/07/fall-in-eden.mp3",
            "local_path": "media/1710-fall-in-eden.mp3", "bytes": 4, "sha256": "abcd",
        }],
    }), encoding="utf-8")
    (root / "storage/objects/poetry-media/unpublished/hidden.png").write_bytes(b"hidden")
    (root / "storage/objects/poetry-media-staging/secret/private.pdf").write_bytes(b"secret")
    subprocess.run([sys.executable, str(repo / "scripts/build_recovery_site.py"), str(root), "--repo-root", str(source)], check=True)
    page = (root / "recovery-site/index.html").read_text(encoding="utf-8")
    assert "Recovered poem" in page
    assert "Approved signal" in page
    assert "A shared thought" in page
    assert "A consent-approved message" in page
    assert "https://video.example.invalid/watch/123" in page
    assert "https://audio.example.invalid/track.mp3" in page
    assert "Open original media (external link; not stored offline)" in page
    assert "javascript:alert(1)" not in page
    assert "Legacy poem" in page
    assert "Legacy content" in page
    assert "https://emanuelstefancu.wordpress.com/2026/11/07/the-god-beneath-the-noise/" in page
    assert "https://emanuelstefancu.wordpress.com/wp-content/uploads/2026/07/fall-in-eden.mp3" in page
    assert "Fall in Eden" in page
    assert "Open original WordPress media" in page
    assert "evil.example" not in page
    assert "private.pdf" not in page
    assert "hidden.png" not in page
    assert "private@example.invalid" not in page
    assert "private-ip-hash" not in page
    assert "private moderation note" not in page
    assert "alert(1)" in page  # Kept only as inert JSON data; the viewer sanitizer strips script elements.
    assert "../storage/objects/vha-post-media/images/cover.jpg" in page
    assert "../storage/objects/poetry-media/audio/song.mp3" in page
    assert "static-assets/posts/imported/wfh/media/featured.jpg" in page
    assert (root / "recovery-site/static-assets/posts/imported/wfh/media/featured.jpg").read_bytes() == b"repo image"
    assert (root / "recovery-site/README.txt").is_file()
    package = root / "recovery-site.zip"
    subprocess.run([sys.executable, str(repo / "scripts/package_recovery_site.py"), str(root), str(package)], check=True)
    with zipfile.ZipFile(package) as archive:
        names = set(archive.namelist())
        assert "recovery-site/index.html" in names
        assert "storage/objects/vha-post-media/images/cover.jpg" in names
        assert "storage/objects/poetry-media/audio/song.mp3" in names
        assert "storage/objects/poetry-media/unpublished/hidden.png" not in names
        assert "recovery-site/static-assets/posts/imported/wfh/media/featured.jpg" in names
        assert "wordpress/media/1710-fall-in-eden.mp3" not in names
        assert not any("poetry-media-staging" in name for name in names)
print("Offline recovery-site builder and package tests passed.")
