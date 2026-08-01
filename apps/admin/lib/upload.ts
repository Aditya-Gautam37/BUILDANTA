import { apiUrl } from "./trpc";

/**
 * Uploads a product image to the API's multipart endpoint.
 *
 * Not a tRPC call — see packages/api/src/images.ts for why file upload is a plain
 * HTTP route. `credentials: "include"` is required for the session cookie, and the
 * client header satisfies the API's CSRF check.
 */
export interface UploadedImage {
  id: string;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  isPrimary: boolean;
  sortOrder: number;
  variantId: string | null;
}

export async function uploadProductImage(args: {
  productId: string;
  file: File;
  altText?: string;
  variantId?: string;
}): Promise<UploadedImage> {
  const body = new FormData();
  body.set("productId", args.productId);
  body.set("file", args.file);
  if (args.altText) body.set("altText", args.altText);
  if (args.variantId) body.set("variantId", args.variantId);

  const response = await fetch(`${apiUrl}/admin/uploads/product-image`, {
    method: "POST",
    body,
    credentials: "include",
    headers: {
      // Content-Type is deliberately not set: the browser has to generate the
      // multipart boundary, and setting it by hand produces an unparseable body.
      "x-buildanta-client": "admin",
    },
  });

  if (!response.ok) {
    // The API returns a readable reason for a rejected image (wrong format, too
    // large, not an image); surface that rather than the status code.
    const message = await response
      .json()
      .then((data: { error?: string }) => data.error)
      .catch(() => undefined);
    throw new Error(message ?? `Upload failed (${response.status}).`);
  }

  return (await response.json()) as UploadedImage;
}
