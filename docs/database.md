# Database

The schema is `packages/db/prisma/schema.prisma`. This document explains the
decisions the schema comments don't have room for, and points at what's
missing relative to both planning documents.

## Entities

| Model | Purpose |
|---|---|
| `AdminUser`, `AdminSession` | Staff identity and server-side sessions. |
| `Category` | Self-referencing, two levels deep in practice (enforced by the app, not the schema — see below). |
| `Brand`, `Room`, `ConstructionStage` | Flat taxonomies. `sortOrder` on `Room` is display order; on `ConstructionStage` it is the real chronology of a build, and the storefront's stage-to-stage navigation depends on that ordering being correct. |
| `Supplier` | Contact record only. No purchase orders, no stock — that's Release 3. |
| `Product` | The editorial record. Never itself purchasable. |
| `ProductVariant` | The purchasable unit: one SKU, one price, one unit. |
| `ProductImage` | Belongs to a product, optionally scoped to one variant. |
| `QuoteRequest`, `QuoteRequestItem` | A bulk quote request and its lines. |
| `QuoteReferenceCounter` | Backing sequence for human-readable references like `BQ-2026-0007`. |

## Decisions worth knowing

**Money is `Decimal(12,2)` with an explicit `currency` column, never `Float`.**
Every value crosses the API boundary as a string (`packages/api/src/serializers.ts`);
a `Decimal` handed to `JSON.stringify` serializes as `{}`, and a `Number` loses
precision at the boundary where it matters least visibly and most expensively.

**Sales unit is an enum on the variant** (`SalesUnit`: `BAG`, `TONNE`,
`SQUARE_METRE`, …), not free text. Cement sells by the bag, steel by the tonne,
tile by the box — conflating "price" with "price per what" is the standard
construction-catalog bug, and an enum makes it a compile-time-checked value
instead of a string someone might mistype.

**Products are retired with a status, never deleted.** `ProductStatus` is
`DRAFT | ACTIVE | ARCHIVED`. A product that has ever been published cannot be
hard-deleted (enforced in `admin.products.delete`) because `QuoteRequestItem`
snapshots reference its variants by name — deleting it would not remove the
reference, just make it unexplainable.

**One denormalization, and it's documented at the point of write, not just in
the schema comment.** `Product.minPrice`, `maxPrice`, `priceCurrency` and
`activeVariantCount` are derived from that product's active variants.
Sorting and filtering by price needs the *minimum* variant price, which Prisma
cannot express as a relation aggregate in a `WHERE`/`ORDER BY` without either
this denormalization or hand-written SQL duplicating every filter clause.
`recomputeProductPricing()` (`packages/api/src/pricing.ts`) is the **only**
writer, and every admin mutation that touches a variant's price or active state
calls it inside the same transaction — see `packages/api/src/routers/admin/variants.ts`.
If you add a new way to change a variant's price, this is the invariant you
must preserve.

**Quote line items snapshot everything**, per both planning documents'
guidance (`BUILD_FROM_SCRATCH.md` §5, `PROJECT_CONTEXT.md` §25.6): product
name, variant name, SKU, unit, unit price and currency are copied onto the
`QuoteRequestItem` at submission time. `variantId` remains a soft link
(`onDelete: SetNull`) so staff can still open the current product from an old
request, but the row never depends on the variant still existing or still
having that price.

**Human-readable quote references, not UUIDs.** `QuoteReferenceCounter` is one
row per year with a locked `increment`, allocated inside the same transaction
as the request — see `nextReference()` in `packages/api/src/routers/quotes.ts`
for why a Postgres `SEQUENCE` doesn't fit (references reset each year; a
sequence can't be reset transactionally alongside an insert).

## What's missing relative to the planning documents

- **Multi-category products.** `Product.categoryId` is a single required
  foreign key. Both `PROJECT_CONTEXT.md` §12.3/§25.1 and
  `BUILD_FROM_SCRATCH.md` §5 describe (or imply via `Category ──< Product`) a
  product belonging to potentially multiple categories. This is the most
  consequential open gap — see `ARCHITECTURE.md`.
- **No `AuditLog`, no `createdBy`/`updatedBy`/`archivedAt`.**
  `PROJECT_CONTEXT.md` §25.7 recommends both. Only `createdAt`/`updatedAt`
  exist today.
- **No `Review` model.** Named in `PROJECT_CONTEXT.md` §12.10 and §25.1; not
  built, since nothing in Release 1 needs it.
- **No `Inventory` / stock model.** Both documents place real stock tracking
  in a later phase (`PROJECT_CONTEXT.md` §22.1 explicitly, as Release 3);
  `BUILD_FROM_SCRATCH.md` §1 lists "manage product variants and stock" as part
  of the *first* release, which is the one place the two documents disagree —
  see the open question recorded in project notes rather than a silent choice
  here.
- **Category and Stage/Room are not hierarchical in the schema** the way
  `PROJECT_CONTEXT.md` §12.4–12.5 describes for Stage and Room (only `Category`
  self-references). Rooms and stages are flat lists in this release.

## Migrations and seeding

```bash
pnpm db:migrate   # create/apply a dev migration
pnpm db:seed      # idempotent — safe to re-run after a schema change
pnpm db:reset     # drop, recreate, migrate, seed
pnpm db:studio    # Prisma Studio
```

The seed (`packages/db/prisma/seed.ts`) reproduces the real buildanta.com
taxonomy — ten build stages, six rooms, nine categories, the 28 brands the live
site features — with the double-hyphen slug defect corrected. It is idempotent
(every write is an `upsert`) and reads its one admin password from
`SEED_ADMIN_PASSWORD` in `.env`; it refuses to run if `NODE_ENV=production` or
that variable is unset, so it can never write a hardcoded credential.
