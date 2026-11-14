#!/usr/bin/env python3
"""Recover Human Archive media into the disposable Green Dream Supabase project."""
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

EXPECTED_PROJECT_REF = "ioguymqdeuuursizifnn"
BUCKET = "human-archive-media"
MAX_FILE_BYTES = 30 * 1024 * 1024
MANIFEST_PATH = Path("human-archive/media-manifest.json")
REPORT_PATH = Path("human-archive/media-import-report.json")
RETRYABLE = {408, 425, 429, 500, 502, 503, 504}
ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
    "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/x-m4a",
    "video/mp4", "video/webm", "video/quicktime", "application/pdf",
}


def allowed_host(host):
    host = (host or "").lower().rstrip(".")
    return (
        host == "emanuelstefancu.com"
        or host.endswith(".emanuelstefancu.com")
        or host.endswith(".wordpress.com")
        or host.endswith(".wp.com")
        or host in {"i0.wp.com", "i1.wp.com", "i2.wp.com", "i3.wp.com", "files.wordpress.com"}
        or host.endswith(".pinimg.com")
        or host.endswith(".tumblr.com")
        or host == "www2.hawaii.edu"
        or host.endswith(".hawaii.edu")
        or host in {"issues4life.org", "www.issues4life.org"}
    )


def download_source(url):
    for attempt in range(1, 5):
        try:
            request = Request(
                url,
                headers={
                    "User-Agent": "GreenDream-HumanArchive-Recovery/1.0",
                    "Accept": "*/*",
                },
            )
            with urlopen(request, timeout=180) as response:
                final_url = response.geturl()
                final = urlparse(final_url)
                if final.scheme != "https" or not allowed_host(final.hostname):
                    raise RuntimeError("Source redirected outside the approved HTTPS host allowlist")
                data = response.read(MAX_FILE_BYTES + 1)
                if len(data) > MAX_FILE_BYTES:
                    raise RuntimeError("File exceeds the recovery bucket's 30 MiB object limit")
                return data, final_url
        except HTTPError as error:
            if error.code not in RETRYABLE or attempt == 4:
                raise RuntimeError("Source download failed with HTTP " + str(error.code))
        except (URLError, TimeoutError, OSError) as error:
            if attempt == 4:
                raise RuntimeError("Source download failed after retries: " + type(error).__name__)
        time.sleep(min(2 ** attempt, 10))
    raise RuntimeError("Source download failed")



def signature_matches(data, mime):
    if not data:
        return False
    if mime == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if mime == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if mime == "image/gif":
        return data.startswith((b"GIF87a", b"GIF89a"))
    if mime == "image/webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if mime == "image/avif":
        return len(data) >= 12 and data[4:8] == b"ftyp" and b"avif" in data[8:32]
    if mime == "audio/mpeg":
        return data.startswith(b"ID3") or (len(data) >= 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0)
    if mime in {"audio/mp4", "video/mp4", "video/quicktime"}:
        return len(data) >= 12 and data[4:8] == b"ftyp"
    if mime == "audio/wav":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE"
    if mime in {"audio/ogg", "video/webm"}:
        return data.startswith(b"OggS") if mime == "audio/ogg" else data.startswith(b"\x1aE\xdf\xa3")
    if mime == "application/pdf":
        return data.startswith(b"%PDF-")
    return False


def sniff_mime(data):
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if len(data) >= 12 and data[4:8] == b"ftyp" and b"avif" in data[8:32]:
        return "image/avif"
    if data.startswith(b"ID3") or (len(data) >= 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0):
        return "audio/mpeg"
    if len(data) >= 12 and data[4:8] == b"ftyp":
        return "video/mp4"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "audio/wav"
    if data.startswith(b"OggS"):
        return "audio/ogg"
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    prefix = data[:64].lstrip().lower()
    if prefix.startswith(b"<!doctype html") or prefix.startswith(b"<html") or prefix.startswith(b"<?xml"):
        return "text/html-or-xml"
    return "unknown"

def upload_and_verify(base_url, secret, item, data):
    object_path = quote(item["storage_path"], safe="/")
    endpoint = base_url + "/storage/v1/object/" + BUCKET + "/" + object_path
    headers = {
        "apikey": secret,
        "Authorization": "Bearer " + secret,
        "Content-Type": item["mime_type"],
        "Cache-Control": "public, max-age=31536000, immutable",
        "x-upsert": "true",
    }
    for attempt in range(1, 5):
        try:
            request = Request(endpoint, data=data, headers=headers, method="POST")
            with urlopen(request, timeout=240) as response:
                if response.status not in (200, 201):
                    raise RuntimeError("Storage upload returned HTTP " + str(response.status))
                break
        except HTTPError as error:
            if error.code not in RETRYABLE or attempt == 4:
                raise RuntimeError("Storage upload failed with HTTP " + str(error.code))
        except (URLError, TimeoutError, OSError) as error:
            if attempt == 4:
                raise RuntimeError("Storage upload failed after retries: " + type(error).__name__)
        time.sleep(min(2 ** attempt, 10))

    public_url = base_url + "/storage/v1/object/public/" + BUCKET + "/" + object_path
    for attempt in range(1, 4):
        try:
            request = Request(public_url, method="HEAD", headers={"Cache-Control": "no-cache"})
            with urlopen(request, timeout=60) as response:
                if response.status == 200:
                    return public_url
                raise RuntimeError("Public object verification returned HTTP " + str(response.status))
        except HTTPError as error:
            if error.code not in RETRYABLE or attempt == 3:
                raise RuntimeError("Public object verification failed with HTTP " + str(error.code))
        except (URLError, TimeoutError, OSError) as error:
            if attempt == 3:
                raise RuntimeError("Public object verification failed after retries: " + type(error).__name__)
        time.sleep(attempt * 2)
    raise RuntimeError("Public object verification failed")


