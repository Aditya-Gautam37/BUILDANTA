import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, request as apiRequest, test } from "@playwright/test";

import {
  apiLogin,
  createTestCategory,
  uniqueSlug,
} from "../fixtures/api.js";
import type { TestCategory } from "../fixtures/api.js";
import { ADMIN_URL, API_URL, STOREFRONT_URL } from "../urls.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const testImagePath = path.join(
  here,
  "..",
  "fixtures",
  "assets",
  "test-product.png",
);

/**
 * The full admin-to-storefront flow, driven entirely through the real UI —
 * create → publish blocked twice → variant → image → publish → visible on the
 * storefront → edited → change visible → archived → gone from the storefront
 * again. `products.integration.test.ts` already proves this at the router
 * level; this proves the actual pages, forms and file input do the same thing
 * a person clicking through them would see.
 */
test.describe("product lifecycle", () => {
  let category: TestCategory;
  let productName: string;
  let productSlug: string;
  let productId: string;

  test.beforeAll(async () => {
    const cookie = await apiLogin();
    category = await createTestCategory(cookie, "lifecycle");
    productSlug = uniqueSlug("lifecycle-product");
    productName = `E2E Lifecycle Product ${productSlug.split("-").pop()}`;
  });

  test.afterAll(async () => {
    // The product itself is left archived, not deleted — by the same rule
    // admin.products.delete enforces: a product that has ever been published
    // cannot be hard-deleted, because a quote could reference its SKU. That
    // also means the category fixture cannot be cleaned up here (deleting a
    // category with a product still filed under it is correctly refused) —
    // this is expected, not a leak: it's the same trade-off a real published
    // product makes, exercised by the test that publishes one.
  });

  test("create, publish, edit and archive, verified on the storefront at each step", async ({
    page,
  }) => {
    // --- Create as a draft ---
    await page.goto(`${ADMIN_URL}/products/new`);
    // Not `{ exact: true }`: both labels are `required`, which renders their
    // accessible name with a trailing "*" (e.g. "Name *") — an exact match
    // against the bare word would never find them.
    await page.getByLabel("Name").fill(productName);
    // A top-level category (no parent, which is what createTestCategory makes)
    // renders in this dropdown as exactly its own name — see the label-building
    // logic in components/product-form.tsx.
    await page.getByLabel("Category").selectOption({ label: category.name });
    await page.getByRole("button", { name: "Create draft" }).click();

    // The longest wait in this file, deliberately: this is the first visit to
    // `/products/[id]` in a run, so the dev server compiles that route on
    // demand before the client-side transition can commit and change the URL.
    // Measured at 13.7s for the page chunk alone on top of the RSC fetch.
    await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    productId = page.url().split("/products/")[1]!;

    await expect(page.getByText(productSlug)).toBeVisible();

    // --- Publish blocked: no variant yet ---
    await expect(
      page.getByText(/add a variant with a price/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();

    // --- Add a variant through the real form ---
    await page.getByRole("button", { name: "Add variant" }).click();
    await page.getByLabel("SKU").fill(`E2E-${productSlug.toUpperCase()}`);
    await page.getByLabel("Option name").fill("Default");
    await page.getByLabel("Price").fill("499.00");
    // "Sold by" already defaults to "piece"; left as-is.
    await page.getByRole("button", { name: "Add variant", exact: true }).click();
    await expect(page.getByText(`E2E-${productSlug.toUpperCase()}`)).toBeVisible();

    // --- Publish still blocked: no image yet ---
    await expect(page.getByText(/add a product image/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();

    // --- Upload an image through the real file input ---
    await page.locator("#file").setInputFiles(testImagePath);
    // The "primary" badge only renders once the upload has actually round-tripped
    // through the API and the image list has refetched — a concrete signal that
    // it worked, not just that the file input accepted a path.
    await expect(page.getByText(/primary/i)).toBeVisible({ timeout: 20_000 });

    // --- Publish now succeeds ---
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("active", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // --- Visible on the real storefront ---
    await page.goto(`${STOREFRONT_URL}/products/${productSlug}`);
    await expect(page.getByRole("heading", { name: productName })).toBeVisible();
    await expect(page.getByText("₹499")).toBeVisible();

    // --- Edit propagates to the storefront ---
    const updatedName = `${productName} (edited)`;
    await page.goto(`${ADMIN_URL}/products/${productId}`);
    await page.getByLabel("Name").fill(updatedName);
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Details saved.")).toBeVisible();

    await page.goto(`${STOREFRONT_URL}/products/${productSlug}`);
    await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();

    // --- An unauthenticated edit attempt is rejected server-side ---
    // Deliberately NOT the `request` fixture: it is built from the same
    // `storageState` as this project's browser context, which is the signed-in
    // admin session (see playwright.config.ts). Using it here sent the admin's
    // own cookie, so the "unauthenticated" write returned 200 and this
    // assertion was testing nothing — it only surfaced once an unrelated fix
    // let the test run this far. A context created explicitly with no
    // storageState is the only way to be certain no session is attached.
    const anonymous = await apiRequest.newContext({ storageState: undefined });
    try {
      const unauthedEdit = await anonymous.post(
        `${API_URL}/trpc/admin.products.update`,
        {
          headers: {
            "content-type": "application/json",
            "x-buildanta-client": "e2e",
          },
          data: {
            json: {
              id: productId,
              slug: productSlug,
              name: "Hacked by an unauthenticated request",
              categoryId: category.id,
              specifications: {},
              roomIds: [],
              stageIds: [],
            },
          },
        },
      );
      expect(unauthedEdit.status()).toBe(401);
    } finally {
      await anonymous.dispose();
    }

    await page.goto(`${STOREFRONT_URL}/products/${productSlug}`);
    await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();

    // --- Archive removes it from the storefront again ---
    await page.goto(`${ADMIN_URL}/products/${productId}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("archived", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const storefrontAfterArchive = await page.request.get(
      `${STOREFRONT_URL}/products/${productSlug}`,
    );
    expect(storefrontAfterArchive.status()).toBe(404);
  });
});
