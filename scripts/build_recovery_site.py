#!/usr/bin/env python3
"""Build an offline, read-only recovery website from a content backup snapshot."""
from __future__ import annotations

import argparse
import json
import mimetypes
import pathlib
import shutil
import sys
from urllib.parse import quote, urlsplit

parser = argparse.ArgumentParser()
parser.add_argument("backup_root", type=pathlib.Path)
parser.add_argument("--repo-root", type=pathlib.Path, default=pathlib.Path.cwd())
args = parser.parse_args()
ROOT = args.backup_root.resolve()
REPO_ROOT = args.repo_root.resolve()
DB = ROOT / "database" / "public-content.json"
BUCKETS = ROOT / "storage" / "buckets.json"
STORAGE = ROOT / "storage" / "objects"
SITE = ROOT / "recovery-site"

def load_json(path):
    if not path.is_file():
        raise SystemExit(f"Required recovery input is missing: {path.relative_to(ROOT)}")
    return json.loads(path.read_text(encoding="utf-8"))

def storage_href(bucket, name):
    parts = [quote(part, safe="") for part in name.split("/")]
    return "../storage/objects/" + quote(bucket, safe="") + "/" + "/".join(parts)

def external_http_url(value):
    if not isinstance(value, str):
        return None
    candidate = value.strip()
    try:
        parsed = urlsplit(candidate)
    except ValueError:
        return None
    if parsed.scheme.lower() not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
        return None
    return candidate

