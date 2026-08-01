# Architecture

## Applications

```text
apps/
├── storefront/   Public Next.js app (port 3000). Server-rendered, no auth.
├── admin/        Staff Next.js app (port 3001). Client-rendered behind a session.
└── api/          Fastify host for the tRPC router (port 4000).
```

There is one public application, not the `web` + `store-web` pair the prototype
carried — see the table in [README.md](README.md) for why that pair existed and
why it was collapsed.

## Packages

```text
packages/
├── db/     Prisma schema, generated client, seed.
├── api/    The single tRPC router, Zod schemas, serializers. Server-only.
└── auth/   Password hashing (Argon2id) and session tokens. No I/O.
```

`packages/api` has two entry points:

- `@buildanta/api` — the router, context, and everything that touches Prisma or
  the filesystem. Imported only by `apps/api`.
- `@buildanta/api/client` — types, Zod input schemas (as values, so forms
  validate with the exact rules the server enforces), and display formatters.
  Imported by both web apps. Pulls in no server module, so Prisma and sharp
  never reach a browser bundle.

## Request flow

**Storefront (public reads):**

```text
Server Component
  → @buildanta/api/client (types only)
  → tRPC HTTP batch link
  → apps/api (Fastify)
  → adminProcedure / publicProcedure
  → Prisma
  → PostgreSQL
```

Every storefront page is a Server Component; the API URL and any credentials
never reach the browser for a catalog read. The one exception is the quote
basket (`components/add-to-quote.tsx`, `components/quote-request-form.tsx`),
which runs in the browser because it needs `localStorage`. It talks to
`apps/storefront/app/api/trpc/[trpc]/route.ts`, a same-origin proxy with an
explicit allowlist of two procedures — `catalog.products.variantsByIds` and
`quotes.submit` — so it cannot become a tunnel to the rest of the router.

**Admin (authenticated reads and writes):**

```text
Client Component
  → @trpc/react-query hooks (apps/admin/lib/trpc.ts)
  → tRPC HTTP batch link, credentials: "include"
  → apps/api (Fastify)
  → adminProcedure
  → Prisma
  → PostgreSQL
```

Every procedure under `admin.*` is built from `adminProcedure`
(`packages/api/src/trpc.ts`), which requires a valid session and cannot be
constructed without that check — a new endpoint added under the wrong
namespace is a type error, not a missing guard someone forgot.

## Why tRPC end-to-end, not a separate REST tier

`BUILD_FROM_SCRATCH.md` §6 and `PROJECT_CONTEXT.md` §23.2 both raise this
question. The recommended default in both documents is NestJS with a generated
REST client; both also name the condition under which a direct tRPC backend is
the right call instead: TypeScript-only clients, and no separate service
needed for its own sake.

Buildanta has two clients (storefront, admin), both TypeScript, both first-party.
Nothing here needs a REST contract for a third-party or non-TS consumer, and
there is no NestJS-shaped business logic that both clients would otherwise
duplicate — `packages/api` already is that shared layer. Introducing NestJS
would add a second framework and a client-generation step without removing any
duplication that currently exists.

**This is a decision to revisit, not a closed one.** If a mobile app, a public
API for third parties, or a partner integration shows up, the router in
`packages/api/src/root.ts` is the seam: it can be re-hosted behind NestJS
controllers that call the same procedures, without touching the procedures
themselves.

## Sessions and CSRF

Admin auth is cookie-based, not Supabase:

- `packages/auth` hashes passwords with Argon2id and generates session tokens.
- `apps/api` stores only the SHA-256 of the token (`packages/api/src/context.ts`),
  signs the cookie, and sets `httpOnly`, `secure` (in production), `sameSite: lax`.
- Every mutation must carry an `x-buildanta-client` header and pass an `Origin`
  allowlist check (`apps/api/src/server.ts`) — a classic cross-site form post
  cannot set a custom header, so this is the CSRF defence.

See [docs/authentication.md](docs/authentication.md) for the full flow and why
Supabase was not used for Release 1.

## Data flow for a write: publishing a product

```text
Admin fills the product form
  → client-side Zod validation (same schema as the server)
  → admin.products.setStatus mutation
  → adminProcedure checks the session
  → server-side Zod validation (same schema, enforced again)
  → precondition check: ≥1 active variant, ≥1 image
  → Prisma transaction: update status, set publishedAt once
  → response
  → React Query cache invalidated, UI reflects the new status
```

The precondition check is why publishing is a separate procedure
(`admin.products.setStatus`) from `admin.products.update`: it is the one
catalog action with a customer-visible consequence, and it is not a plain field
edit that a future contributor might edit without knowing to add the check.

## Known architectural gaps

Tracked here rather than silently accepted — see
[README.md § Known limitations](README.md#known-limitations) for the runtime
ones (search, rate limiting, ISR). The structural ones:

- **`Product.categoryId` is a single required FK**, not a many-to-many. Both
  planning documents describe a product belonging to multiple categories.
  Changing this is a schema migration, not a refactor, and has not been done —
  see the open question in the project's working notes.
- **No `AuditLog`, no `createdBy`/`updatedBy`/`archivedAt`.** `PROJECT_CONTEXT.md`
  §25.7 recommends both for Release 1; only `createdAt`/`updatedAt` exist today.
- **Roles: one (`ADMIN`)**, not `PROJECT_CONTEXT.md` §23.5's five. Consistent
  with `PROJECT_CONTEXT.md` §22.1 ("complex permissions" deferred), not with
  §23.5 itself.
