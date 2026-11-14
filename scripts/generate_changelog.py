#!/usr/bin/env python3
"""Publish one visitor-facing summary for all meaningful commits since the last feed update."""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

OUTPUT_PATH = Path(sys.argv[2])
repo = os.environ.get("GITHUB_REPOSITORY", "iYakuza/landing-page")

def git(*args):
    result = subprocess.run(["git", *args], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        return ""
    return result.stdout.strip()

data = {"version": 1, "updated_at": "", "last_processed_sha": "", "entries": []}
if OUTPUT_PATH.exists():
    try:
        existing = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        if isinstance(existing, dict) and isinstance(existing.get("entries"), list):
            data.update(existing)
    except (json.JSONDecodeError, OSError):
        pass

head_sha = git("rev-parse", "HEAD")
last_processed = str(data.get("last_processed_sha") or "").strip()
if not head_sha:
    raise SystemExit("Unable to determine the checked-out commit.")

if last_processed:
    if last_processed == head_sha:
        print("The changelog is already current.")
        raise SystemExit(0)
    ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", last_processed, head_sha], check=False)
    if ancestor.returncode == 0:
        commit_shas = git("rev-list", "--reverse", last_processed + ".." + head_sha).splitlines()
    else:
        print("Previous feed checkpoint is not an ancestor; using the current push range.")
        event = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
        before = event.get("before") or ""
        commit_shas = git("rev-list", "--reverse", before + ".." + head_sha).splitlines() if before else []
else:
    event = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    before = event.get("before") or ""
    commit_shas = git("rev-list", "--reverse", before + ".." + head_sha).splitlines() if before else []

ignored_paths = {
    "changelog.json",
    "scripts/generate_changelog.py",
    ".github/workflows/changelog.yml",
}
meaningful = []
for sha in commit_shas:
    metadata = git("show", "-s", "--format=%s%x1f%cI", sha)
    if not metadata:
        continue
    parts = metadata.split("\x1f", 1)
    message = parts[0].strip() or "Website update"
    timestamp = parts[1].strip() if len(parts) > 1 else ""
    files = git("diff-tree", "--no-commit-id", "--name-only", "-r", sha).splitlines()
    files = sorted(set(path.strip() for path in files if path.strip()))
    if not files or all(path in ignored_paths for path in files):
        continue
    if re.search(r"\brefresh\b.*\bcache\b|\brefresh crystal interaction stylesheet\b|\bsyntax\b", message, re.I):
        continue
    meaningful.append({"sha": sha, "message": message, "timestamp": timestamp, "files": files})

# Advance the checkpoint even when a push contains only maintenance, so it is
# never accidentally bundled into a later visitor-facing release.
data["last_processed_sha"] = head_sha
if not meaningful:
    OUTPUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("No visitor-facing changes in this push range.")
    raise SystemExit(0)

all_files = sorted(set(path for item in meaningful for path in item["files"]))
messages = []
for item in meaningful:
    subject = item["message"].splitlines()[0]
    if subject not in messages:
        messages.append(subject)
text = " ".join(messages).lower()
paths = " ".join(all_files).lower()

def component_for(path):
    p = path.lower()
    if "shared/crystal/tools/star-patterns" in p:
        return "Star Patterns"
    if "shared/crystal/tools/changelog" in p or "changelog" in p:
        return "Latest Changelog"
    if "shared/crystal/tools/radio" in p:
        return "V/A Radio"
    if "shared/crystal/tools/mood" in p:
        return "Mood Tool"
    if "shared/crystal/tools/presentation" in p:
        return "Presentation Mode"
    if "shared/crystal" in p or "game-ui" in p or "constellation" in p:
        return "Crystal Experience"
    if "green-dream" in p or "posts/" in p or "poetry" in p:
        return "Creative Archive"
    if "/cv/" in p or p.startswith("cv/"):
        return "Professional Profile"
    if "/cms/" in p or p.startswith("cms/"):
        return "Creator Workshop"
    if p.endswith("index.html") or p in ("home.js", "home.css"):
        return "Website Experience"
    if p.endswith(".css"):
        return "Interface Design"
    return "Website"

components = []
for path in all_files:
    label = component_for(path)
    if label not in components:
        components.append(label)
component = components[0] if len(components) == 1 else ("Website Experience" if len(components) > 3 else "Website Updates")

category = "IMPROVEMENT"
if re.search(r"\b(fix|bug|repair|correct|resolve|prevent|regression)\b", text):
    category = "FIX"
elif re.search(r"\b(add|introduc|creat|launch|feat|implement|new)\b", text):
    category = "FEATURE"
elif re.search(r"\b(poem|poetry|article|post|content|writing|music)\b", text):
    category = "CONTENT"

if "same-origin" in text or ("published site" in text and "changelog" in text):
    title = "A self-contained live changelog"
    detail = "The activity feed now reads its published update file directly from the website, avoiding per-visitor GitHub API requests while continuing to refresh automatically."
    component = "Latest Changelog"
    category = "IMPROVEMENT"
elif "visitor-friendly changelog" in text or ("structured" in text and "changelog" in text):
    title = "A more meaningful project activity feed"
    detail = "The activity feed now turns related development work into clear visitor-facing updates, while keeping the original commits available for anyone who wants the technical details."
    component = "Latest Changelog"
    category = "FEATURE"
elif "quick post" in text or "creator-posting.js" in paths:
    title = "Quick Post is now available across public content pages"
    detail = "Authorised CMS administrators can open the Owner Studio composer directly from public content pages. The shortcut remains hidden from ordinary visitors and is managed through one shared component."
    component = "Creator Workshop"
    category = "FEATURE"
elif "ursa major" in text or ("star-pattern" in paths and "default" in text):
    title = "Ursa Major now welcomes first-time visitors"
    detail = "New visitors now enter Crystal mode with Ursa Major selected by default. Existing saved constellation arrangements are preserved."
    component = "Star Patterns"
    category = "IMPROVEMENT"
elif "poetry index" in text or ("movement-archive" in paths and "column" in text):
    title = "A clearer, more readable Poetry Index"
    detail = "The five movements now appear in a single vertical column, making the archive easier to scan and navigate."
    component = "Creative Archive"
    category = "IMPROVEMENT"
elif "changelog" in text and ("interaction" in text or "crystal" in text):
    title = "Latest Changelog stays within the Crystal experience"
    detail = "The changelog panel remains interactive while the surrounding page is softened, allowing visitors to read updates without leaving Crystal mode."
    component = "Latest Changelog"
    category = "FIX" if re.search(r"\b(fix|prevent|keep|remain)\b", text) else "IMPROVEMENT"
elif "stylesheet" in text and "crystal" in text:
    title = "A smoother Crystal interaction experience"
    detail = "Updated the Crystal interface styling to keep the relevant panels clear and usable while the surrounding page is dimmed."
    component = "Crystal Experience"
    category = "IMPROVEMENT"
else:
    if category == "FEATURE":
        lead = "New capabilities for"
    elif category == "FIX":
        lead = "More reliable"
    elif category == "CONTENT":
        lead = "Fresh additions to"
    else:
        lead = "A refined"
    title = (lead + " " + component).strip()
    readable = "; ".join(messages[:3])
    if len(messages) > 3:
        readable += "; and " + str(len(messages) - 3) + " more related changes"
    names = []
    for path in all_files[:4]:
        name = Path(path).name
        if name not in names:
            names.append(name)
    detail = "This update brings together " + readable.rstrip(".") + "."
    if names:
        detail += " It updates " + ", ".join(names) + (" and related project files." if len(all_files) > len(names) else ".")
    detail = detail[:520]

timestamp = max((item["timestamp"] for item in meaningful if item["timestamp"]), default=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
source_commits = [{
    "message": item["message"].splitlines()[0][:180],
    "url": "https://github.com/" + repo + "/commit/" + item["sha"],
    "files": item["files"][:12],
} for item in meaningful[:20]]

entry = {
    "id": head_sha,
    "timestamp": timestamp,
    "category": category,
    "component": component,
    "title": title[:120],
    "description": detail,
    "commit_count": len(meaningful),
    "files": all_files[:30],
    "commits": source_commits,
}
entries = [item for item in data.get("entries", []) if item.get("id") != entry["id"]]
entries.insert(0, entry)
data["version"] = 1
data["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
data["entries"] = entries[:40]
OUTPUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("Prepared visitor-facing update: " + entry["title"] + " (" + str(len(meaningful)) + " commits)")
