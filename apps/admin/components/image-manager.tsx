"use client";

import type { ImageDto } from "@buildanta/api/client";
import Image from "next/image";
import { useRef, useState } from "react";

import { Alert, Button, Card, ConfirmButton, Input } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { uploadProductImage } from "@/lib/upload";

/**
 * Product images.
 *
 * Upload goes through the API's multipart route, not tRPC (see lib/upload.ts). The
 * server re-encodes every upload, which strips EXIF — worth knowing here because it
 * means a site photo's GPS coordinates never reach the public files.
 */
export function ImageManager({
  productId,
  images,
}: {
  productId: string;
  images: ImageDto[];
}) {
  const utils = trpc.useUtils();
  const fileInput = useRef<HTMLInputElement>(null);

  const [altText, setAltText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function refresh() {
    // Invalidates the product too: image count decides whether it can be published.
    await utils.admin.products.invalidate();
    await utils.admin.images.invalidate();
  }

  const setPrimary = trpc.admin.images.setPrimary.useMutation({
    onSuccess: refresh,
  });
  const remove = trpc.admin.images.delete.useMutation({ onSuccess: refresh });
  const reorder = trpc.admin.images.reorder.useMutation({ onSuccess: refresh });

  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError(null);

    try {
      // Uploaded one at a time rather than in parallel: each upload's sort order and
      // "is this the first image" decision depends on the count at the time, so
      // concurrent inserts would race for position 0.
      for (const file of Array.from(files)) {
        await uploadProductImage({
          productId,
          file,
          altText: altText.trim() || undefined,
        });
      }
      await refresh();
      setAltText("");
      if (fileInput.current) fileInput.current.value = "";
    } catch (error) {
      setUploadError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  /** Moves one image and submits the complete resulting order. */
  function move(index: number, direction: -1 | 1): void {
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    reorder.mutate({ productId, orderedIds: next.map((image) => image.id) });
  }

  const mutationError = setPrimary.error ?? remove.error ?? reorder.error;

  return (
    <Card title={`Images (${images.length})`}>
      {uploadError ? <Alert tone="error">{uploadError}</Alert> : null}
      {mutationError ? (
        <Alert tone="error">{errorMessage(mutationError)}</Alert>
      ) : null}

      <div className="mt-2 space-y-3 rounded-md border border-ink-200 bg-ink-50 p-4">
        <div>
          <label htmlFor="altText" className="block text-sm font-medium">
            Alt text
          </label>
          <p className="mt-0.5 text-xs text-ink-600">
            Describe the product for screen readers and search engines. Applied to
            the images you upload next.
          </p>
          <div className="mt-1">
            <Input
              id="altText"
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              placeholder="UltraTech OPC 53 grade cement, 50 kg bag"
            />
          </div>
        </div>

        <div>
          <label htmlFor="file" className="block text-sm font-medium">
            Upload images
          </label>
          <p className="mt-0.5 text-xs text-ink-600">
            JPEG, PNG, WebP or AVIF, under 8 MB. Converted to WebP and capped at
            2400 px on upload.
          </p>
          <input
            ref={fileInput}
            id="file"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={uploading}
            onChange={(event) => void handleFiles(event.target.files)}
            className="mt-1 block w-full text-sm"
          />
        </div>

        {uploading ? (
          <p role="status" className="text-sm text-ink-600">
            Uploading…
          </p>
        ) : null}
      </div>

      {images.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-600">
          No images yet. A product needs at least one before it can be published.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="overflow-hidden rounded-md border border-ink-200"
            >
              <div className="relative aspect-4/3 bg-ink-100">
                <Image
                  src={image.url}
                  alt={image.altText ?? ""}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover"
                />
                {image.isPrimary ? (
                  <span className="absolute left-2 top-2 rounded-full bg-accent-600 px-2 py-0.5 text-xs font-medium text-white">
                    primary
                  </span>
                ) : null}
              </div>

              <div className="space-y-2 p-3">
                <p className="truncate text-xs text-ink-600">
                  {image.altText ?? "No alt text"}
                </p>

                <div className="flex flex-wrap gap-1">
                  {!image.isPrimary ? (
                    <Button
                      onClick={() => setPrimary.mutate({ id: image.id })}
                      disabled={setPrimary.isPending}
                    >
                      Make primary
                    </Button>
                  ) : null}
                  <Button
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || reorder.isPending}
                    aria-label="Move earlier"
                  >
                    ↑
                  </Button>
                  <Button
                    onClick={() => move(index, 1)}
                    disabled={index === images.length - 1 || reorder.isPending}
                    aria-label="Move later"
                  >
                    ↓
                  </Button>
                  <ConfirmButton
                    message="Delete this image? The file is removed too."
                    onConfirm={() => remove.mutate({ id: image.id })}
                    disabled={remove.isPending}
                  >
                    Delete
                  </ConfirmButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