def main():
    base_url = os.environ.get("SUPABASE_RESTORE_URL", "").rstrip("/")
    secret = os.environ.get("SUPABASE_RESTORE_SECRET_KEY", "")
    parsed = urlparse(base_url)
    target_ref = (parsed.hostname or "").split(".")[0].lower()
    if parsed.scheme != "https" or target_ref != EXPECTED_PROJECT_REF:
        raise SystemExit("Refusing to use a Supabase URL other than the approved recovery project")
    if not secret:
        raise SystemExit("Missing SUPABASE_RESTORE_SECRET_KEY GitHub Actions secret")

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    items = manifest.get("items")
    if not isinstance(items, list) or len(items) != manifest.get("item_count"):
        raise SystemExit("Media manifest is incomplete or inconsistent")

    previous = {}
    if REPORT_PATH.exists():
        try:
            old_report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
            if old_report.get("target_project_ref") == EXPECTED_PROJECT_REF and old_report.get("bucket") == BUCKET:
                previous = {
                    entry["storage_path"]: entry
                    for entry in old_report.get("successes", [])
                    if entry.get("verified") is True and entry.get("storage_path")
                }
        except (ValueError, OSError, TypeError):
            previous = {}

    current_paths = {item["storage_path"] for item in items}
    successes = [entry for path, entry in previous.items() if path in current_paths]
    verified_paths = {entry["storage_path"] for entry in successes}
    failures = []
    total_bytes = sum(int(entry.get("bytes") or 0) for entry in successes)
    pending = [item for item in items if item["storage_path"] not in verified_paths]
    print("Previously verified objects retained: " + str(len(successes)) + "; retrying: " + str(len(pending)))

    for number, item in enumerate(pending, start=1):
        asset_id = str(item.get("id", number))
        data = b""
        detected_mime = "unknown"
        try:
            source = item["source_url"]
            source_parts = urlparse(source)
            if source_parts.scheme != "https" or not allowed_host(source_parts.hostname):
                raise RuntimeError("Source URL is outside the approved HTTPS host allowlist")
            mime = item["mime_type"]
            if mime not in ALLOWED_MIME_TYPES:
                raise RuntimeError("MIME type is not allowed in the recovery bucket")

            data, final_url = download_source(source)
            detected_mime = sniff_mime(data)
            if not signature_matches(data, mime):
                raise RuntimeError(
                    "Declared MIME type is " + mime + " but the file signature indicates "
                    + detected_mime + "; first 24 bytes (hex): " + data[:24].hex()
                )
            expected_size = int(item.get("expected_size") or 0)
            size_matches = not expected_size or len(data) == expected_size
            public_url = upload_and_verify(base_url, secret, item, data)
            digest = hashlib.sha256(data).hexdigest()
            successes.append({
                "id": asset_id,
                "storage_path": item["storage_path"],
                "bytes": len(data),
                "expected_bytes": expected_size,
                "metadata_size_matches": size_matches,
                "sha256": digest,
                "public_url": public_url,
                "verified": True,
                "detected_mime": detected_mime,
                "final_source_host": urlparse(final_url).hostname,
            })
            total_bytes += len(data)
            print("Imported " + str(number) + "/" + str(len(pending)) + ": " + asset_id + " (" + str(len(data)) + " bytes; " + detected_mime + ")")
        except Exception as error:
            failures.append({
                "id": asset_id,
                "storage_path": item.get("storage_path"),
                "error": str(error),
                "detected_mime": detected_mime,
                "first_24_bytes_hex": data[:24].hex() if data else "",
            })
            print("FAILED " + str(number) + "/" + str(len(pending)) + ": " + asset_id + " — " + str(error))

    report = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "target_project_ref": EXPECTED_PROJECT_REF,
        "bucket": BUCKET,
        "status": "complete" if not failures and len(successes) == len(items) else "partial",
        "asset_count": len(items),
        "successful_count": len(successes),
        "failed_count": len(failures),
        "previously_verified_count": len(successes) - len(pending) + max(0, len(pending) - len(failures)),
        "metadata_size_mismatch_count": sum(1 for entry in successes if entry.get("metadata_size_matches") is False),
        "total_bytes_verified": total_bytes,
        "total_mib_verified": round(total_bytes / 1048576, 2),
        "successes": successes,
        "failures": failures,
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with Path(summary_path).open("a", encoding="utf-8") as stream:
            stream.write("## Human Archive media import\n\n")
            stream.write("- Destination: recovery Supabase project only\n")
            stream.write("- Bucket: " + BUCKET + "\n")
            stream.write("- Result: **" + report["status"].upper() + "**\n")
            stream.write("- Verified objects: " + str(len(successes)) + " / " + str(len(items)) + "\n")
            stream.write("- Verified bytes: " + str(report["total_mib_verified"]) + " MiB\n")
            if failures:
                stream.write("\n### Failed files\n")
                for failure in failures:
                    stream.write("- " + failure["id"] + ": " + failure["error"] + "\n")
    print("Import result: " + report["status"] + "; " + str(len(successes)) + "/" + str(len(items)) + " objects verified")
    return 0 if report["status"] == "complete" else 1


if __name__ == "__main__":
    sys.exit(main())
