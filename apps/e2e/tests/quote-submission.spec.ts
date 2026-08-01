import { expect, test } from "@playwright/test";

import { apiLogin, createPublishedTestProduct } from "../fixtures/api.js";
import { API_URL, STOREFRONT_URL } from "../urls.js";

/**
 * The one marketplace feature the original buildanta.com prototype advertised
 * ("Get Bulk Quotes") with no working form behind it — browse, add to the
 * basket, submit, get a reference back. Runs with a fresh, unauthenticated
 * context: nothing about the storefront or the quote form requires being
 * signed in, and this should never depend on the admin session the other
 * specs use.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("quote submission", () => {
  let productName: string;
  let productSlug: string;

  test.beforeAll(async () => {
    const cookie = await apiLogin();
    const product = await createPublishedTestProduct(cookie, "quote", "750.00");
    productName = product.name;
    productSlug = product.slug;
  });

  test("browse, add to quote, submit, and receive a reference", async ({
    page,
  }) => {
    await page.goto(`${STOREFRONT_URL}/products/${productSlug}`);
    await expect(page.getByRole("heading", { name: productName })).toBeVisible();

    await page.getByLabel(/Quantity/).fill("5");
    await page.getByRole("button", { name: "Add to quote" }).click();
    // Substring match: the "Added." text and the "Review your quote request"
    // link both live inside the same status paragraph, so an element whose
    // *entire* text is exactly "Added." doesn't exist to match exactly against.
    await expect(page.getByText("Added.")).toBeVisible();

    await page.getByRole("link", { name: /Review your quote request/i }).click();
    await expect(page).toHaveURL(/\/quote$/);
    await expect(page.getByText(productName)).toBeVisible();

    await page.getByLabel("Your name").fill("E2E Test Buyer");
    await page.getByLabel("Email").fill("e2e-buyer@example.com");
    await page.getByRole("button", { name: "Send quote request" }).click();

    await expect(
      page.getByRole("heading", { name: /Your reference is BQ-/ }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("the quote form rejects a request with no items server-side", async ({
    request,
  }) => {
    // The storefront UI never lets you reach the submit button with an empty
    // basket (see the empty-state branch in quote-request-form.tsx) — this
    // confirms the API enforces the same rule itself, not only the UI.
    const response = await request.post(`${API_URL}/trpc/quotes.submit`, {
      headers: {
        "content-type": "application/json",
        "x-buildanta-client": "e2e",
      },
      data: {
        json: {
          contactName: "E2E Test Buyer",
          contactEmail: "e2e-buyer@example.com",
          items: [],
        },
      },
    });
    expect(response.status()).toBe(400);
  });
});
