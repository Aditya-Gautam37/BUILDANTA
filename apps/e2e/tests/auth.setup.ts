import { expect, test as setup } from "@playwright/test";

import { ADMIN_URL } from "../urls.js";

const authFile = "./.auth/admin.json";

/**
 * Logs in once, via the real UI, and saves the resulting cookie so other specs
 * can start already authenticated instead of repeating a slow UI login in
 * every test. Login itself — valid credentials, invalid credentials, the
 * redirect-when-signed-out behaviour — is still tested directly in
 * `admin-login.spec.ts` against a fresh, unauthenticated context; this file
 * exists only to make the *other* specs fast, not to replace that coverage.
 */
setup("authenticate as the seeded admin", async ({ page }) => {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must be set in .env to run e2e tests.",
    );
  }

  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // The dashboard shell only renders once `auth.me` resolves to a real admin —
  // waiting for its content is a more faithful "login actually worked" signal
  // than just the URL changing, which happens before that query even starts.
  await expect(page.getByText(/Signed in as/)).toBeVisible({ timeout: 15_000 });

  await page.context().storageState({ path: authFile });
});