def main():
    content = load_json(DB)
    buckets = load_json(BUCKETS)
    storage_manifest = load_json(STORAGE / "storage-manifest.json")
    wordpress_root = ROOT / "wordpress"
    wordpress_posts = load_json(wordpress_root / "posts.json")
    wordpress_media_manifest = load_json(wordpress_root / "media-manifest.json")
    if not isinstance(wordpress_posts, list):
        raise SystemExit("WordPress posts export has an unexpected structure.")
    wordpress_objects = wordpress_media_manifest.get("objects") if isinstance(wordpress_media_manifest, dict) else None
    if not isinstance(wordpress_objects, list) or wordpress_media_manifest.get("count") != len(wordpress_objects):
        raise SystemExit("WordPress media manifest has an unexpected structure.")
    if sum(int(item.get("bytes", 0)) for item in wordpress_objects) != int(wordpress_media_manifest.get("total_bytes", -1)):
        raise SystemExit("WordPress media manifest total does not match its objects.")
    legacy = []
    for item in wordpress_posts:
        if not isinstance(item, dict):
            continue
        url = external_http_url(item.get("link"))
        try:
            valid_legacy_url = url and urlsplit(url).hostname == "emanuelstefancu.wordpress.com"
        except ValueError:
            valid_legacy_url = False
        if not valid_legacy_url:
            continue
        post_date = str(item.get("date") or "")
        title = str(item.get("title") or "").strip()
        if not title or not post_date:
            continue
        legacy.append({
            "id": int(item["id"]) if str(item.get("id", "")).isdigit() else None,
            "date": post_date,
            "year": post_date[:4],
            "title": title,
            "url": url,
            "categories": [value for value in item.get("categories", []) if isinstance(value, str)],
            "content_html": item.get("content_html") or "",
            "excerpt_html": item.get("excerpt_html") or "",
        })
    if not isinstance(content, dict) or not isinstance(content.get("posts"), list) or not isinstance(content.get("submissions"), list) or not isinstance(content.get("transmissions", []), list):
        raise SystemExit("Public content snapshot has an unexpected structure.")
    public_buckets = {item["id"] for item in buckets if item.get("public") is True}
    object_map = {(item["bucket"], item["path"]): item for item in storage_manifest.get("objects", [])}
    if len(object_map) != len(storage_manifest.get("objects", [])):
        raise SystemExit("Storage manifest contains duplicate object references.")
    published_media_refs = {
        ("vha-post-media", row.get("media_path"))
        for row in content["posts"] if row.get("media_path")
    }
    published_media_refs.update({
        ("poetry-media", row.get("storage_path"))
        for row in content["submissions"] if row.get("storage_path")
    })

    records = []
    media = []
    for source_row in content["posts"]:
        row = {key: source_row.get(key) for key in (
            "title", "slug", "category", "excerpt", "content_html", "published_at",
            "media_url", "media_path", "media_type", "media_width",
        )}
        path = row.get("media_path")
        bucket = "vha-post-media"
        ref = object_map.get((bucket, path)) if path else None
        media_href = storage_href(bucket, path) if ref and bucket in public_buckets else None
        local_url = row.get("media_url")
        if not media_href and isinstance(local_url, str) and local_url.startswith("/landing-page/"):
            relative = pathlib.PurePosixPath(local_url.removeprefix("/landing-page/"))
            if relative.is_absolute() or any(part in ("", ".", "..") for part in relative.parts):
                raise SystemExit("A repository media reference contains an unsafe path.")
            source = REPO_ROOT.joinpath(*relative.parts)
            if not source.is_file():
                raise SystemExit("A referenced repository media asset is missing from the checked-out source.")
            destination = SITE / "static-assets" / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
            media_href = "static-assets/" + "/".join(quote(part, safe="") for part in relative.parts)
            media.append({"bucket": "repository assets", "path": relative.as_posix(), "href": media_href,
                          "bytes": destination.stat().st_size, "mime": mimetypes.guess_type(relative.name)[0] or "application/octet-stream"})
        external_url = external_http_url(local_url)
        if not media_href and external_url:
            media_href = external_url
        if local_url and not (isinstance(local_url, str) and local_url.startswith("/landing-page/")) and not external_url:
            row["media_url"] = None
        row.update({"kind": "Post", "media_href": media_href})
        records.append(row)
    for source_row in content["submissions"]:
        row = {key: source_row.get(key) for key in (
            "title", "slug", "medium", "body", "byline", "published_at", "media_url", "storage_path",
        )}
        path = row.get("storage_path")
        bucket = "poetry-media"
        ref = object_map.get((bucket, path)) if path else None
        media_href = storage_href(bucket, path) if ref and bucket in public_buckets else external_http_url(row.get("media_url"))
        if row.get("media_url") and not external_http_url(row.get("media_url")):
            row["media_url"] = None
        row.update({"kind": "Community submission", "category": "COMMUNITY", "excerpt": "", "content_html": row.get("body") or "", "media_href": media_href})
        records.append(row)
    for source_row in content.get("transmissions", []):
        row = {key: source_row.get(key) for key in ("title", "message", "display_name", "created_at")}
        row.update({
            "kind": "Community transmission",
            "category": "COMMUNITY TRANSMISSIONS",
            "excerpt": "",
            "content_html": row.get("message") or "",
            "published_at": row.get("created_at"),
            "byline": row.get("display_name"),
            "media_href": None,
        })
        records.append(row)

    for item in storage_manifest.get("objects", []):
        if item.get("bucket") not in public_buckets or (item.get("bucket"), item.get("path")) not in published_media_refs:
            continue
        rel = storage_href(item["bucket"], item["path"])
        local = STORAGE / item["bucket"] / pathlib.PurePosixPath(item["path"])
        if not local.is_file() or local.stat().st_size != int(item["bytes"]):
            raise SystemExit("A public media object is missing or has an unexpected size; recovery site was not generated.")
        mime = mimetypes.guess_type(item["path"])[0] or "application/octet-stream"
        media.append({"bucket": item["bucket"], "path": item["path"], "href": rel, "bytes": item["bytes"], "mime": mime})

    for item in wordpress_objects:
        href = external_http_url(item.get("source_url"))
        if not href:
            continue
        media.append({
            "bucket": "WordPress.com media library",
            "path": item.get("local_path") or str(item.get("id", "media")),
            "href": href,
            "bytes": int(item.get("bytes", 0)),
            "mime": item.get("mime_type") or "application/octet-stream",
            "external": True,
            "title": item.get("title") or "",
            "date": item.get("date") or "",
        })

    payload = json.dumps({"records": records, "media": media, "legacy": legacy}, ensure_ascii=False, separators=(",", ":"))
    payload = payload.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    SITE.mkdir(parents=True, exist_ok=True)
    page = r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Green Dream — Recovery Archive</title>
