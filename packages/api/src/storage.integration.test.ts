import { beforeAll, describe, expect, it } from "vitest";

import sharp from "sharp";

import {
  MAX_UPLOAD_BYTES,
  UploadRejected,
  ensureBucketExists,
  publicUrl,
  remove,
  save,
} from "./storage.js";

/**
 * Real Supabase Storage, not a mock — the whole point of this file is to prove
 * the credentials, bucket policy and upload validation actually behave as
 * `storage.ts` claims when talking to the live service. It only ever creates
 * and deletes files it uploaded itself in this run; nothing pre-existing in the
 * bucket is read, moved or removed.
 *
 * Run with `pnpm test:integration`, never `pnpm test` — see
 * vitest.integration.config.ts.
 */

/** A real, decodable image, generated rather than committed as a fixture. */
async function testPng(width = 60, height = 40): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

describe("Supabase Storage", () => {
  beforeAll(async () => {
    await ensureBucketExists();
  }, 30_000);

  it("uploads, serves publicly, and deletes an image", async () => {
    const stored = await save(await testPng(), "image/png");

    expect(stored.storageKey).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);
    expect(stored.width).toBe(60);
    expect(stored.height).toBe(40);
    expect(stored.byteSize).toBeGreaterThan(0);

    // Publicly readable with no credentials at all — the bucket is public by
    // design (product photos), so a bare fetch must succeed and must come back
    // as the webp `save` re-encoded it to.
    const response = await fetch(stored.url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");

    const downloaded = Buffer.from(await response.arrayBuffer());
    expect(downloaded.byteLength).toBe(stored.byteSize);
    // Proves it is genuinely a webp image and not an error page served with a
    // 200: "RIFF" then "WEBP" at offset 8 is the container's magic number.
    expect(downloaded.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(downloaded.subarray(8, 12).toString("ascii")).toBe("WEBP");

    await remove(stored.storageKey);

    // Cache-busted deliberately. Fetching `stored.url` unchanged still returns
    // 200 straight after a successful delete, because these objects are served
    // through Supabase's CDN with the 30-day `cacheControl` that `save` sets,
    // and deleting the object does not purge the edge cache. A unique query
    // string is a different cache key, so this reaches the origin and sees the
    // real post-delete state. Verified out of band: the object is genuinely
    // gone from the bucket listing, not merely hidden.
    //
    // Worth knowing operationally: an image that must come down for legal or
    // privacy reasons is still publicly served from cache after deletion until
    // that TTL expires. See docs/deployment.md.
    const afterDelete = await fetch(
      `${stored.url}?cachebust=${crypto.randomUUID()}`,
    );
    expect(afterDelete.ok).toBe(false);
  }, 60_000);

  it("re-encodes a JPEG to WebP and strips its EXIF", async () => {
    const jpeg = await sharp({
      create: {
        width: 100,
        height: 50,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .withExifMerge({ IFD0: { Software: "buildanta-test" } })
      .jpeg()
      .toBuffer();

    // Asserted rather than assumed: if sharp ever stopped writing an EXIF block
    // here, the stripping assertion below would pass for the wrong reason.
    //
    // This deliberately does not test EXIF *orientation* handling. `save` calls
    // `.rotate()`, which auto-orients from the orientation tag, but a tag
    // written via `withExifMerge` is not one sharp reads back as an orientation
    // (measured: it still reports orientation 1 and leaves dimensions alone),
    // so a test built on it would assert a rotation that never happened.
    // Orientation stripping is covered by the EXIF check; proving the rotation
    // itself needs a real camera JPEG as a committed fixture.
    const source = await sharp(jpeg).metadata();
    expect(source.exif).toBeDefined();

    const stored = await save(jpeg, "image/jpeg");
    try {
      expect(stored.width).toBe(100);
      expect(stored.height).toBe(50);

      const downloaded = Buffer.from(
        await (await fetch(stored.url)).arrayBuffer(),
      );
      const metadata = await sharp(downloaded).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.exif).toBeUndefined();
    } finally {
      await remove(stored.storageKey);
    }
  }, 60_000);

  it("caps oversized images at the maximum dimension", async () => {
    const stored = await save(await testPng(3000, 1500), "image/png");
    try {
      expect(stored.width).toBe(2400);
      expect(stored.height).toBe(1200);
    } finally {
      await remove(stored.storageKey);
    }
  }, 60_000);

  it("rejects a disallowed content type without uploading anything", async () => {
    await expect(save(await testPng(), "image/gif")).rejects.toThrow(
      UploadRejected,
    );
    await expect(save(await testPng(), "application/pdf")).rejects.toThrow(
      UploadRejected,
    );
  });

  it("rejects a file that is not a readable image even with an image mime type", async () => {
    // The declared content type says PNG; the bytes are not an image. Only
    // actually decoding the buffer catches this, which is why `save` re-encodes
    // rather than trusting the header.
    const notAnImage = Buffer.from(
      "<?php system($_GET['c']); ?>".repeat(20),
      "utf8",
    );
    await expect(save(notAnImage, "image/png")).rejects.toThrow(UploadRejected);
  });

  it("rejects a file over the size limit", async () => {
    const tooBig = Buffer.alloc(MAX_UPLOAD_BYTES + 1);
    await expect(save(tooBig, "image/png")).rejects.toThrow(UploadRejected);
  });

  it("deleting an already-missing key is not an error", async () => {
    // The database row is the source of truth; an admin must always be able to
    // remove an image row whose file is already gone.
    await expect(
      remove("2000/01/00000000-0000-0000-0000-000000000000.webp"),
    ).resolves.toBeUndefined();
  }, 30_000);

  it("a key that was never uploaded is not publicly readable", async () => {
    const url = publicUrl("2000/01/11111111-1111-1111-1111-111111111111.webp");
    const response = await fetch(url);
    // `ok`, not a specific code: a public bucket answers a missing object with
    // 400, not the 404 you would expect. The claim that matters here is that
    // nothing is served, and that holds regardless of which client-error code
    // Supabase picks.
    expect(response.ok).toBe(false);
    expect(response.status).toBeGreaterThanOrEqual(400);
  }, 30_000);
});
