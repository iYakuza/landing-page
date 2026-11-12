#!/usr/bin/env python3
"""Export the public WordPress.com posts and media library into a backup workspace."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

SITE_URL = "https://emanuelstefancu.wordpress.com"
API_ROOT = SITE_URL + "/wp-json/wp/v2"
USER_AGENT = "GreenDreamBackup/1.0"
PAGE_SIZE = 100
CHUNK_BYTES = 1024 * 1024
MAX_FILE_BYTES = 100 * 1024 * 1024
MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024
RETRYABLE_STATUS = {429, 500, 502, 503, 504}


def api_json(url: str) -> tuple[object, object]:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
        method="GET",
    )
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return json.loads(response.read().decode("utf-8")), response.headers
        except urllib.error.HTTPError as exc:
            if exc.code not in RETRYABLE_STATUS or attempt == 4:
                raise RuntimeError(f"WordPress API returned HTTP {exc.code} for {urllib.parse.urlsplit(url).path}.") from None
            retry_after = exc.headers.get("Retry-After", "")
            try:
                delay = min(30, max(1, int(retry_after)))
            except (TypeError, ValueError):
                delay = min(30, 2 ** attempt)
            time.sleep(delay)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError):
            if attempt == 4:
                raise RuntimeError("WordPress API request failed after retries.") from None
            time.sleep(min(30, 2 ** attempt))
    raise RuntimeError("WordPress API request failed.")


def fetch_collection(endpoint: str, fields: str) -> list[dict]:
    results: list[dict] = []
    page = 1
    total_pages = None
    while total_pages is None or page <= total_pages:
        query = urllib.parse.urlencode({
            "per_page": PAGE_SIZE,
            "page": page,
            "_fields": fields,
        })
        data, headers = api_json(f"{API_ROOT}/{endpoint}/?{query}")
        if not isinstance(data, list):
            raise RuntimeError(f"WordPress {endpoint} endpoint returned an unexpected response.")
        results.extend(item for item in data if isinstance(item, dict))
        try:
            total_pages = int(headers.get("X-WP-TotalPages", ""))
        except (TypeError, ValueError):
            total_pages = page if len(data) < PAGE_SIZE else None
        if not data:
            break
        page += 1
    return results


def rendered(value: object) -> str:
    if isinstance(value, dict):
        value = value.get("rendered", "")
    return str(value or "")


def safe_wordpress_url(value: object, *, media: bool = False) -> str:
    if not isinstance(value, str):
        raise RuntimeError("WordPress returned a missing URL.")
    candidate = value.strip()
    try:
        parsed = urllib.parse.urlsplit(candidate)
    except ValueError:
        raise RuntimeError("WordPress returned a malformed URL.") from None
    if parsed.scheme != "https" or parsed.hostname != "emanuelstefancu.wordpress.com":
        raise RuntimeError("WordPress returned a URL outside the expected site.")
    if parsed.username or parsed.password:
        raise RuntimeError("WordPress returned a URL containing credentials.")
    if media and not parsed.path.startswith("/wp-content/uploads/"):
        raise RuntimeError("WordPress returned a media URL outside its uploads directory.")
    return candidate


def normalize_post(item: dict, category_names: dict[int, str]) -> dict:
    post_id = int(item.get("id", 0))
    if post_id < 1 or item.get("status") != "publish":
        raise RuntimeError("WordPress returned a post that is not published.")
    categories = []
    for category_id in item.get("categories", []):
        try:
            numeric_id = int(category_id)
        except (TypeError, ValueError):
            continue
        categories.append(category_names.get(numeric_id, f"Category {numeric_id}"))
    tags = [str(tag) for tag in item.get("tags", []) if isinstance(tag, (str, int))]
    return {
        "id": post_id,
        "slug": str(item.get("slug") or ""),
        "date": str(item.get("date") or ""),
        "modified": str(item.get("modified") or ""),
        "link": safe_wordpress_url(item.get("link")),
        "title": html.unescape(rendered(item.get("title"))),
        "excerpt_html": rendered(item.get("excerpt")),
        "content_html": rendered(item.get("content")),
        "featured_media": int(item.get("featured_media") or 0),
        "format": str(item.get("format") or "standard"),
        "categories": categories,
        "tags": tags,
    }


def normalize_media(item: dict) -> dict:
    media_id = int(item.get("id", 0))
    if media_id < 1:
        raise RuntimeError("WordPress returned a media item without a valid ID.")
    source_url = safe_wordpress_url(item.get("source_url"), media=True)
    parsed = urllib.parse.urlsplit(source_url)
    filename = pathlib.PurePosixPath(urllib.parse.unquote(parsed.path)).name
    filename = re.sub(r"[\x00-\x1f/\\]", "_", filename).strip(" .")
    if not filename or filename in {".", ".."}:
        raise RuntimeError(f"WordPress media item {media_id} has an unsafe filename.")
    details = item.get("media_details") if isinstance(item.get("media_details"), dict) else {}
    expected = details.get("filesize")
    try:
        expected_bytes = int(expected) if expected is not None else 0
    except (TypeError, ValueError):
        expected_bytes = 0
    if expected_bytes < 0 or expected_bytes > MAX_FILE_BYTES:
        raise RuntimeError(f"WordPress media item {media_id} exceeds the per-file size limit.")
    return {
        "id": media_id,
        "date": str(item.get("date") or ""),
        "mime_type": str(item.get("mime_type") or "application/octet-stream"),
        "title": html.unescape(rendered(item.get("title"))),
        "alt_text": str(item.get("alt_text") or ""),
        "caption_html": rendered(item.get("caption")),
        "description_html": rendered(item.get("description")),
        "post": int(item.get("post") or 0),
        "source_url": source_url,
        "expected_bytes": expected_bytes,
        "local_path": f"media/{media_id}-{filename}",
    }


def download_media(url: str, destination: pathlib.Path, expected_bytes: int = 0) -> tuple[int, str]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT}, method="GET")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".partial")
    digest = hashlib.sha256()
    written = 0
    try:
        with urllib.request.urlopen(request, timeout=180) as response, temporary.open("wb") as output:
            while True:
                chunk = response.read(CHUNK_BYTES)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_FILE_BYTES:
                    raise RuntimeError("A WordPress media file exceeded the per-file size limit.")
                output.write(chunk)
                digest.update(chunk)
        if expected_bytes and written != expected_bytes:
            raise RuntimeError("A WordPress media file did not match its reported size.")
        temporary.replace(destination)
        return written, digest.hexdigest()
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def export(output_root: pathlib.Path, index_path: pathlib.Path) -> tuple[int, int, int]:
    output_root.mkdir(parents=True, exist_ok=True)
    index = json.loads(index_path.read_text(encoding="utf-8"))
    if not isinstance(index, list):
        raise RuntimeError("The checked-in WordPress archive index is invalid.")
    indexed_ids = {int(item["id"]) for item in index if isinstance(item, dict) and str(item.get("id", "")).isdigit()}

    category_rows = fetch_collection("categories", "id,name,slug")
    category_names = {int(row["id"]): html.unescape(str(row.get("name") or "")) for row in category_rows if row.get("id")}
    post_rows = fetch_collection("posts", "id,date,modified,link,slug,status,title,content,excerpt,featured_media,format,categories,tags")
    posts = [normalize_post(item, category_names) for item in post_rows if item.get("status") == "publish"]
    posts.sort(key=lambda item: (item["date"], item["id"]), reverse=True)
    post_ids = {item["id"] for item in posts}
    missing_indexed = indexed_ids - post_ids
    if missing_indexed:
        raise RuntimeError(f"The live WordPress site no longer exposes {len(missing_indexed)} indexed published posts.")

    media_rows = fetch_collection("media", "id,date,mime_type,source_url,media_details,post,title,alt_text,caption,description")
    media = [normalize_media(item) for item in media_rows]
    media.sort(key=lambda item: item["id"])
    media_root = output_root / "media"
    total_bytes = 0
    for item in media:
        destination = output_root / item["local_path"]
        size, digest = download_media(item["source_url"], destination, item["expected_bytes"])
        total_bytes += size
        if total_bytes > MAX_TOTAL_BYTES:
            raise RuntimeError("The WordPress media library exceeded the total backup size limit.")
        item["bytes"] = size
        item["sha256"] = digest
        item.pop("expected_bytes", None)
        print(f"Downloaded WordPress media {item['id']}: {size} bytes.")
    posts_path = output_root / "posts.json"
    media_path = output_root / "media-manifest.json"
    posts_path.write_text(json.dumps(posts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    media_path.write_text(json.dumps({
        "site_url": SITE_URL,
        "count": len(media),
        "total_bytes": total_bytes,
        "objects": media,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    metadata = {
        "site_url": SITE_URL,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "published_posts": len(posts),
        "media_files": len(media),
        "media_bytes": total_bytes,
        "index_entries": len(indexed_ids),
        "newer_or_unindexed_posts": len(post_ids - indexed_ids),
    }
    (output_root / "backup-metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output_root / "README.txt").write_text(
        "WORDPRESS CONTENT BACKUP\n\n"
        "Contains all public published posts and every public media-library file from "
        f"{SITE_URL}.\n"
        "Posts are stored in posts.json. Media bytes are stored under media/ and "
        "indexed with SHA-256 checksums in media-manifest.json.\n"
        "This folder is included only inside the encrypted Green Dream backup archive.\n",
        encoding="utf-8",
    )
    print(f"WordPress export complete: {len(posts)} published posts, {len(media)} media files, {total_bytes} bytes.")
    return len(posts), len(media), total_bytes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=pathlib.Path)
    parser.add_argument("--index", default="human-archive/archive-data.json", type=pathlib.Path)
    args = parser.parse_args()
    posts, media, total = export(args.output, args.index)
    print(f"Summary: {posts} posts; {media} media files; {total / (1024 * 1024):.2f} MiB.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"WordPress archive backup failed: {exc}", file=sys.stderr)
        sys.exit(1)