<style>
:root{color-scheme:dark;--bg:#071016;--panel:#101e27;--panel2:#142630;--line:#24404a;--ink:#e6f1ed;--muted:#9bb1ad;--accent:#a8df75;--cyan:#72c9d0}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 50% -15%,#183d46 0,transparent 55%),var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif}
header{padding:clamp(28px,6vw,72px) max(22px,calc((100vw - 1120px)/2)) 30px;border-bottom:1px solid var(--line)}
.kicker{font:12px/1.4 ui-monospace,monospace;letter-spacing:.2em;color:var(--accent)}h1{font-size:clamp(34px,7vw,68px);line-height:1.02;letter-spacing:-.05em;margin:16px 0}header p{max-width:720px;color:var(--muted);margin:0}
main{max-width:1120px;margin:auto;padding:28px 22px 80px}.notice{border:1px solid #526b43;background:#132319;padding:14px 16px;border-radius:10px;color:#d9ebce;font-size:13px;margin-bottom:24px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0}.stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 16px;min-width:120px}.stat strong{display:block;font-size:24px;color:var(--accent)}.stat span{font-size:11px;letter-spacing:.12em;color:var(--muted);text-transform:uppercase}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0}.toolbar input,.toolbar select,.toolbar button{background:var(--panel);border:1px solid var(--line);color:var(--ink);padding:11px 14px;border-radius:8px;font:inherit}.toolbar input{flex:1;min-width:200px}.toolbar button{cursor:pointer}.toolbar button[aria-pressed=true]{border-color:var(--accent);color:var(--accent)}
.section-title{font:12px ui-monospace,monospace;letter-spacing:.18em;color:var(--cyan);margin:34px 0 14px}
.record{background:linear-gradient(145deg,var(--panel),#0b171e);border:1px solid var(--line);border-radius:12px;padding:20px;margin:12px 0}.meta{font:11px ui-monospace,monospace;letter-spacing:.12em;color:var(--accent);text-transform:uppercase}.record h2{font-size:clamp(20px,3vw,27px);line-height:1.2;margin:8px 0}.date{font-size:12px;color:var(--muted)}.excerpt{color:#c3d2cd}.record details{margin-top:14px;border-top:1px solid var(--line);padding-top:12px}.record summary{cursor:pointer;color:var(--cyan);font-size:13px}.body{padding-top:14px;overflow-wrap:anywhere}.body img{max-width:100%;height:auto}.body pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#071016;padding:12px;border-radius:8px}.body a{color:var(--cyan)}.media{margin-top:14px;max-width:100%}.media img,.media video{display:block;max-width:min(100%,720px);max-height:560px;border-radius:8px}.media audio{width:min(100%,620px)}.media a{color:var(--cyan);font-size:13px}
.legacy-record>a{display:inline-block;margin-top:12px;color:var(--cyan);font-size:13px}
#mediaGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}.file{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;min-width:0}.file img,.file video{width:100%;max-height:190px;object-fit:contain;background:#050a0d;border-radius:6px}.file audio{width:100%}.file small{display:block;color:var(--muted);overflow-wrap:anywhere;margin-top:8px}.empty{color:var(--muted);padding:30px;text-align:center;border:1px dashed var(--line);border-radius:10px}
footer{border-top:1px solid var(--line);padding:22px;text-align:center;color:var(--muted);font-size:12px}
[hidden]{display:none!important}
</style></head>
<body>
<header><div class="kicker">GREEN DREAM / OFFLINE RECOVERY</div><h1>The archive<br>remains.</h1><p>A read-only recovery website generated from a Green Dream backup snapshot. Browse published Supabase writing, approved community submissions, the live WordPress archive and media-library links without connecting to the original Supabase project.</p></header>
<main>
<div class="notice"><strong>Recovery copy, not the live site.</strong> This page contains published Supabase records, all published WordPress posts and links to the WordPress media library. WordPress post text is included here; the actual WordPress media binaries are preserved inside the encrypted backup and are linked from this public viewer rather than republished. Unreferenced Supabase Storage objects, private buckets, pending submissions and failed submissions remain only in the encrypted backup.</div>
<div class="stats" id="stats"></div>
<div class="toolbar"><button id="recordsTab" aria-pressed="true">Writing & submissions</button><button id="legacyTab" aria-pressed="false">Legacy WordPress index</button><button id="mediaTab" aria-pressed="false">Media library</button><input id="search" type="search" placeholder="Search titles, text, categories…"><select id="category"><option value="">All categories</option></select></div>
<section id="recordsView"><div class="section-title">PUBLISHED CONTENT</div><div id="records"></div></section>
<section id="legacyView" hidden><div class="section-title">WORDPRESS ARCHIVE · PUBLISHED POSTS</div><div id="legacyRecords"></div></section>
<section id="mediaView" hidden><div class="section-title">MEDIA LIBRARY · LOCAL FILES + WORDPRESS LINKS</div><div id="mediaGrid"></div></section>
</main><footer>GREEN DREAM · RECOVERY ARCHIVE · GENERATED LOCALLY FROM THE BACKUP SNAPSHOT</footer>
<script id="recovery-data" type="application/json">__PAYLOAD__</script>
<script>
(()=>{'use strict';
const data=JSON.parse(document.getElementById('recovery-data').textContent);
const $=id=>document.getElementById(id), recordsView=$('recordsView'),mediaView=$('mediaView'),legacyView=$('legacyView'),search=$('search'),category=$('category');
const records=data.records||[],media=data.media||[],legacy=data.legacy||[];
const date=v=>{if(!v)return 'Date not recorded';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString(undefined,{dateStyle:'medium'});};
const bytes=n=>{let v=Number(n)||0;for(const u of ['B','KB','MB','GB']){if(v<1024||u==='GB')return (u==='B'?v:v.toFixed(1))+' '+u;v/=1024;}return v+' B';};
$('stats').innerHTML=[['PUBLISHED RECORDS',records.length],['WORDPRESS POSTS',legacy.length],['MEDIA FILES & LINKS',media.length],['BACKUP VIEW','OFFLINE']].map(([k,v])=>'<div class="stat"><strong>'+v+'</strong><span>'+k+'</span></div>').join('');
const categories=[...new Set([...records.map(r=>r.category||r.kind),...legacy.flatMap(r=>r.categories||[])].filter(Boolean))].sort();
categories.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;category.append(o);});
function safeContent(target,source){
 const parsed=new DOMParser().parseFromString(String(source||''),'text/html');
 const allowed=new Set(['P','DIV','BR','H1','H2','H3','H4','STRONG','B','EM','I','U','UL','OL','LI','BLOCKQUOTE','PRE','CODE','HR','A']);
 function copy(node,parent){
  if(node.nodeType===Node.TEXT_NODE){parent.append(document.createTextNode(node.nodeValue));return;}
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','TEMPLATE'].includes(node.tagName))return;
  if(!allowed.has(node.tagName)){node.childNodes.forEach(child=>copy(child,parent));return;}
  const el=document.createElement(node.tagName.toLowerCase());
  if(node.tagName==='A'){const href=node.getAttribute('href')||'';if(/^https?:\/\//i.test(href)||/^mailto:/i.test(href)){el.href=href;el.rel='noopener noreferrer';el.target='_blank';}}
  node.childNodes.forEach(child=>copy(child,el));parent.append(el);
 }
 parsed.body.childNodes.forEach(node=>copy(node,target));
}
function mediaElement(record){
 if(!record.media_href)return null;
 const box=document.createElement('div');box.className='media';
 const type=(record.media_type||record.medium||'').toLowerCase(),url=record.media_href;
 if(/^https?:\/\//i.test(url)){const a=document.createElement('a');a.href=url;a.textContent='Open original media (external link; not stored offline)';a.target='_blank';a.rel='noopener noreferrer';box.append(a);return box;}
 let el;
 if(type.includes('image')||/\.(png|jpe?g|gif|webp|avif)$/i.test(url)){el=document.createElement('img');el.loading='lazy';el.alt=record.title||'Recovered media';}
 else if(type.includes('video')||/\.(mp4|webm|mov)$/i.test(url)){el=document.createElement('video');el.controls=true;el.preload='metadata';}
 else if(type.includes('music')||type.includes('audio')||/\.(mp3|wav|ogg|m4a|flac)$/i.test(url)){el=document.createElement('audio');el.controls=true;el.preload='metadata';}
 else {const a=document.createElement('a');a.href=url;a.textContent='Open backed-up media file';a.target='_blank';a.rel='noopener';box.append(a);return box;}
 el.src=url;box.append(el);return box;
}
function renderRecords(){
 const q=search.value.trim().toLowerCase(),cat=category.value;
 const filtered=records.filter(r=>(!cat||(r.category||r.kind)===cat)&&(!q||[r.title,r.excerpt,r.category,r.content_html,r.body,r.byline].join(' ').toLowerCase().includes(q)));
 $('records').replaceChildren();
 if(!filtered.length){$('records').innerHTML='<div class="empty">No matching published content.</div>';return;}
 filtered.forEach(r=>{
  const article=document.createElement('article');article.className='record';
  const meta=document.createElement('div');meta.className='meta';meta.textContent=(r.kind||'Content')+' · '+(r.category||'Uncategorised');
  const title=document.createElement('h2');title.textContent=r.title||'Untitled';
  const when=document.createElement('div');when.className='date';when.textContent=date(r.published_at);
  article.append(meta,title,when);
  if(r.excerpt){const p=document.createElement('p');p.className='excerpt';p.textContent=r.excerpt;article.append(p);}
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Read recovered content';details.append(summary);
  const body=document.createElement('div');body.className='body';safeContent(body,r.content_html||r.body||'');details.append(body);article.append(details);
  const player=mediaElement(r);if(player)article.append(player);
  $('records').append(article);
 });
}
function renderMedia(){
 const q=search.value.trim().toLowerCase(),filtered=media.filter(m=>[m.bucket,m.path,m.title,m.mime].join(' ').toLowerCase().includes(q));
 $('mediaGrid').replaceChildren();
 if(!filtered.length){$('mediaGrid').innerHTML='<div class="empty">No matching media files.</div>';return;}
 filtered.forEach(m=>{
  const card=document.createElement('article');card.className='file';const type=m.mime||'';
  const label=document.createElement('div');label.textContent=m.title||m.path;
  const small=document.createElement('small');small.textContent=m.bucket+' · '+bytes(m.bytes)+' · '+type;
  const link=document.createElement('a');link.href=m.href;link.textContent=m.external?'Open original WordPress media':'Open file';link.target='_blank';link.rel='noopener noreferrer';
  if(m.external){card.append(label,small,link);$('mediaGrid').append(card);return;}
  let el;if(type.startsWith('image/')){el=document.createElement('img');el.loading='lazy';el.alt=m.path;}
  else if(type.startsWith('video/')){el=document.createElement('video');el.controls=true;el.preload='metadata';}
  else if(type.startsWith('audio/')){el=document.createElement('audio');el.controls=true;el.preload='metadata';}
  if(el){el.src=m.href;card.append(el);}
  card.append(label,small,link);$('mediaGrid').append(card);
 });
}
function renderLegacy(){
 const q=search.value.trim().toLowerCase(),cat=category.value;
 const filtered=legacy.filter(r=>(!cat||(r.categories||[]).includes(cat))&&(!q||[r.title,r.year,r.date,...(r.categories||[])].join(' ').toLowerCase().includes(q))).sort((a,b)=>String(b.date).localeCompare(String(a.date))||Number(b.id||0)-Number(a.id||0));
 $('legacyRecords').replaceChildren();
 if(!filtered.length){$('legacyRecords').innerHTML='<div class="empty">No matching legacy records.</div>';return;}
 filtered.forEach(r=>{
  const article=document.createElement('article');article.className='record legacy-record';
  const meta=document.createElement('div');meta.className='meta';meta.textContent='LEGACY WORDPRESS · '+r.year+' · '+(r.categories||[]).join(' / ');
  const title=document.createElement('h2');title.textContent=r.title;
  const when=document.createElement('div');when.className='date';when.textContent=date(r.date);
  const link=document.createElement('a');link.href=r.url;link.textContent='Open original WordPress record';link.target='_blank';link.rel='noopener noreferrer';
  article.append(meta,title,when);
  if(r.content_html){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Read archived text';details.append(summary);const body=document.createElement('div');body.className='body';safeContent(body,r.content_html);details.append(body);article.append(details);}
  article.append(link);$('legacyRecords').append(article);
 });
}
function showTab(active){
 recordsView.hidden=active!=='records';legacyView.hidden=active!=='legacy';mediaView.hidden=active!=='media';
 $('recordsTab').setAttribute('aria-pressed',String(active==='records'));
 $('legacyTab').setAttribute('aria-pressed',String(active==='legacy'));
 $('mediaTab').setAttribute('aria-pressed',String(active==='media'));
}
$('recordsTab').addEventListener('click',()=>showTab('records'));
$('legacyTab').addEventListener('click',()=>showTab('legacy'));
$('mediaTab').addEventListener('click',()=>showTab('media'));
search.addEventListener('input',()=>{renderRecords();renderLegacy();renderMedia();});
category.addEventListener('change',()=>{renderRecords();renderLegacy();});
renderRecords();renderLegacy();renderMedia();
})();
</script></body></html>'''
    (SITE / "index.html").write_text(page.replace("__PAYLOAD__", payload), encoding="utf-8")
    readme = """GREEN DREAM RECOVERY WEBSITE

Open index.html in a modern browser. It works offline and does not connect to
Supabase, Google Drive, or any external service. Keep the sibling storage/
directory in place: media players use the original backed-up object files
through relative paths.

This is a read-only catalogue of published Supabase posts and approved
submissions, all published WordPress post text, public Supabase media, and
links to the WordPress media library. The encrypted backup also contains the
WordPress media binaries; this public viewer links to the original files
rather than republishing them. Private buckets, unreferenced Supabase media,
and unpublished/failed submissions are deliberately excluded from this viewer.

This viewer is not a replacement for the original interactive application.
The Git bundle in repository/landing-page.bundle preserves the website source
and history. See CONTENT-BACKUP-README.txt and docs/backup/README.md for scope
and full restoration limitations.
"""
    (SITE / "README.txt").write_text(readme, encoding="utf-8")
    print(f"Recovery website generated: {len(records)} published Supabase records, {len(legacy)} published WordPress posts, {len(media)} media files and links.")

if __name__ == "__main__":
    main()
