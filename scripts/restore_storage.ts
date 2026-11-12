import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const root = Deno.args[0];
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const apiKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (!root || !supabaseUrl || !apiKey) {
  throw new Error("Usage: restore_storage.ts <backup-root> with SUPABASE_URL and SUPABASE_SECRET_KEY set.");
}
const client = createClient(supabaseUrl, apiKey, {
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
  if (typeof bucket !== "string" || bucket.includes("/") || bucket === "." || bucket === ".." || !buckets.some((entry: any) => entry.id === bucket)) {
    throw new Error("Unknown or unsafe Storage bucket in backup manifest.");
  }
  if (typeof objectPath !== "string" || objectPath.startsWith("/") ||
      objectPath.split("/").some((part: string) => part === ".." || part === "")) {
    throw new Error("Unsafe Storage object path in backup manifest; path suppressed.");
  }
  const localPath = root + "/storage/objects/" + bucket + "/" + objectPath;
  let rawBytes: Uint8Array;
  try {
    rawBytes = await Deno.readFile(localPath);
  } catch {
    throw new Error("Backup Storage object file could not be read; object path suppressed.");
  }
  const safeBuffer = new ArrayBuffer(rawBytes.byteLength);
  new Uint8Array(safeBuffer).set(rawBytes);
  const bytes = new Uint8Array(safeBuffer);
  const expectedHash = item.sha256;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const actualHash = Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
  if (actualHash !== expectedHash || bytes.byteLength !== item.bytes) {
    throw new Error("Backup Storage object failed checksum verification in bucket " + bucket + "; object path suppressed.");
  }

  const sourceMetadata = metadataByPath.get(bucket + "/" + objectPath) as any;
  if (!sourceMetadata) throw new Error("Missing Storage metadata in bucket " + bucket + "; object path suppressed.");
  const metadata = sourceMetadata.metadata || {};
  const userMetadata = sourceMetadata.user_metadata || {};
  const contentType = metadata.mimetype || "application/octet-stream";
  const upload = await client.storage.from(bucket).upload(objectPath, new Blob([bytes], { type: contentType }), {
    contentType,
    cacheControl: String(metadata.cacheControl || "3600"),
    upsert: true,
    metadata: userMetadata,
  });
  if (upload.error) throw new Error("Storage restore failed in bucket " + bucket + "; object path and server details suppressed.");

  const downloaded = await client.storage.from(bucket).download(objectPath);
  if (downloaded.error || !downloaded.data) {
    throw new Error("Storage verification download failed in bucket " + bucket + "; object path suppressed.");
  }
  const restoredBytes = new Uint8Array(await downloaded.data.arrayBuffer());
  const restoredDigest = new Uint8Array(await crypto.subtle.digest("SHA-256", restoredBytes));
  const restoredHash = Array.from(restoredDigest, (value) => value.toString(16).padStart(2, "0")).join("");
  if (restoredHash !== expectedHash || restoredBytes.byteLength !== item.bytes) {
    throw new Error("Restored Storage object failed checksum verification in bucket " + bucket + "; object path suppressed.");
  }
  restored++;
  console.log("Restored and verified one object in bucket: " + bucket);
}
if (restored !== manifest.object_count) {
  throw new Error("Storage restore count mismatch.");
}
console.log("Storage restore verified: " + restored + " objects.");
