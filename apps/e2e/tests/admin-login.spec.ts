import { expect, test } from "@playwright/test";

import { ADMIN_URL, API_URL } from "../urls.js";

/**
 * Login itself, and the boundary either side of it. Deliberately does not use
 * the project's default authenticated `storageState` (see auth.setup.ts) —
 * every test here starts from a genuinely fresh, signed-out browser context,
 * because that unauthenticated state is exactly what's under test.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("admin authentication boundary", () => {
  test("visiting a protected page while signed out redirects to login", async ({
    page,
  }) => {
    await page.goto(`${ADMIN_URL}/products`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("valid credentials sign in and reach the dashboard", async ({ page }) => {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    test.skip(!email || !password, "SEED_ADMIN_EMAIL/PASSWORD not set in .env");

    await page.goto(`${ADMIN_URL}/login`);
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/Signed in as/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("invalid credentials show an error and do not sign in", async ({
    page,
  }) => {
    await page.goto(`${ADMIN_URL}/login`);
    await page.getByLabel("Email").fill("not-a-real-admin@buildanta.local");
    await page.getByLabel("Password").fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Not `getByRole("alert")` alone: Next.js's App Router injects its own
    // hidden route-announcer element with the same role on every page
    // (`#__next-route-announcer__`), so that locator resolves to two elements
    // and Playwright's strict mode refuses to pick one. Filtering by the
    // actual message text is unambiguous and is the real assertion anyway.
    //
    // "Incorrect email or password" is the one message used for both a
    // nonexistent account and a wrong password — this alone confirms the
    // enumeration-resistant design in packages/api/src/routers/auth.ts held.
    await expect(
      page.getByRole("alert").filter({ hasText: /incorrect/i }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("a raw write to an admin procedure without a session is rejected", async ({
    request,
  }) => {
    const response = await request.post(`${API_URL}/trpc/admin.products.create`, {
      headers: {
        "content-type": "application/json",
        "x-buildanta-client": "e2e",
      },
      data: {
        json: {
          slug: "e2e-should-never-be-created",
          name: "Should never be created",
          categoryId: "00000000-0000-0000-0000-000000000000",
          specifications: {},
          roomIds: [],
          stageIds: [],
          status: "DRAFT",
        },
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.json.data.code).toBe("UNAUTHORIZED");
  });
});
