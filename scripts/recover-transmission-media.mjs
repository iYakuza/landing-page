import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const base = 'https://ioguymqdeuuursizifnn.supabase.co/storage/v1/object/public/vha-post-media/';
const downloads = [
  {
    recordId: 'T-0002',
    sourcePath: '3db54039-9208-4ec6-a741-94638e2ace16/e272294b-ab58-46ee-8100-2caee8462339-sunt-o-culoare.jpeg',
    targetPath: 'media/transmissions/T-0002/featured.jpeg',
    expectedBytes: 252345,
    signature: 'jpeg'
  },
  {
    recordId: 'T-0003',
    sourcePath: '3db54039-9208-4ec6-a741-94638e2ace16/8dfa5e0c-9dc1-4774-a729-73578f26637a-before-the-name.mp4',
    targetPath: 'media/transmissions/T-0003/video.mp4',
    expectedBytes: 12659800,
    signature: 'mp4'
  },
  {
    recordId: 'T-0004',
    sourcePath: '3db54039-9208-4ec6-a741-94638e2ace16/e1f88e59-3d16-435b-8ded-b0b99979b4da-lud-1-.jpeg',
    targetPath: 'media/transmissions/T-0004/featured.jpeg',
    expectedBytes: 171526,
    signature: 'jpeg'
  }
];

const recordsPath = 'content/transmissions.json';
const recordsDoc = JSON.parse(await fs.readFile(recordsPath, 'utf8'));
const results = [];

for (const item of downloads) {
  const url = base + item.sourcePath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Download failed for ${item.recordId}: HTTP ${response.status} from restore storage`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== item.expectedBytes) {
    throw new Error(`Size mismatch for ${item.recordId}: expected ${item.expectedBytes}, received ${bytes.length}`);
  }
  if (item.signature === 'jpeg' && !(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
    throw new Error(`JPEG signature check failed for ${item.recordId}`);
  }
  if (item.signature === 'mp4' && bytes.toString('ascii', 4, 8) !== 'ftyp') {
    throw new Error(`MP4 signature check failed for ${item.recordId}`);
  }

  await fs.mkdir(path.dirname(item.targetPath), { recursive: true });
  await fs.writeFile(item.targetPath, bytes);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const record = recordsDoc.records.find(r => r.id === item.recordId);
  if (!record) throw new Error(`Record not found in ${recordsPath}: ${item.recordId}`);
  const media = record.media_items.find(m => m.source_url?.endsWith(item.sourcePath.split('/').pop()));
  if (!media) throw new Error(`Media reference not found for ${item.recordId}`);
  media.status = 'recovered';
  media.bytes = bytes.length;
  media.sha256 = sha256;
  media.recovered_from = 'green-dream-restore-2';
  results.push({
    record_id: item.recordId,
    source_url: url,
    repository_path: item.targetPath,
    bytes: bytes.length,
    sha256,
    verified: true
  });
  console.log(`Verified ${item.recordId}: ${item.targetPath} (${bytes.length} bytes)`);
}

await fs.writeFile(recordsPath, JSON.stringify(recordsDoc, null, 2) + '\n');
const pending = recordsDoc.records.flatMap(r => (r.media_items || []).filter(m => m.status !== 'recovered' && m.status !== 'available').map(m => ({
  record_id: r.id,
  title: r.title,
  name: m.name,
  source_url: m.source_url,
  status: m.status
})));
const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  status: pending.length === 0 ? 'complete' : 'partial',
  recovered_count: results.length,
  pending_count: pending.length,
  recovered: results,
  pending
};
await fs.mkdir('recovery-data', { recursive: true });
await fs.writeFile('recovery-data/transmission-media-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Recovered ${results.length} Transmission assets; ${pending.length} remain pending.`);
