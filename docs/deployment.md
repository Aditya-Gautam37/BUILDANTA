# Deployment

Not yet done — this records what's decided and what's still open, per
`BUILD_FROM_SCRATCH.md` §12–14's guidance to plan environments and production
requirements explicitly rather than discover them at deploy time.

## Deployment units

Five independently deployable pieces, matching `apps/*` and the two Supabase
services:

```text
apps/storefront      → any Next.js host (Vercel, or a Node server)
apps/admin           → same, but must never be publicly indexed (already
                        handled: X-Robots-Tag header + noindex metadata, see
                        next.config.mjs)
apps/api             → a persistent Node process (Fastify does not run on most
                        serverless platforms in its current form)
Supabase Postgres    → nothing here assumes Supabase specifically at the
                        database layer; any Postgres 16+ works, pooled or not
Supabase Storage     → product images. Assumed specifically — see below.
```

## Environment variables per environment

Development, staging and production each need their own `.env` — never point a
local checkout at a staging or production `DATABASE_URL`, and never point two
environments at the *same* Supabase project. See `.env.example` for the full
list; the ones that must differ per environment:

- `DATABASE_URL` / `DIRECT_URL` — separate database per environment, always. If
  the provider pools connections (Supabase, PgBouncer), `DATABASE_URL` is the
  pooled string for the app and `DIRECT_URL` is the unpooled one `prisma
  migrate` needs — see `.env.example` for both forms.
- `SESSION_SECRET` — a distinct 32+ byte value per environment. Never reuse the
  development value anywhere else.
- `CORS_ORIGINS` — the real storefront and admin origins for that environment,
  not `localhost`.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` — a
  **separate Supabase project per environment**, the same way the database is
  separate. Staging and production sharing one project would mean a staging
  test upload lands in the same bucket real product photos do, and a leaked
  staging credential would grant full access (`service_role` bypasses every
  storage policy) to production's files. This key is server-only — it must
  never reach `NEXT_PUBLIC_*` or any browser bundle.

## What production needs that this repository does not yet provide

- **Transactional email.** Quote submissions and admin invitations (once
  invitations exist) need to send mail. Nothing sends mail today — a submitted
  quote's confirmation is the reference number shown in the browser, not an
  email, and that is a Release 2 gap, not a Release 1 one (Release 1's scope
  never included email — see `PROJECT_CONTEXT.md` §22.1).
- **Error and performance monitoring.** Fastify logs to stdout via `pino`
  (structured, redacting cookies and auth headers — see `apps/api/src/app.ts`)
  but nothing aggregates or alerts on those logs yet.
- **Database backups and a tested restore.** Not configured. This is the one
  item on this list that should exist before any real data is stored, per
  `BUILD_FROM_SCRATCH.md` §15's pre-launch checklist. Supabase Storage's own
  backup story is a separate question from Postgres's — confirm both.
- **A CDN purge path for deleted images.** Measured, not theoretical: deleting
  an object from Supabase Storage removes it from the bucket immediately, but
  the public URL keeps serving the old bytes with a 200 from Supabase's CDN
  until the `cacheControl` TTL expires — and `save()` sets that to 30 days.
  Deleting an image in the admin therefore does *not* make it stop being
  publicly fetchable by anyone holding the URL. That is fine for replacing a
  product photo; it is not fine for a takedown (a wrong product, a supplier's
  copyrighted image, anything with a legal deadline). Either shorten the TTL,
  or add an explicit cache-purge call to `remove()` before that case is real.
  `packages/api/src/storage.integration.test.ts` documents the behaviour, and
  **`docs/known-issues.md` KI-1** tracks it with a definition of done.
- **A migration deploy step.** `pnpm db:migrate` runs `prisma migrate dev`,
  which is a development command — it can create a migration interactively.
  Production must run `pnpm db:migrate:deploy` instead (wraps
  `prisma migrate deploy`), as a controlled step before the API starts, never
  interactively.

## What production now has that it didn't before this review

**Object storage for uploads** — done. Product images are stored in Supabase
Storage (`packages/api/src/storage.ts`), not local disk; the bucket is created
automatically and idempotently on API startup (`ensureBucketExists()`, called
from `apps/api/src/server.ts`) as a public bucket, matching how uploads were
already served with no auth under the old local-disk implementation. Confirmed
working end to end: a real image uploaded through the multipart route,
re-encoded to WebP by `sharp`, fetched back from Supabase's own CDN URL, and
rendered on both the admin and storefront apps.

**Automated test coverage for the flows a deploy should never break** — three
tiers now exist, each gated appropriately:

- `pnpm test` (unit, in `pnpm verify`) — pure functions, no network.
- `pnpm test:integration` — the admin-create → draft-hidden → publish →
  visible → archive-hidden flow and the auth boundary either side of it,
  against a real database, via direct router calls.
- `pnpm test:e2e` (Playwright) — the same flow end to end through the actual
  rendered pages of all three apps together: admin login (valid, invalid, and
  the redirect-when-signed-out case), the full product lifecycle including a
  real file upload through a real `<input type="file">`, storefront
  visibility at each step, editing, archiving, quote submission through the
  storefront basket and form, and CORS/CSRF/cookie behaviour exercised against
  the real running Fastify app in `apps/api/src/app.test.ts`.

None of the three require the others to be green — see each one's own config
comment for why (`pnpm test` and `pnpm verify` are fully database-independent;
`test:integration` and `test:e2e` each need a real, migrated, Supabase-backed
database, and `test:e2e` additionally needs all three apps' dev servers,
which its own `playwright.config.ts` starts or reuses automatically).

## Suggested sequence, once the remaining gaps above are closed

Following `BUILD_FROM_SCRATCH.md` §13:

`pnpm verify` is enforced automatically on every pull request and on pushes to
`main` by `.github/workflows/verify.yml`. The two steps below that need real
infrastructure — `pnpm test:integration` and `pnpm test:e2e` — are **required
pre-deployment gates that CI does not run**, because the public PR workflow
holds no credentials by design (see `docs/testing.md`). Someone has to run them,
or a manually-dispatched workflow bound to a protected environment does.

```text
pnpm verify (lint, typecheck, unit tests, build)  ← automated in CI
  → deploy database migration (prisma migrate deploy)
  → confirm the target environment's Supabase Storage bucket and credentials
    are genuinely separate from every other environment's
  → deploy apps/api
  → confirm GET /health returns 200
  → deploy apps/admin and apps/storefront
  → pnpm test:integration and pnpm test:e2e against the newly deployed
    environment, not just against production before it existed
  → smoke test by hand: sign in to admin, publish a product, confirm it on
    the storefront, submit a quote
  → monitor logs for the first few minutes
```

Keep the previous release deployable for rollback, per
`BUILD_FROM_SCRATCH.md` §16.
