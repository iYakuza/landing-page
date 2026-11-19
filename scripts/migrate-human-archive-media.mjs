import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const manifestPath = 'human-archive/media-manifest.json';
const reportPath = 'human-archive/media-import-report.json';
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const targetUrl = (process.env.TARGET_SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY || '';
if (!targetUrl || !serviceKey) throw new Error('Missing TARGET_SUPABASE_URL or TARGET_SUPABASE_SERVICE_ROLE_KEY');
const targetProjectRef = new URL(targetUrl).hostname.split('.')[0];
if (!Array.isArray(manifest.items) || manifest.items.length !== manifest.item_count) throw new Error('Manifest item count does not match its items array');

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const bucket = manifest.bucket || 'human-archive-media';
async function api(path, options = {}) {
  return fetch(`${targetUrl}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
}

// Create the destination bucket if needed, then ensure it is public for the website's media URLs.
let bucketResponse = await api('/storage/v1/bucket', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: bucket, name: bucket, public: true })
});
if (!bucketResponse.ok && bucketResponse.status !== 409) {
  throw new Error(`Could not create destination bucket (${bucketResponse.status}): ${await bucketResponse.text()}`);
}
bucketResponse = await api(`/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ public: true })
});
if (!bucketResponse.ok) throw new Error(`Could not configure destination bucket (${bucketResponse.status}): ${await bucketResponse.text()}`);

const baseUrl = `${targetUrl}/storage/v1/object/public/${bucket}/`;
const successes = [];
const failures = [];
for (const [index, item] of manifest.items.entries()) {
  const path = String(item.storage_path || '').replace(/^\/+/, '');
  try {
    if (!path || path.split('/').includes('..')) throw new Error('Invalid storage_path');
    if (!item.source_url || !/^https:\/\//i.test(item.source_url)) throw new Error('Missing or invalid source_url');
    const sourceResponse = await fetch(item.source_url, { redirect: 'follow' });
    if (!sourceResponse.ok) throw new Error(`Source returned HTTP ${sourceResponse.status}`);
    const bytes = Buffer.from(await sourceResponse.arrayBuffer());
    const sourceHash = crypto.createHash('sha256').update(bytes).digest('hex');
    const contentType = item.mime_type || sourceResponse.headers.get('content-type') || 'application/octet-stream';
    const objectPath = path.split('/').map(encodeURIComponent).join('/');
    const uploadResponse = await api(`/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType, 'x-upsert': 'true', 'Cache-Control': 'public, max-age=31536000, immutable' },
      body: bytes
    });
    if (!uploadResponse.ok) throw new Error(`Upload returned HTTP ${uploadResponse.status}: ${await uploadResponse.text()}`);
    const publicUrl = baseUrl + objectPath;
    const verifyResponse = await fetch(publicUrl, { cache: 'no-store' });
    if (!verifyResponse.ok) throw new Error(`Public verification returned HTTP ${verifyResponse.status}`);
    const verifiedBytes = Buffer.from(await verifyResponse.arrayBuffer());
    const verifiedHash = crypto.createHash('sha256').update(verifiedBytes).digest('hex');
    if (verifiedHash !== sourceHash) throw new Error('SHA-256 mismatch after upload');
    successes.push({ id: item.id, storage_path: path, bytes: bytes.length, sha256: sourceHash, public_url: publicUrl, verified: true, source_url: item.source_url });
    console.log(`[${index + 1}/${manifest.items.length}] VERIFIED ${path}`);
  } catch (error) {
    failures.push({ id: item.id || null, storage_path: path, error: String(error?.message || error) });
    console.error(`[${index + 1}/${manifest.items.length}] FAILED ${path}: ${String(error?.message || error)}`);
  }
}
manifest.public_base_url = baseUrl;
manifest.target_project_ref = targetProjectRef;
manifest.migrated_at = new Date().toISOString();
const totalBytes = successes.reduce((sum, item) => sum + item.bytes, 0);
const report = {
  schema_version: 2,
  generated_at: new Date().toISOString(),
  target_project_ref: targetProjectRef,
  bucket,
  status: failures.length === 0 && successes.length === manifest.items.length ? 'complete' : 'partial',
  asset_count: manifest.items.length,
  successful_count: successes.length,
  failed_count: failures.length,
  total_bytes_verified: totalBytes,
  total_mib_verified: Number((totalBytes / 1024 / 1024).toFixed(2)),
  successes,
  failures
};
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Migration finished: ${successes.length}/${manifest.items.length} verified; ${failures.length} failed.`);
if (failures.length) process.exitCode = 1;
