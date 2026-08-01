# Testing

## What exists

**Unit tests** — pure functions, nothing that touches Prisma or a network call:

| Package | Covers |
|---|---|
| `packages/auth` | Password hashing/verification round-trip, timing-safe-login helper, session token generation and hashing, expiry math. |
| `packages/api` | Every Zod schema in `schemas.ts` (including a named regression test for the live prototype's double-hyphen slug defect), money/unit/quantity display formatting, the in-memory rate limiter. |
| `apps/admin` | `slugify()` — the same double-hyphen defect, from the admin-form side. |
| `apps/storefront` | `addQuantities()` — decimal-safe addition for the quote basket, including a regression test for the `0.1 + 0.2` float-drift case that plain `Number` addition produced. |

Run them:

```bash
pnpm test          # every workspace
pnpm --filter @buildanta/api test   # one workspace
```

`packages/db` and `apps/api` have no test script — there is no pure logic in
either worth unit-testing in isolation.

**Integration tests** — `packages/api/src/routers/products.integration.test.ts`.
Calls the tRPC router directly via `createCallerFactory`
(`packages/api/src/trpc.ts` exports it for exactly this — faster than going
through Fastify, and it's the router's own logic under test, not the HTTP
layer's). Covers the flow both planning documents ask for explicitly:

- An unauthenticated caller is rejected by an admin procedure before any write
  happens.
- A DRAFT product is invisible on the public router, even by its exact slug or
  by search — while remaining visible to the admin's own read path.
- Publishing is refused until the product has a priced variant and an image.
- Once published, the product is visible through the *same* public procedure
  the storefront calls (not a mocked or parallel path).
- An unauthenticated caller cannot edit a product once published.
- Archiving removes it from the public router again.

Every fixture (category, admin user, product, slug, SKU) is created fresh with
a random suffix and torn down in `afterAll`, so the test is self-contained —
it doesn't depend on seed data and won't collide with it or with a previous
run's leftovers if cleanup ever fails partway.

Run it separately from the rest:

```bash
pnpm test:integration
```

Deliberately **not** part of `pnpm test` or `pnpm verify` — see
`packages/api/vitest.config.ts` (excludes `*.integration.test.ts`) and
`vitest.integration.config.ts` (includes only that pattern). `pnpm verify` has
been fully database-independent since it existed; folding a live-database
requirement into it silently would change what every other command in this
repo can assume. It needs `DATABASE_URL` to point at a real, reachable
Postgres with the schema migrated — nothing else.

**Storage integration tests** — `packages/api/src/storage.integration.test.ts`,
run by the same `pnpm test:integration` command. Talks to real Supabase
Storage, because the point is to prove the credentials, bucket policy and
upload validation behave as `storage.ts` claims, which a mock cannot do. It
only ever deletes files it uploaded itself in the same run. Covers: upload →
public read (checking the WebP magic number, so an error page served with a 200
cannot pass) → delete; re-encoding to WebP with EXIF stripped; the 2400 px
dimension cap; and the four rejection paths (disallowed MIME type, bytes that
are not a decodable image despite an image MIME type, oversize, and a
never-uploaded key not being readable).

Two Supabase behaviours it documents, both measured rather than assumed:

- A missing object on a public bucket answers **400**, not 404.
- Deleting an object does **not** purge Supabase's CDN, so the public URL keeps
  returning 200 with the old bytes until the `cacheControl` TTL (30 days, set
  in `save`) expires. The test cache-busts its post-delete check to see origin
  state. This matters operationally — see `docs/deployment.md`.

**End-to-end tests** — `apps/e2e`, Playwright, run with `pnpm test:e2e`. Drives
all three apps together through real rendered pages, so it covers what the
integration tier bypasses by design: cookies, CORS, the actual forms, and a
real `<input type="file">`.

| Spec | Covers |
|---|---|
| `auth.setup.ts` | Signs in through the real login form once and saves the session, which the authenticated specs reuse. |
| `admin-login.spec.ts` | Signed-out redirect to `/login`, valid sign-in, invalid credentials showing the one enumeration-resistant message, and a raw admin write with no session rejected as 401. Runs from a genuinely empty browser context. |
| `product-lifecycle.spec.ts` | Create a draft → publish refused with no variant → add a variant → publish refused with no image → upload a real image through the file input → publish → visible on the storefront → edit → edit visible → an unauthenticated write rejected → archive → gone from the storefront (404). |
| `quote-submission.spec.ts` | Browse, add to the basket, submit the form, get a reference back; plus the API refusing an empty-item request server-side. |

`apps/api/src/app.test.ts` additionally exercises CORS and the CSRF header
requirement against the real Fastify app via `app.inject()`, and
`apps/api/src/context.test.ts` covers the session cookie's flags — both in the
unit tier, since neither needs a database.

Run it separately, like the integration tier:

```bash
pnpm test:e2e
```

It starts (or reuses) all three dev servers itself. Do not edit source files
while it runs: both web apps set `transpilePackages: ["@buildanta/api"]`, so a
write anywhere in that package triggers a webpack rebuild and a Fast Refresh
remount mid-test, which detaches React event handlers and produces failures
that look like application bugs but are not.

### Known rough edge: dev-server cold compiles

The suite runs against `next dev`, where each route is compiled on first visit.
Measured here: a `router.replace` into `/products/[id]` fetched its RSC payload
in ~1s and then waited 13.7s for the route's page chunk, because that route had
never been compiled in that server's life. The client-side transition — and so
the URL — cannot commit until it arrives, which is why the timeouts in
`playwright.config.ts` are set well above the defaults.

**Recommended improvement, not yet done:** run this suite against production
builds (`next build` then `next start`) instead of `next dev`. No route
compiles on demand, so the whole class of timing flake disappears and the
timeouts can come back down. It is not done here because it changes what the
harness has to build before it can run, which is a deliberate decision rather
than a detail to slip in.

## What's still missing

Broader integration coverage: quote submission's transaction, the
variant/image row-locking, and taxonomy CRUD are exercised end to end through
the UI but have no direct router-level tests.

## What to test by hand until broader coverage exists

The draft/publish/archive boundary and the auth boundary are now covered by
`pnpm test:integration`. Still worth checking by hand when you touch these:

- A transaction in `packages/api/src/routers/admin/variants.ts` or
  `images.ts` — verify the product's `minPrice`/`maxPrice`/`activeVariantCount`
  are correct in Prisma Studio (`pnpm db:studio`) after the mutation, not just
  that the mutation returned success. In particular, every mutation that reads
  `activeVariantCount` or a variant's `isDefault`/`isActive` state now takes a
  `SELECT ... FOR UPDATE` lock on the product row *before* reading anything —
  if you add a new mutation that touches these, it needs the same lock, or the
  precondition it's checking can be invalidated by a concurrent request in the
  gap between the check and the write. See the comment on any of the existing
  locks (e.g. `variants.create`) for why a transaction alone isn't sufficient.
- The quote submission flow — submit a real request through the storefront
  form and confirm the reference, the line snapshot, and the rate limit all
  behave as described in `docs/authentication.md`'s CSRF section and
  `packages/api/src/routers/quotes.ts`'s comments.
- Image upload — a file over 8 MB is rejected with a readable message, not a
  generic 500; an unauthenticated upload attempt is rejected before the file is
  even read.

## CI

**What CI runs today:** `.github/workflows/verify.yml` runs `pnpm verify`
(lint, typecheck, unit tests, build) on every pull request and on pushes to
`main`. It needs **no secrets**, reaches no external service, and is granted
only `contents: read`. Node comes from `engines.node`'s declared floor and pnpm
from `packageManager`; install uses `--frozen-lockfile` with the pnpm store
cached.

The one env it sets is a pair of throwaway `postgresql://user:pass@localhost`
placeholders, because Prisma resolves `env()` in the datasource block even for
`generate` (it fails with P1012 otherwise) — nothing connects, and no database
exists in that job.

### Required pre-deployment checks — NOT in CI

`pnpm test:integration` and `pnpm test:e2e` are **deliberately excluded** from
the public PR workflow. Both need a real migrated database and a real Supabase
Storage bucket, which means real credentials, and `pull_request` runs on forks:
putting those secrets in this workflow would hand every fork author write access
to that infrastructure.

They are not optional, though. **Both must pass before any deploy**, run by hand
or by a protected workflow, against an environment whose database and Supabase
project belong to that environment alone:

| Check | Command | Needs |
|---|---|---|
| Router + storage integration | `pnpm test:integration` | migrated database, Supabase Storage bucket |
| Full browser end-to-end | `pnpm test:e2e` | the above, plus all three apps running |

Never point either at a shared or production project: `test:integration` writes
real rows, and the storage tests upload and delete real objects. Note also that
objects the storage tests delete stay in Supabase's CDN cache for the
`cacheControl` TTL — see `docs/known-issues.md` KI-1 — which is another reason
a throwaway project per environment matters.

**When these are automated**, they belong in a separate workflow that is
manually dispatched (`workflow_dispatch`) and bound to a protected GitHub
**environment**, so its secrets are unavailable to `pull_request` runs and to
forks, and can require a reviewer before they are released to the job.
`docs/deployment.md` lists both commands in the deploy sequence.
