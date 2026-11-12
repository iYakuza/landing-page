import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const root = Deno.args[0];
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (!root || !supabaseUrl || !serviceKey) {
  throw new Error("Usage: restore_storage.ts <backup-root> with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set.");
}
const client = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const readJson = async (path: string) => JSON.parse(await Deno.readTextFile(root + "/" + path));
const buckets = await readJson("storage/buckets.json");
const dbObjects = await readJson("storage/objects-metadata.json");
const manifest = await readJson("storage/objects/storage-manifest.json");
const metadataByPath = new Map(
  dbObjects.map((item: any) => [item.bucket_id + "/" + item.name, item]),
);

const listed = await client.storage.listBuckets();
if (listed.error) throw new Error("Could not list target Storage buckets: " + listed.error.message);
const existingIds = new Set((listed.data || []).map((bucket: any) => bucket.id));

for (const bucket of buckets) {
  const options = {
    public: bucket.public === true,
    fileSizeLimit: bucket.file_size_limit ?? undefined,
    allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
  };
  const result = existingIds.has(bucket.id)
    ? await client.storage.updateBucket(bucket.id, options)
    : await client.storage.createBucket(bucket.id, options);
  if (result.error) throw new Error("Could not prepare Storage bucket " + bucket.id + ": " + result.error.message);
  const checkedBucket = await client.storage.getBucket(bucket.id);
  if (checkedBucket.error || !checkedBucket.data) throw new Error("Could not verify Storage bucket " + bucket.id);
  const actualBucket = checkedBucket.data as any;
  const expectedMimeTypes = JSON.stringify([...(bucket.allowed_mime_types || [])].sort());
  const actualMimeTypes = JSON.stringify([...(actualBucket.allowed_mime_types || [])].sort());
  if (actualBucket.public !== options.public || Number(actualBucket.file_size_limit) !== Number(options.fileSizeLimit) || actualMimeTypes !== expectedMimeTypes) {
    throw new Error("Restored Storage bucket configuration mismatch: " + bucket.id);
  }
  console.log("Prepared and verified Storage bucket: " + bucket.id);
}

let restored = 0;
for (const item of manifest.objects) {
  const bucket = item.bucket;
  const objectPath = item.path;
  if (typeof objectPath !== "string" || objectPath.startsWith("/") ||
      objectPath.split("/").some((part: string) => part === ".." || part === "")) {
    throw new Error("Unsafe object path in backup manifest.");
  }
  const localPath = root + "/storage/objects/" + bucket + "/" + objectPath;
  const bytes = await Deno.readFile(localPath);
  const expectedHash = item.sha256;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const actualHash = Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
  if (actualHash !== expectedHash || bytes.byteLength !== item.bytes) {
    throw new Error("Backup file failed checksum verification: " + bucket + "/" + objectPath);
  }

  const sourceMetadata = metadataByPath.get(bucket + "/" + objectPath) as any;
  if (!sourceMetadata) throw new Error("Missing database metadata for " + bucket + "/" + objectPath);
  const metadata = sourceMetadata.metadata || {};
  const userMetadata = sourceMetadata.user_metadata || {};
  const contentType = metadata.mimetype || "application/octet-stream";
  const upload = await client.storage.from(bucket).upload(objectPath, new Blob([bytes], { type: contentType }), {
    contentType,
    cacheControl: String(metadata.cacheControl || "3600"),
    upsert: true,
    metadata: userMetadata,
  });
  if (upload.error) throw new Error("Storage restore failed for " + bucket + "/" + objectPath + ": " + upload.error.message);

  const downloaded = await client.storage.from(bucket).download(objectPath);
  if (downloaded.error || !downloaded.data) {
    throw new Error("Storage verification download failed for " + bucket + "/" + objectPath);
  }
  const restoredBytes = new Uint8Array(await downloaded.data.arrayBuffer());
  const restoredDigest = new Uint8Array(await crypto.subtle.digest("SHA-256", restoredBytes));
  const restoredHash = Array.from(restoredDigest, (value) => value.toString(16).padStart(2, "0")).join("");
  if (restoredHash !== expectedHash || restoredBytes.byteLength !== item.bytes) {
    throw new Error("Restored Storage object failed checksum verification: " + bucket + "/" + objectPath);
  }
  restored++;
  console.log("Restored and verified: " + bucket + "/" + objectPath);
}
if (restored !== manifest.object_count) {
  throw new Error("Storage restore count mismatch.");
}
console.log("Storage restore verified: " + restored + " objects.");
