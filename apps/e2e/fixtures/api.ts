import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { API_URL } from "../urls.js";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Thin helpers for driving the real API directly from Node — used only for
 * fixture setup/teardown (a category to file a test product under, cleaning up
 * afterward), never for the behaviour actually under test. The UI is what every
 * spec exercises for the thing it's testing; this exists so a product-lifecycle
 * test isn't also responsible for proving category creation works.
 */

interface TrpcResult<T> {
  result?: { data: { json: T } };
  error?: { json: { message: string; data: { code: string } } };
}

async function trpcCall<T>(
  procedure: string,
  input: unknown,
  cookie: string | undefined,
  method: "GET" | "POST" = "POST",
): Promise<T> {
  const url =
    method === "GET"
      ? `${API_URL}/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
      : `${API_URL}/trpc/${procedure}`;

  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-buildanta-client": "e2e",
      ...(cookie ? { cookie } : {}),
    },
    body: method === "POST" ? JSON.stringify({ json: input }) : undefined,
  });

  const body = (await response.json()) as TrpcResult<T>;
  if (body.error) {
    throw new Error(`${procedure} failed: ${body.error.json.message}`);
  }
  return body.result!.data.json;
}

/**
 * Logs in as the seeded admin and returns the `Cookie` header value for use in
 * further fixture calls. Reads credentials from the same env vars the seed
 * script uses — there is exactly one seeded admin, and these tests do not
 * create their own, so login behaviour itself stays covered by
 * `tests/admin-login.spec.ts` using the real UI, not this shortcut.
 */
export async function apiLogin(): Promise<string> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must be set in .env for e2e fixtures to log in.",
    );
  }

  const response = await fetch(`${API_URL}/trpc/auth.login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-buildanta-client": "e2e",
    },
    body: JSON.stringify({ json: { email, password } }),
  });

  const setCookie = response.headers.get("set-cookie");
  if (!response.ok || !setCookie) {
    const text = await response.text();
    throw new Error(`Fixture login failed (${response.status}): ${text}`);
  }

  // Only the name=value pair is needed on the way back in — the rest of a
  // Set-Cookie header (Path, HttpOnly, SameSite, expiry) isn't valid to resend.
  return setCookie.split(";")[0]!;
}

export interface TestCategory {
  id: string;
  slug: string;
  /** Exact text of the option this category renders as in the admin's category
   *  dropdown — a top-level category (no parent) renders as just its own name. */
  name: string;
  cleanup: () => Promise<void>;
}

/** Creates a category unique to this test run, for a product to be filed under. */
export async function createTestCategory(
  cookie: string,
  label: string,
): Promise<TestCategory> {
  const suffix = randomUUID().slice(0, 8);
  const slug = `e2e-${label}-${suffix}`;
  const name = `E2E ${label} ${suffix}`;

  const created = await trpcCall<{ id: string }>(
    "admin.categories.create",
    {
      slug,
      name,
      description: null,
      sortOrder: 0,
      isActive: true,
    },
    cookie,
  );

  return {
    id: created.id,
    slug,
    name,
    cleanup: async () => {
      await trpcCall("admin.categories.delete", { id: created.id }, cookie).catch(
        () => {
          // Best-effort: if a test left a product filed under this category, the
          // delete is correctly refused server-side, and that is a bug in the
          // test's own cleanup, not something this helper should hide by
          // retrying or force-deleting.
        },
      );
    },
  };
}

/** Deletes a product outright. Only valid for one that was never published — see
 *  the same rule enforced server-side in admin.products.delete. */
export async function deleteTestProduct(
  cookie: string,
  productId: string,
): Promise<void> {
  await trpcCall("admin.products.delete", { id: productId }, cookie).catch(() => {});
}

/** Archives a product — the only teardown available for one that was published. */
export async function archiveTestProduct(
  cookie: string,
  productId: string,
): Promise<void> {
  await trpcCall(
    "admin.products.setStatus",
    { id: productId, status: "ARCHIVED" },
    cookie,
  ).catch(() => {});
}

export function uniqueSlug(label: string): string {
  return `e2e-${label}-${randomUUID().slice(0, 8)}`;
}

/** Creates a draft product with the given slug/name, filed under `categoryId`. */
export async function createTestProduct(
  cookie: string,
  categoryId: string,
  slug: string,
  name: string,
): Promise<{ id: string }> {
  return trpcCall<{ id: string }>(
    "admin.products.create",
    {
      slug,
      name,
      categoryId,
      specifications: {},
      roomIds: [],
      stageIds: [],
      status: "DRAFT",
    },
    cookie,
  );
}

export async function setProductStatus(
  cookie: string,
  productId: string,
  status: "DRAFT" | "ACTIVE" | "ARCHIVED",
): Promise<void> {
  await trpcCall("admin.products.setStatus", { id: productId, status }, cookie);
}

/**
 * Category + product + variant + image + publish, in one call — the complete
 * setup a spec needs when what it's testing is downstream of "a published
 * product already exists" (the quote basket, for instance), not the
 * create-and-publish flow itself (which product-lifecycle.spec.ts already
 * drives through the real UI end to end).
 */
export async function createPublishedTestProduct(
  cookie: string,
  label: string,
  priceValue = "199.00",
): Promise<{ id: string; slug: string; name: string; category: TestCategory }> {
  const category = await createTestCategory(cookie, label);
  const slug = uniqueSlug(`${label}-product`);
  const name = `E2E ${label} product ${slug.split("-").pop()}`;

  const product = await createTestProduct(cookie, category.id, slug, name);
  await createTestVariant(cookie, product.id, priceValue);
  await uploadTestImage(cookie, product.id);
  await setProductStatus(cookie, product.id, "ACTIVE");

  return { id: product.id, slug, name, category };
}

export interface CreatedVariant {
  id: string;
  sku: string;
}

/** Adds a priced, active, default variant to a product via the real API. */
export async function createTestVariant(
  cookie: string,
  productId: string,
  priceValue = "199.00",
): Promise<CreatedVariant> {
  const sku = `E2E-${randomUUID().slice(0, 8).toUpperCase()}`;
  const created = await trpcCall<{ id: string; sku: string }>(
    "admin.variants.create",
    {
      productId,
      sku,
      name: "Default",
      price: priceValue,
      unit: "PIECE",
      attributes: {},
      isDefault: true,
      isActive: true,
    },
    cookie,
  );
  return created;
}

/**
 * Uploads the checked-in test image (fixtures/assets/test-product.png) through
 * the real multipart route — not a tRPC procedure, matching how the actual
 * upload works — so publish's "at least one image" precondition can be
 * satisfied without the browser having to drive a file input for fixture setup
 * that isn't the thing a given spec is testing.
 */
export async function uploadTestImage(
  cookie: string,
  productId: string,
): Promise<void> {
  const bytes = await readFile(
    path.join(here, "assets", "test-product.png"),
  );
  const form = new FormData();
  form.set("productId", productId);
  form.set("altText", "E2E fixture image");
  form.set("file", new Blob([bytes], { type: "image/png" }), "test-product.png");

  const response = await fetch(`${API_URL}/admin/uploads/product-image`, {
    method: "POST",
    headers: { "x-buildanta-client": "e2e", cookie },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Fixture image upload failed (${response.status}): ${await response.text()}`);
  }
}
