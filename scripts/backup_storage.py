#!/usr/bin/env python3
"""Download every object from the configured Supabase Storage buckets."""
import argparse
import hashlib
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

API_URL = os.environ.get("SUPABASE_URL", "https://oeyxsqocldlovhsmzcjw.supabase.co").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
if not SERVICE_KEY:
    raise SystemExit("SUPABASE_SECRET_KEY is required (legacy SUPABASE_SERVICE_ROLE_KEY is accepted temporarily).")

def auth_headers(content_type=False):
    headers = {"apikey": SERVICE_KEY}
    if not SERVICE_KEY.startswith("sb_secret_"):
        headers["Authorization"] = "Bearer " + SERVICE_KEY
    if content_type:
        headers["Content-Type"] = "application/json"
    return headers
BUCKETS = ("poetry-media", "poetry-media-staging", "vha-post-media")
PAGE_SIZE = 100
HEADERS = auth_headers(content_type=True)

def request_json(url, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Supabase Storage API returned HTTP {exc.code}; response details suppressed.") from None

def download_object(bucket, object_path, destination):
    encoded = urllib.parse.quote(object_path, safe="/")
    url = f"{API_URL}/storage/v1/object/{urllib.parse.quote(bucket, safe='')}/{encoded}"
    req = urllib.request.Request(url, headers=auth_headers())
    digest = hashlib.sha256()
    size = 0
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".partial")
    try:
        with urllib.request.urlopen(req, timeout=180) as response, temporary.open("wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
                digest.update(chunk)
                size += len(chunk)
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    return {"bucket": bucket, "path": object_path, "bytes": size, "sha256": digest.hexdigest()}

def walk_bucket(bucket, output_root, prefix=""):
    offset = 0
    records = []
    while True:
        items = request_json(
            f"{API_URL}/storage/v1/object/list/{urllib.parse.quote(bucket, safe='')}",
            method="POST",
            body={"prefix": prefix, "limit": PAGE_SIZE, "offset": offset,
                  "sortBy": {"column": "name", "order": "asc"}},
        )
        if not isinstance(items, list):
            raise RuntimeError(f"Unexpected listing response for bucket {bucket}")
        for item in items:
            name = item.get("name")
            if not isinstance(name, str) or name in ("", ".", "..") or "/" in name:
                raise RuntimeError(f"Unexpected object name in bucket {bucket}")
            full_path = f"{prefix}{name}"
            if item.get("metadata") is None:
                records.extend(walk_bucket(bucket, output_root, full_path.rstrip("/") + "/"))
            else:
                destination = output_root / bucket / pathlib.PurePosixPath(full_path)
                records.append(download_object(bucket, full_path, destination))
                print(f"Downloaded one object from {bucket} ({records[-1]['bytes']} bytes)")
        if len(items) < PAGE_SIZE:
            break
        offset += len(items)
    return records

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=pathlib.Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    all_records = []
    for bucket in BUCKETS:
        print(f"Listing bucket: {bucket}")
        all_records.extend(walk_bucket(bucket, args.output))
    manifest = {"buckets": list(BUCKETS), "object_count": len(all_records),
                "total_bytes": sum(item["bytes"] for item in all_records),
                "objects": all_records}
    (args.output / "storage-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Storage export complete: {len(all_records)} objects, {manifest['total_bytes']} bytes")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Storage backup failed ({type(exc).__name__}); object paths and response details suppressed.", file=sys.stderr)
        sys.exit(1)
