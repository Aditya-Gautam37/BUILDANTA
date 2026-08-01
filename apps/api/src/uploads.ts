import {
  MAX_UPLOAD_BYTES,
  UploadRejected,
  attachProductImage,
} from "@buildanta/api";
import { TRPCError } from "@trpc/server";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { createFastifyContext } from "./context.js";

/**
 * Product-image upload.
 *
 * A multipart POST rather than a tRPC procedure: the body has to be streamed and
 * size-capped by the HTTP layer, and base64-ing a few megabytes through a JSON
 * envelope to keep it inside tRPC would be strictly worse. The database and storage
 * work still lives in `@buildanta/api`, so this route holds no business logic.
 */

const fieldsSchema = z.object({
  productId: z.string().uuid("productId must be a UUID."),
  variantId: z.string().uuid().optional(),
  altText: z.string().max(300).optional(),
});

export function registerUploadRoutes(app: FastifyInstance): void {
  app.post("/admin/uploads/product-image", async (req, reply) => {
    // Authenticated with the same session cookie and the same context builder as
    // every tRPC procedure — this route must not become a second, weaker door.
    const ctx = await createFastifyContext({ req, res: reply });
    if (!ctx.admin) {
      return reply
        .code(401)
        .send({ error: "You must be signed in to do that." });
    }

    if (!req.isMultipart()) {
      return reply
        .code(415)
        .send({ error: "Send the image as multipart/form-data." });
    }

    let buffer: Buffer | undefined;
    let mimeType: string | undefined;
    const fields: Record<string, string> = {};

    try {
      // Parts are iterated rather than read with `req.file()` so the field order in
      // the request does not matter.
      for await (const part of req.parts()) {
        if (part.type === "file") {
          if (part.fieldname !== "file" || buffer) {
            // Unexpected or duplicate file parts still have to be drained, or the
            // request stalls waiting for the body to be consumed.
            await part.toBuffer();
            continue;
          }
          buffer = await part.toBuffer();
          mimeType = part.mimetype;
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }
    } catch (error) {
      if (isFileTooLarge(error)) {
        return reply.code(413).send({
          error: `Images must be under ${Math.floor(
            MAX_UPLOAD_BYTES / 1024 / 1024,
          )} MB.`,
        });
      }
      throw error;
    }

    if (!buffer || !mimeType) {
      return reply
        .code(400)
        .send({ error: 'Attach the image in a field named "file".' });
    }

    const parsedFields = fieldsSchema.safeParse(fields);
    if (!parsedFields.success) {
      return reply.code(400).send({
        error:
          parsedFields.error.issues[0]?.message ?? "Invalid upload fields.",
      });
    }

    try {
      const image = await attachProductImage({
        productId: parsedFields.data.productId,
        variantId: parsedFields.data.variantId ?? null,
        altText: parsedFields.data.altText ?? null,
        buffer,
        mimeType,
      });
      return reply.code(201).send(image);
    } catch (error) {
      return handleUploadError(error, reply);
    }
  });
}

function handleUploadError(error: unknown, reply: FastifyReply) {
  // A rejected upload is a normal outcome of someone picking the wrong file, so it
  // gets a 400 and the real reason, not a 500.
  if (error instanceof UploadRejected) {
    return reply.code(400).send({ error: error.message });
  }
  if (error instanceof TRPCError) {
    const status = error.code === "NOT_FOUND" ? 404 : 400;
    return reply.code(status).send({ error: error.message });
  }
  throw error;
}

function isFileTooLarge(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE"
  );
}
