from pathlib import Path
from urllib.parse import urlsplit, unquote
import re, subprocess, xml.etree.ElementTree as ET

root = Path(".").resolve()
tracked = [Path(p) for p in subprocess.check_output(["git", "ls-files"], text=True).splitlines()]
known = {p.as_posix() for p in tracked}
inbound = {}
missing = []

def resolve(source, raw, kind):
    raw = unquote(raw.strip())
    if not raw or raw.startswith("#") or re.match(r"^(https?:|mailto:|tel:|data:|javascript:|//)", raw, re.I):
        return
    path = urlsplit(raw).path
    if not path:
        return
    if path.startswith("/landing-page/"):
        path = path[len("/landing-page/"):]
    elif path.startswith("/"):
        path = path.lstrip("/")
    else:
        path = str(source.parent / path)
    parts = []
    for part in Path(path).parts:
        if part in ("", "."): continue
        if part == "..":
            if parts: parts.pop()
        else: parts.append(part)
    path = "/".join(parts)
    choices = [path]
    if path.endswith("/"): choices.append(path + "index.html")
    elif "." not in Path(path).name: choices += [path + ".html", path + "/index.html"]
    target = next((p for p in choices if p in known), None)
    if target:
        inbound.setdefault(target, set()).add(source.as_posix())
    elif re.search(r"\.(html?|js|mjs|css|svg|json|xml|png|jpe?g|webp|woff2?)(?:$|[?#])", raw, re.I):
        missing.append((source.as_posix(), raw, kind))

suffixes = {".html", ".htm", ".js", ".mjs", ".css", ".svg", ".json", ".xml", ".md", ".yml", ".yaml", ".py", ".ts", ".toml", ".sql", ".txt"}
for source in tracked:
    if source.suffix.lower() not in suffixes: continue
    try: body = source.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError): continue
    patterns = [
        (r"""(?:src|href|poster|action|data-src|data-href)\s*=\s*["']([^"']+)["']""", "html"),
        (r"""url\(\s*["']?([^)"']+)""", "css"),
        (r"""(?:import\s+(?:[^'"]*?\s+from\s+)?|export\s+[^'"]*?\s+from\s+|import\s*\()\s*["']([^"']+)["']""", "module"),
        (r"""(?:fetch|new URL)\s*\(\s*["']([^"']+)["']""", "runtime"),
        (r"""["']([^"']+\.(?:html?|js|mjs|css|svg|json|xml|png|jpe?g|webp|woff2?)(?:[?#][^"']*)?)["']""", "literal"),
        (r"""\]\(([^)]+)\)""", "markdown"),
    ]
    for pattern, kind in patterns:
        for match in re.finditer(pattern, body, re.I):
            resolve(source, match.group(1), kind)
    if source.name == "sitemap.xml":
        try:
            for node in ET.fromstring(body).iter():
                if node.tag.endswith("loc") and node.text:
                    resolve(source, node.text, "sitemap")
        except ET.ParseError:
            pass

roots = {"index.html"}
for source in tracked:
    if source.name == "sitemap.xml":
        try:
            body = source.read_text(encoding="utf-8")
            for node in ET.fromstring(body).iter():
                if node.tag.endswith("loc") and node.text:
                    p = urlsplit(node.text).path
                    if p.startswith("/landing-page/"): p = p[len("/landing-page/"):]
                    p = p.lstrip("/")
                    if p.endswith("/"): p += "index.html"
                    elif not Path(p).suffix: p += ".html"
                    if p in known: roots.add(p)
        except Exception: pass

code_suffixes = {".js", ".mjs", ".css", ".html", ".htm"}
excluded = (".github/", "docs/", "scripts/", "supabase/")
candidates = []
for p in tracked:
    name = p.as_posix()
    if p.suffix.lower() not in code_suffixes or name in roots or name.startswith(excluded): continue
    if name not in inbound: candidates.append(name)

print("TRACKED_FILES", len(tracked))
print("PARSED_REFERENCES", sum(map(len, inbound.values())))
print("UNRESOLVED_LOCAL_ASSET_REFERENCES", len(missing))
for source, raw, kind in missing[:100]:
    print("MISSING", source, "->", raw, "[" + kind + "]")
print("UNREFERENCED_CODE_CANDIDATES", len(candidates))
for name in candidates:
    print("CANDIDATE", name)
