# Contributing

## Before you start

Read [README.md](README.md) for setup and [ARCHITECTURE.md](ARCHITECTURE.md)
for how the pieces fit together. If you're touching the database, read
[docs/database.md](docs/database.md) first — several columns exist for reasons
that are not obvious from the column alone.

## Environment

- Node 20.11+, pnpm 9, Docker (for Postgres).
- One `.env` at the repo root. Every workspace reads it via `dotenv-cli`;
  there is no per-app `.env`.
- `pnpm setup` gets a clean checkout running: installs, starts Postgres,
  migrates, seeds.

## Everyday commands

```bash
pnpm dev              # all three apps, watching
pnpm lint             # every package and app
pnpm typecheck        # every package and app
pnpm test             # every package and app with tests
pnpm build            # production build of every app
pnpm verify           # lint && typecheck && test && build — run this before opening a PR
pnpm test:integration # separate; needs a real, migrated Postgres — see below
```

`pnpm verify` is the local equivalent of what CI should run, and is fully
database-independent. If it's green locally, a PR built from the same commit
should be green too. `pnpm test:integration` is deliberately **not** part of
`pnpm verify` — it needs `DATABASE_URL` to point at a real, migrated Postgres,
and folding that requirement into `pnpm verify` silently would change what
every other command in this repo can assume.

## Making a schema change

1. Edit `packages/db/prisma/schema.prisma`.
2. `pnpm db:migrate` — names and creates the migration. Look at the generated
   SQL before committing; a migration that looks right in the schema diff can
   still be destructive in the generated SQL (an implicit column drop, a type
   change that truncates data).
3. Update `packages/db/prisma/seed.ts` if the change affects seeded data.
4. Update the Zod schema in `packages/api/src/schemas.ts` if the change affects
   an input shape — this is the one place validation lives; do not add a second
   validator in a form component.
5. Update `docs/database.md` if you're adding a table, an enum, or a
   non-obvious column (see that file's own guidance on what counts).

## Adding a procedure

Every write must go through `adminProcedure` or `publicProcedure`
(`packages/api/src/trpc.ts`) — there is no third way to reach Prisma from a web
app. Before adding one:

- Does it write data another release depends on (quote line snapshots, published
  history)? If so, prefer archiving/soft state over deletion — see the pattern
  in `packages/api/src/routers/admin/products.ts`.
- Does it change `Product.minPrice`/`maxPrice`/`activeVariantCount`, or a
  variant's `isDefault`/`isActive`? Two things, not one: it must call
  `recomputeProductPricing()` inside the same transaction, *and* that
  transaction must take a `SELECT ... FOR UPDATE` lock on the product row as
  its first statement, before reading anything else. A transaction alone does
  not stop a concurrent request from committing in the gap between your read
  and your write — see the comment on the lock in `variants.create`
  (`packages/api/src/routers/admin/variants.ts`) for the exact failure mode
  this closes, and `setStatus`/`delete` in `admin/products.ts` for the same
  pattern from the product side. Every mutation that touches these columns
  needs the lock, or none of them are actually safe.
- Does the input need slugs, money, or quantities? Reuse the schemas in
  `packages/api/src/schemas.ts` (`slug`, `money`, `quantity`) rather than
  writing a new regex. The `slug` schema in particular exists to reject the
  double-hyphen defect found on the live prototype — see
  `packages/api/src/schemas.test.ts` for the regression test.

## Testing expectations

Both planning documents (`BUILD_FROM_SCRATCH.md` §11, `PROJECT_CONTEXT.md` §26
Phase 10) require unit tests for pure business rules and integration tests for
API behavior. In this codebase that currently means:

- **Unit tests** (`packages/auth`, `packages/api`, `apps/admin/lib`,
  `apps/storefront/lib`): pure functions with no database — password hashing,
  session tokens, Zod schemas, money/unit formatting, the rate limiter, slug
  generation, decimal-safe quantity arithmetic. Run with `vitest`; see any
  `*.test.ts` file for the pattern.
- **Integration tests** (`packages/api/src/routers/*.integration.test.ts`):
  call the tRPC router directly against a real database via
  `createCallerFactory`. One exists so far — the admin-create→draft-hidden→
  publish→visible→archive-hidden flow, plus the auth boundary either side of
  it — see [docs/testing.md](docs/testing.md) for what it covers. Add to this
  file, or a new one alongside it, rather than testing a transaction's
  correctness only by hand from here on.
- **End-to-end tests are not yet written.** See
  [docs/testing.md](docs/testing.md) for what that needs.

A PR that adds a pure function without a test for it, or that changes one of
the files above without updating its test, should not merge.

## Commit and PR conventions

- Small, reviewable commits. A schema migration and the code that depends on it
  can be one commit; an unrelated formatting pass should not be in it.
- Describe *why*, not just *what*, in the PR description — especially for
  anything that deviates from `PROJECT_CONTEXT.md` or `BUILD_FROM_SCRATCH.md`.
  Several intentional deviations are already recorded in
  [ARCHITECTURE.md § Known architectural gaps](ARCHITECTURE.md#known-architectural-gaps);
  add to that list rather than letting a new one go undocumented.
- Never commit `.env`, a real password, or a generated Prisma client.

## Security-relevant changes

Anything touching `packages/auth`, `packages/api/src/trpc.ts`,
`packages/api/src/context.ts`, or `apps/api/src/server.ts`'s CORS/CSRF hooks
should be called out explicitly in the PR description, even if the diff looks
small. These are the files that make the difference between "the API rejects an
unauthenticated write" and "it doesn't."
