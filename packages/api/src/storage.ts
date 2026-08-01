import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { env } from "./env.js";

/**
 * Product-image storage — Supabase Storage.
 *
 * Everything storage-specific is confined to this file. It replaced local-disk
 * storage (Release 1's original implementation): the only things that changed
 * are inside `save`, `remove` and `ensureBucketExists` — no caller, no database
 * column, no route needed to change, because `storageKey` was always an opaque
 * string handed back by this module, never a filesystem path a caller
 * constructed itself.
 */

/** Formats accepted for upload. Anything else is rejected before it is written. */
const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Product photography beyond this is wasted bytes on every page load. */
const MAX_DIMENSION = 2400;

/** Seconds, matching the local-static route's previous 30-day cache header. */
const CACHE_CONTROL_SECONDS = 60 * 60 * 24 * 30;

export interface StoredImage {
  storageKey: string;
  url: string;
  width: number;
  height: number;
  byteSize: number;
}

export class UploadRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadRejected";
  }
}

/**
 * One admin client per process, matching the Prisma singleton pattern in
 * packages/db — created lazily so importing this module never requires the
 * environment to already be valid, only calling into it does.
 */
let client: ReturnType<typeof createClient> | undefined;

function storageClient() {
  client ??= createClient(env().SUPABASE_URL, env().SUPABASE_SERVICE_ROLE_KEY, {
    // Nothing in this process ever needs a user session; every request here
    // authenticates as the service role itself.
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

/**
 * Creates the product-image bucket if it doesn't exist yet. Idempotent — safe
 * to call on every server start. Called once from apps/api/src/server.ts before
 * the server accepts requests, so the first real upload is never racing bucket
 * creation.
 *
 * Public, deliberately: product photos are meant to be publicly readable — the
 * same as they were served over plain HTTP with no auth under local-disk
 * storage. Nothing sensitive ever goes through this path.
 */
export async function ensureBucketExists(): Promise<void> {
  const bucket = env().SUPABASE_STORAGE_BUCKET;
  const supabase = storageClient();

  const { data: existing, error: getError } =
    await supabase.storage.getBucket(bucket);

  // Supabase's JS client reports a missing bucket as an `error`, not as
  // `data: null` with no error — so a real, unexpected error (bad credentials,
  // network) must not be swallowed as "must be missing, let's create it."
  if (getError && !/not found/i.test(getError.message)) {
    throw new Error(`Could not check storage bucket "${bucket}": ${getError.message}`);
  }

  if (existing) return;

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: MAX_UPLOAD_BYTES,
    allowedMimeTypes: ["image/webp"], // Everything is re-encoded to webp before upload.
  });

  // A second process racing to create the same bucket on startup is expected in
  // any multi-instance deployment, not a real failure.
  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Could not create storage bucket "${bucket}": ${createError.message}`);
  }
}

/**
 * Validates, normalises and stores an uploaded image.
 *
 * The buffer is decoded and re-encoded with sharp rather than uploaded as-is.
 * That does three things a Content-Type check cannot: it proves the bytes
 * really are an image, it drops EXIF (which routinely carries GPS coordinates
 * from a site photo), and it caps the dimensions.
 */
export async function save(
  buffer: Buffer,
  declaredMimeType: string,
): Promise<StoredImage> {
  if (!ACCEPTED_MIME_TYPES.has(declaredMimeType)) {
    throw new UploadRejected("Upload a JPEG, PNG, WebP or AVIF image.");
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new UploadRejected(
      `Images must be under ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
    );
  }

  let pipeline: sharp.Sharp;
  let metadata: sharp.Metadata;
  try {
    // `failOn: "error"` makes a truncated or crafted file throw here rather than
    // producing a partial image.
    pipeline = sharp(buffer, { failOn: "error" });
    metadata = await pipeline.metadata();
  } catch {
    throw new UploadRejected("That file is not a readable image.");
  }

  if (!metadata.width || !metadata.height) {
    throw new UploadRejected("That file is not a readable image.");
  }

  const normalized = await pipeline
    .rotate() // Applies EXIF orientation before the tag is discarded.
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  // Sharded by date so the bucket does not accumulate every image ever uploaded
  // into one flat namespace — this was true for local-disk directory listings
  // and remains a reasonable habit for an object store's own browsing UI.
  const now = new Date();
  const shard = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const storageKey = `${shard}/${randomUUID()}.webp`;

  const supabase = storageClient();
  const { error } = await supabase.storage
    .from(env().SUPABASE_STORAGE_BUCKET)
    .upload(storageKey, normalized.data, {
      contentType: "image/webp",
      cacheControl: String(CACHE_CONTROL_SECONDS),
      // The key always includes a fresh UUID, so a collision means something is
      // actually wrong — failing loudly is correct, not overwriting silently.
      upsert: false,
    });

  if (error) {
    throw new Error(`Could not upload image: ${error.message}`);
  }

  return {
    storageKey,
    url: publicUrl(storageKey),
    width: normalized.info.width,
    height: normalized.info.height,
    byteSize: normalized.data.byteLength,
  };
}

/**
 * Deletes a stored file. A missing file is not an error: the database row is
 * the source of truth, and failing here would leave an admin unable to remove
 * an image whose file was already cleaned up.
 *
 * **This does not make the image's public URL stop working.** Measured against
 * real Supabase Storage: the object goes from the bucket immediately, but the
 * public URL keeps returning 200 with the old bytes from Supabase's CDN until
 * the `cacheControl` set in `save()` (30 days) expires. Anyone already holding
 * the URL can still fetch the image for that long.
 *
 * That is fine for swapping a product photo. It is *not* sufficient for a
 * takedown — a wrong product, a supplier's copyrighted photo, anything with a
 * legal deadline. Such a case needs an explicit CDN purge or a much shorter
 * TTL; see docs/deployment.md and the assertion in
 * storage.integration.test.ts, which cache-busts precisely because the plain
 * URL still succeeds here.
 */
export async function remove(storageKey: string): Promise<void> {
  const supabase = storageClient();
  const { error } = await supabase.storage
    .from(env().SUPABASE_STORAGE_BUCKET)
    .remove([storageKey]);

  // Supabase's remove() does not itself error on an already-missing key; this
  // only guards against a genuine failure (bad credentials, network) being
  // swallowed the same way a missing file is.
  if (error) {
    throw new Error(`Could not delete image "${storageKey}": ${error.message}`);
  }
}

export function publicUrl(storageKey: string): string {
  const supabase = storageClient();
  const { data } = supabase.storage
    .from(env().SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(storageKey);
  return data.publicUrl;
}
