import { prisma } from "@buildanta/db";
import { TRPCError } from "@trpc/server";

import { imageSelect, serializeImage } from "./serializers.js";
import type { ImageDto } from "./serializers.js";
import * as storage from "./storage.js";

/**
 * Image upload service.
 *
 * File upload does not go through tRPC: a multipart body has to be streamed and
 * size-limited by the HTTP layer, which is a transport concern. `apps/api` parses
 * the request and calls this; the storage and database work stays here so the two
 * cannot drift.
 */

export interface AttachImageArgs {
  productId: string;
  variantId?: string | null;
  altText?: string | null;
  buffer: Buffer;
  mimeType: string;
}

export async function attachProductImage({
  productId,
  variantId,
  altText,
  buffer,
  mimeType,
}: AttachImageArgs): Promise<ImageDto> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "That product does not exist.",
    });
  }

  // Checked before writing the file: a variant belonging to another product would
  // otherwise leave an orphaned upload in storage.
  if (variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { productId: true },
    });
    if (!variant || variant.productId !== productId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That variant does not belong to this product.",
      });
    }
  }

  // Deliberately outside any transaction: encoding is slow, and the upload itself
  // is a network round trip to Supabase Storage — holding a database transaction
  // open for either would tie up a Postgres connection for no reason.
  const stored = await storage.save(buffer, mimeType);

  try {
    // The image count and the insert that depends on it must be serialised against
    // any other upload for the same product. A transaction alone is not enough:
    // under Postgres's default READ COMMITTED isolation, two concurrent
    // transactions can each run `count()` before either commits its `create()`,
    // so both still see "0 images so far" and both insert as primary at
    // sortOrder 0 — nothing in the schema stops that. `FOR UPDATE` takes a row
    // lock on the product itself, so a second upload for the *same* product
    // blocks until the first transaction commits; uploads for different products
    // remain fully concurrent.
    const image = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;

      const existingCount = await tx.productImage.count({
        where: { productId },
      });

      return tx.productImage.create({
        data: {
          productId,
          variantId: variantId ?? null,
          altText: altText ?? null,
          url: stored.url,
          storageKey: stored.storageKey,
          width: stored.width,
          height: stored.height,
          byteSize: stored.byteSize,
          // The first image uploaded becomes the primary one, so a product is
          // never left with images but no thumbnail.
          isPrimary: existingCount === 0,
          sortOrder: existingCount,
        },
        select: imageSelect,
      });
    });

    return serializeImage(image);
  } catch (error) {
    // The row is the source of truth. If the insert fails, the file it points at
    // must not survive as an untracked orphan.
    await storage.remove(stored.storageKey);
    throw error;
  }
}

/**
 * Deletes stored files for keys whose rows are already gone.
 *
 * Called after a cascading delete (a product taking its images with it). Failures
 * are swallowed on purpose: the database no longer references these files, so a
 * leftover file is wasted disk, whereas throwing would surface a delete that
 * actually succeeded as an error.
 */
export async function removeOrphanedFiles(
  storageKeys: string[],
): Promise<void> {
  await Promise.allSettled(storageKeys.map((key) => storage.remove(key)));
}
