import { randomUUID } from "node:crypto";

import { prisma } from "@buildanta/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AuthenticatedAdmin, Context } from "../context.js";
import { appRouter } from "../root.js";
import { createCallerFactory } from "../trpc.js";

/**
 * The exact flow the admin dashboard and the public storefront are supposed to
 * share: an admin creates a product, it is invisible to the public router while
 * it is a draft, and publishing it makes it visible through the same read path
 * the storefront actually calls. Also covers the two guarantees either side of
 * that flow depends on: an unauthenticated caller cannot reach an admin
 * procedure, and a draft is unreachable even by guessing its exact slug.
 *
 * Calls the router directly via `createCallerFactory` rather than over HTTP —
 * this is a test of the procedures' own logic (authorization, the DRAFT/ACTIVE
 * boundary, the publish precondition), not of Fastify or cookie handling, which
 * are covered separately in apps/api.
 *
 * Needs a real, reachable `DATABASE_URL`. Run with `pnpm test:integration`, never
 * as part of `pnpm test` / `pnpm verify` — see vitest.integration.config.ts.
 */

const createCaller = createCallerFactory(appRouter);

function contextWith(admin: AuthenticatedAdmin | null): Context {
  return {
    prisma,
    request: {
      sessionToken: null,
      ipAddress: "127.0.0.1",
      userAgent: "vitest-integration",
    },
    // No real HTTP response to set a cookie on; the procedures under test here
    // never need to inspect what these do, only that they exist.
    cookies: { set() {}, clear() {} },
    admin,
  };
}

const anonymousCaller = createCaller(contextWith(null));

describe("admin-to-storefront visibility (integration)", () => {
  // Suffixed with a fresh UUID per run so a prior run's failed cleanup can never
  // collide with this one on a unique constraint.
  const runId = randomUUID().slice(0, 8);
  const categorySlug = `test-integration-category-${runId}`;
  const productSlug = `test-integration-product-${runId}`;
  const sku = `TEST-INTEGRATION-${runId}`;
  const adminEmail = `test-integration-admin-${runId}@buildanta.local`;

  let categoryId: string;
  let adminUser: AuthenticatedAdmin;
  let productId: string | undefined;

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { slug: categorySlug, name: "Test Integration Category" },
    });
    categoryId = category.id;

    const created = await prisma.adminUser.create({
      data: {
        email: adminEmail,
        // Never verified in this test — no login happens, `ctx.admin` is
        // injected directly — so this only needs to be a syntactically
        // plausible value, never a real credential.
        passwordHash: "unused-in-this-test",
        name: "Test Integration Admin",
      },
    });
    adminUser = {
      sessionId: randomUUID(),
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
    };
  });

  afterAll(async () => {
    // Cascades to the variant and image rows created below.
    if (productId) {
      await prisma.product.delete({ where: { id: productId } }).catch(() => {});
    }
    await prisma.adminUser
      .delete({ where: { id: adminUser.id } })
      .catch(() => {});
    await prisma.category.delete({ where: { id: categoryId } }).catch(() => {});
  });

  it("rejects an unauthenticated caller before touching the database", async () => {
    await expect(
      anonymousCaller.admin.products.create({
        slug: `${productSlug}-unauthorized`,
        name: "Should never be created",
        categoryId,
        specifications: {},
        roomIds: [],
        stageIds: [],
        status: "DRAFT",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    // Confirms the rejection actually happened before any write, not after.
    const count = await prisma.product.count({
      where: { slug: `${productSlug}-unauthorized` },
    });
    expect(count).toBe(0);
  });

  it("a draft is invisible on the public router, even by its exact slug", async () => {
    const adminCaller = createCaller(contextWith(adminUser));

    const created = await adminCaller.admin.products.create({
      slug: productSlug,
      name: "Test Integration Product",
      categoryId,
      specifications: {},
      roomIds: [],
      stageIds: [],
      status: "DRAFT",
    });
    productId = created.id;

    await expect(
      anonymousCaller.catalog.products.bySlug({ slug: productSlug }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const searchResult = await anonymousCaller.catalog.products.list({
      q: "Test Integration Product",
    });
    expect(searchResult.items).toHaveLength(0);

    // The admin's own read path is unaffected by the public scope — this is what
    // lets an admin preview a draft before publishing it.
    const adminView = await adminCaller.admin.products.byId({ id: productId });
    expect(adminView.status).toBe("DRAFT");
  });

  it("cannot publish without a priced variant and an image", async () => {
    const adminCaller = createCaller(contextWith(adminUser));

    await expect(
      adminCaller.admin.products.setStatus({ id: productId!, status: "ACTIVE" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("publishing makes the product visible through the same router the storefront calls", async () => {
    const adminCaller = createCaller(contextWith(adminUser));

    await adminCaller.admin.variants.create({
      productId: productId!,
      sku,
      name: "Default",
      price: "100.00",
      unit: "PIECE",
      attributes: {},
      isDefault: true,
      isActive: true,
    });

    // Image upload is a multipart HTTP route, not a tRPC procedure — see
    // packages/api/src/images.ts for why — so it is out of reach of a
    // router-level caller test. Inserted directly: this test is verifying the
    // publish precondition and the visibility boundary, not the upload pipeline,
    // which is reviewed separately.
    await prisma.productImage.create({
      data: {
        productId: productId!,
        url: "https://example.test/test-integration.jpg",
        storageKey: `test-integration/${runId}.jpg`,
        isPrimary: true,
      },
    });

    await adminCaller.admin.products.setStatus({
      id: productId!,
      status: "ACTIVE",
    });

    const found = await anonymousCaller.catalog.products.bySlug({
      slug: productSlug,
    });
    expect(found.name).toBe("Test Integration Product");
    expect(found.status).toBe("ACTIVE");
    expect(found.variants).toHaveLength(1);
    expect(found.variants[0]?.sku).toBe(sku);

    const searchResult = await anonymousCaller.catalog.products.list({
      q: "Test Integration Product",
    });
    expect(searchResult.items.map((item) => item.slug)).toContain(productSlug);
  });

  it("an unauthenticated caller cannot edit the now-published product", async () => {
    await expect(
      anonymousCaller.admin.products.update({
        id: productId!,
        slug: productSlug,
        name: "Renamed by an attacker",
        categoryId,
        specifications: {},
        roomIds: [],
        stageIds: [],
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const unchanged = await anonymousCaller.catalog.products.bySlug({
      slug: productSlug,
    });
    expect(unchanged.name).toBe("Test Integration Product");
  });

  it("archiving removes it from the public router again", async () => {
    const adminCaller = createCaller(contextWith(adminUser));

    await adminCaller.admin.products.setStatus({
      id: productId!,
      status: "ARCHIVED",
    });

    await expect(
      anonymousCaller.catalog.products.bySlug({ slug: productSlug }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
