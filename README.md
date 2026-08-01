# Buildanta

Construction-materials catalog for the Indian market. Browse by **build stage**,
by **room**, or by **category**; request bulk quotes on a set of products.

This is a rebuild, not a refactor of the existing buildanta.com prototype. It
keeps that site's product thinking — the three browse axes are genuinely good —
and corrects its architecture, database and workflow problems.

## Release scope

**Release 1 (this repository)**

- Public storefront: categories, brands, rooms, build stages
- Product and product-variant pages
- Search, filtering and sorting
- Admin login and catalog CRUD
- Product-image upload
- Supplier records
- Bulk quote requests, with an admin inbox

**Deliberately not built yet:** payments, delivery integrations, multiple
warehouses, stock levels, granular permissions, returns, seller self-onboarding.
Those are Releases 2–4. No table or column in this repository anticipates them —
speculative columns are how the previous schema drifted.

## What the live prototype gets wrong, and what this does instead

These were found by working through buildanta.com page by page.

| Live site | Here |
|---|---|
| `/login` and `/signup` are in the header on every page and both return **404** | Admin auth is real: Argon2id hashes, server-side sessions, rate-limited login |
| Every listing page renders `Loading products…` forever; no product, price or SKU appears anywhere | Products render server-side from Postgres |
| Taxonomy **contradicts itself**: 10 stages on the homepage vs 7 in the footer, 6 rooms vs 5, and three different category lists | Taxonomy lives in the database and every menu is generated from it, so no two pages can disagree |
| Stage and room tiles carry **no slug** — all ten link to the same `/by-stage`, so no filtered view is addressable | `/stages/[slug]` and `/rooms/[slug]` are real pages; every filter combination is a linkable URL |
| Slugs contain a double-hyphen artefact from stripping `&`: `tiles--flooring`, `sanitaryware--bathware` | `slugify` collapses separators; the `slug` schema rejects anything else |
| "Get Bulk Quotes" is marketing copy with no form | A working quote request form and an admin inbox |
| No `robots.txt`, no `sitemap.xml` | Both generated from the live catalog |

## Layout

```text
apps/
├── storefront/   Next.js public site (port 3000)
├── admin/        Next.js catalog admin (port 3001)
└── api/          Fastify host for the tRPC router (port 4000)

packages/
├── db/           Prisma schema, client, seed
├── api/          The single tRPC router + Zod schemas
└── auth/         Password hashing and session tokens
```

There is **one** public application, not the `web` + `store-web` pair the old
repository carried.

### One API contract

`packages/api` defines every procedure once. Both web apps import the router's
*type* and get end-to-end type safety with no generated client and no
hand-written fetch layer, so a renamed procedure is a compile error rather than a
runtime 400. `packages/api/src/client.ts` is the browser-safe entry point — it
deliberately pulls in no server module, so Prisma and sharp never reach a browser
bundle.

## Getting started

Requires Node 20.11+, pnpm 9, and a Postgres instance — either Docker, running
locally, or a Supabase project (the latter is also where product images are
stored; see below).

```bash
cp .env.example .env
```

Generate a session secret and paste it into `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**Database.** Either:

- Local Docker — `pnpm setup` installs dependencies, starts Postgres via
  `docker-compose.yml`, runs migrations and seeds the catalog, all in one
  command. Skip straight to `pnpm dev` below.
- Supabase — paste the project's connection strings into `DATABASE_URL` /
  `DIRECT_URL` yourself (see the comments in `.env.example` for exactly which
  string goes where), then run `pnpm install && pnpm db:generate && pnpm
  db:migrate && pnpm db:seed`.

**Image storage.** Always Supabase Storage, regardless of which option above
you picked for the database — paste `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` into `.env` from the *same* Supabase project's
**Settings → API** page (`SUPABASE_URL` is not secret; the service role key
is — never commit it, never send it to a browser). The bucket named by
`SUPABASE_STORAGE_BUCKET` is created automatically the first time `apps/api`
starts.

Then:

```bash
pnpm dev
```

- Storefront: http://localhost:3000
- Admin: http://localhost:3001 (sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)
- API health: http://localhost:4000/health

Seeded products have no images. Publishing requires at least one image, so
uploading one in the admin is how you exercise that path.

Before opening a PR, run:

```bash
pnpm verify           # lint, typecheck, unit tests, build — every workspace,
                       # fully database-independent
pnpm test:integration # the admin-to-storefront flow against a real database
pnpm test:e2e         # the same flow through real browser pages, Playwright
```

The last two need `DATABASE_URL`/Supabase Storage actually configured and
reachable; `pnpm test:e2e` additionally starts (or reuses) all three apps'
dev servers automatically. See `docs/testing.md` for what each tier covers
and why they're kept separate from `pnpm verify`.

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — how the pieces fit together, and
  why tRPC end-to-end instead of a separate REST tier.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — workflow, schema changes, testing
  expectations.
- **[docs/requirements.md](docs/requirements.md)** — the Release 1 user
  stories and their acceptance criteria.
- **[docs/database.md](docs/database.md)** — every non-obvious column, and
  what's missing relative to the planning documents.
- **[docs/authentication.md](docs/authentication.md)** — the session and
  CSRF model, and why it isn't Supabase.
- **[docs/testing.md](docs/testing.md)** — what's covered, what isn't, and why.
- **[docs/known-issues.md](docs/known-issues.md)** — measured, reproducible
  limitations with a definition of done for each. Read **KI-1** before relying
  on image deletion for anything time-sensitive: removing an image does not
  immediately stop its public URL from serving.
- **[docs/deployment.md](docs/deployment.md)** — what production needs that
  isn't built yet.

## Design decisions worth knowing

**Money is `Decimal(12,2)` with an explicit currency, never a float.** Prices
cross the wire as strings; `Decimal` handed to a JSON serializer arrives as `{}`.
Everything read from the database passes through
`packages/api/src/serializers.ts`, which is the only place that conversion
happens.

**Sales unit is an enum on the variant.** Cement sells by the bag, steel by the
tonne, tile by the box, wire by the roll. Getting this wrong is the classic
construction-catalog bug, so it is not free text.

**Products are retired with a status, not deleted.** A product that has ever been
published can only be archived, because Release 2 orders will reference it.

**One denormalization, documented:** `Product.minPrice` / `maxPrice`. Sorting and
filtering by price operate on the minimum active variant price, which Prisma
cannot express as a relation aggregate. `recomputeProductPricing()` is the only
writer and runs inside the same transaction as every variant change.

## Known limitations

- **Search is substring matching** (`ILIKE`) across product name, summary and
  SKU. Ranked full-text search deserves a `tsvector` column and a GIN index, and
  is scheduled rather than half-built.
- **The rate limiter is in-process memory.** Correct for one API process; swap
  the map in `packages/api/src/rate-limit.ts` for Redis before scaling out.
- **The storefront renders per request.** ISR is the right end state for a
  catalog but requires the API to be reachable during `next build`, which is a
  deployment decision. See the note in `apps/storefront/lib/api.ts`.

Product images are stored in Supabase Storage (not local disk — that was a
Release 1 placeholder, since replaced), served directly from Supabase's own
CDN. See `docs/deployment.md` for why staging and production each need their
own Supabase project, not just their own database.
