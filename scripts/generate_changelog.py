#!/usr/bin/env python3
"""Build a visitor-facing changelog entry from one GitHub push event."""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

EVENT_PATH = Path(sys.argv[1])
OUTPUT_PATH = Path(sys.argv[2])
event = json.loads(EVENT_PATH.read_text(encoding="utf-8"))
repo = os.environ.get("GITHUB_REPOSITORY", "iYakuza/landing-page")
commits = event.get("commits") or []
before = event.get("before", "")
after = event.get("after", "")

if not commits or before == after:
    raise SystemExit(0)

def changed_files(commit):
    return sorted(set((commit.get("added") or []) + (commit.get("modified") or []) + (commit.get("removed") or [])))

all_files = sorted(set(path for commit in commits for path in changed_files(commit)))
ignored = (
    "changelog.json",
    "scripts/generate_changelog.py",
    ".github/workflows/changelog.yml",
)
meaningful_files = [p for p in all_files if p not in ignored]
if not meaningful_files:
    print("Only changelog automation files changed; no public entry generated.")
    raise SystemExit(0)

subjects = [str(commit.get("message") or "").strip().splitlines()[0].lower() for commit in commits]
if subjects and all(re.search(r"\brefresh\b.*\bcache\b|\brefresh crystal interaction stylesheet\b|\bsyntax\b", subject) for subject in subjects):
    print("Only cache-busting maintenance commits changed; no public entry generated.")
    raise SystemExit(0)

messages = []
for commit in commits:
    message = str(commit.get("message") or "").strip().splitlines()[0]
    if message and message not in messages:
        messages.append(message)

text = " ".join(messages).lower()
paths = " ".join(meaningful_files).lower()

def component_for(path):
    p = path.lower()
    if "shared/crystal/tools/star-patterns" in p:
        return "Star Patterns"
    if "shared/crystal/tools/changelog" in p or "changelog" in p:
        return "Latest Changelog"
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
for path in meaningful_files:
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

# Specific, verified summaries for recurring project areas.
if "visitor-friendly changelog" in text or ("structured" in text and "changelog" in text):
    title = "A more meaningful project activity feed"
    detail = "The activity feed now turns related development work into clear visitor-facing updates, while keeping the original commits available for anyone who wants the technical details."
    component = "Latest Changelog"
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
        verb = "New capabilities for"
    elif category == "FIX":
        verb = "More reliable"
    elif category == "CONTENT":
        verb = "Fresh additions to"
    else:
        verb = "A refined"
    title = (verb + " " + component).strip()
    readable_messages = "; ".join(messages[:3])
    if len(messages) > 3:
        readable_messages += "; and " + str(len(messages) - 3) + " more related changes"
    file_labels = []
    for path in meaningful_files[:4]:
        name = Path(path).name
        if name not in file_labels:
            file_labels.append(name)
    detail = "This update brings together " + readable_messages.rstrip(".") + "."
    if file_labels:
        detail += " It updates " + ", ".join(file_labels) + (" and related project files." if len(meaningful_files) > len(file_labels) else ".")
    detail = detail[:520]

timestamp = max(
    (c.get("timestamp") or c.get("author", {}).get("date") or "" for c in commits),
    default=""
)
if not timestamp:
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

source_commits = []
for commit in commits:
    sha = str(commit.get("id") or "")
    if not sha:
        continue
    source_commits.append({
        "message": str(commit.get("message") or "Website update").strip().splitlines()[0][:180],
        "url": "https://github.com/" + repo + "/commit/" + sha,
        "files": changed_files(commit)[:12],
    })

entry = {
    "id": after or (source_commits[0]["url"].rsplit("/", 1)[-1] if source_commits else timestamp),
    "timestamp": timestamp,
    "category": category,
    "component": component,
    "title": title[:120],
    "description": detail,
    "commit_count": len(source_commits),
    "files": meaningful_files[:20],
    "commits": source_commits[:20],
}

data = {"version": 1, "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"), "entries": []}
if OUTPUT_PATH.exists():
    try:
        existing = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        if isinstance(existing, dict) and isinstance(existing.get("entries"), list):
            data = existing
    except (json.JSONDecodeError, OSError):
        pass

entries = [item for item in data.get("entries", []) if item.get("id") != entry["id"]]
entries.insert(0, entry)
data["version"] = 1
data["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
data["entries"] = entries[:40]
OUTPUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("Prepared changelog entry: " + entry["title"])
