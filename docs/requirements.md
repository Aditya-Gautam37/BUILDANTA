# Requirements

Both planning documents (`BUILD_FROM_SCRATCH.md` §1–2, `PROJECT_CONTEXT.md`
§22.1) call for user stories written before implementation. This is the
Release 1 set, extracted from what was actually built, plus the acceptance
criteria each feature was implemented against. Written after the fact for this
release — new features should have their story written first, per
`BUILD_FROM_SCRATCH.md` §2.

## User stories

### Customer: browse by build stage

> As a customer, I want to browse products by construction stage so that I can
> find what I need for the phase of the build I'm currently on.

- **Permissions:** none (public).
- **Validation:** the stage slug in the URL must match a real, active stage;
  an unknown slug renders 404, not an empty page pretending to be valid.
- **Success:** `/stages/[slug]` shows every ACTIVE product tagged with that
  stage, filterable further by brand, room, unit and price, sortable, paginated.
- **Error:** if the API is unreachable, the storefront's `error.tsx` explains
  that plainly rather than showing a generic Next.js error screen.
- **Acceptance criteria:**
  - Every stage has its own linkable URL. *(This is the direct fix for the live
    prototype's defect: all ten stage tiles pointed at one `/by-stage` URL with
    no slug — see README.md's comparison table.)*
  - Stages render in build chronology (`sortOrder`), not alphabetically.
  - A stage with zero products is hidden from navigation, not linked to an
    empty page.

### Customer: filter and sort the catalog

> As a customer, I want to filter products by brand, room, stage, unit and price
> so that I only see options relevant to my project.

- **Validation:** every filter value is validated against the same Zod schema
  the server enforces (`packages/api/src/schemas.ts` `productQuery`); an
  invalid value in a hand-edited URL is dropped, not passed through to a query
  that would error.
- **Success:** the result count and every filter option's count reflect the
  *other* active filters, so selecting one brand doesn't zero out every other
  brand's count.
- **Acceptance criteria:**
  - Every filter combination is a real URL (`buildProductUrl`,
    `apps/storefront/lib/search-params.ts`) — shareable, bookmarkable, and
    correct on browser back/forward.
  - Filtering, sorting and pagination work with JavaScript disabled (filters
    are links and GET forms, not client-side state).

### Customer: view a product and its variants

> As a customer, I want to see a product's price, unit, specifications and
> photos, and switch between its variants, so that I know exactly what I'd be
> ordering.

- **Validation:** a request for a DRAFT or ARCHIVED product's slug returns 404,
  even to a visitor who guesses the exact slug.
- **Success:** the default variant is pre-selected; switching variants updates
  price, SKU and images without a full page navigation feel (it is a link with
  `?variant=`, so it *is* a navigation, but a fast one).
- **Acceptance criteria:**
  - A product with no images renders a labelled placeholder, not a broken
    image tag.
  - A product with one variant hides the variant picker and the "all options"
    table — they would show one row of nothing new.

### Customer: request a bulk quote

> As a customer, I want to add several products to a request and submit my
> contact details once, so that I get a single quote for a whole project instead
> of calling about each item separately.

- **Permissions:** none (public), but rate-limited per IP.
- **Validation:** every line's price, SKU, unit and product name are read from
  the database at submission time, never trusted from the client — see
  `packages/api/src/routers/quotes.ts`.
- **Success:** the buyer receives a human-readable reference (`BQ-2026-0007`)
  immediately; the request appears in the admin inbox with the same reference.
- **Error:** a variant that was withdrawn between being added to the basket and
  submission is called out by name, not silently dropped from the total.
- **Acceptance criteria:**
  - *(This is the direct fix for the live prototype's defect: "Get Bulk Quotes"
    was a heading with no form behind it.)*
  - A request can hold up to 50 lines; the form and the server enforce the same
    limit.
  - The basket survives a page reload (stored client-side) but is never treated
    as a source of truth for price.

### Staff: sign in

> As a staff member, I want to sign in with an email and password so that I can
> manage the catalog and the quote inbox.

- **Validation:** email and password are both required; the error for a wrong
  password and a nonexistent account is identical, and takes the same time to
  return (`fakeVerifyPassword`) — see `docs/authentication.md`.
- **Success:** a session cookie is set; five failed attempts in fifteen minutes
  from either the same IP or the same email locks out further attempts.
- **Acceptance criteria:**
  - A deactivated account's existing sessions stop working on the very next
    request, not at their natural expiry.
  - `?next=` after login only follows a same-app relative path — it cannot be
    turned into an open redirect.

### Staff: create and publish a product

> As a staff member, I want to create a product as a draft, add its variants and
> photos, and then publish it, so that nothing incomplete ever appears to a
> customer.

- **Permissions:** any active admin account (single role in Release 1).
- **Validation:** a product cannot be created directly as ACTIVE; publishing is
  refused unless the product has at least one active, priced variant and at
  least one image.
- **Success:** publishing sets `publishedAt` once and never overwrites it on a
  later status change.
- **Acceptance criteria:**
  - Deactivating a product's last active variant automatically returns the
    product to DRAFT — a published product cannot end up with no price.
  - A product that has ever been published can be archived but not deleted; a
    draft that was never published can be deleted, and its images are cleaned
    up from disk.

### Staff: manage the quote inbox

> As a staff member, I want to see every quote request, filter by status, assign
> one to myself, and record what happened, so that nothing is lost between
> submission and a phone call back.

- **Success:** the status tabs show a true count across the whole inbox, not
  just the currently filtered view.
- **Acceptance criteria:**
  - Setting status to QUOTED stamps a response timestamp once; a later status
    change does not reset it.
  - Internal notes are never exposed to any public procedure.

## What Release 1 explicitly does not cover

Both planning documents list more than this release builds. The exclusions are
deliberate, not overlooked — see
[ARCHITECTURE.md § Known architectural gaps](../ARCHITECTURE.md#known-architectural-gaps)
for the ones worth tracking, and the open question in the project notes about
`BUILD_FROM_SCRATCH.md` §1's inclusion of stock management in the *first*
release, which conflicts with `PROJECT_CONTEXT.md`'s release phasing (stock is
Release 3 there).
