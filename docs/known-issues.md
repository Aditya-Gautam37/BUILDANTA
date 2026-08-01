# Known issues

Tracked limitations that are **measured and reproducible**, not suspicions. Each
has an owner-facing consequence and a concrete definition of done, so it can be
closed deliberately rather than forgotten. Raise these as issues in the tracker
if one is adopted; until then this file is the record.

---

## KI-1 — Deleting a product image does not revoke its public URL

**Severity:** medium — becomes high the first time a takedown has a deadline.
**Status:** open. Behaviour is documented and tested; no fix attempted.

### What happens

Deleting an image through the admin removes the object from the Supabase
Storage bucket immediately. It does **not** stop the image being served. The
public URL keeps returning `200` with the old bytes from Supabase's CDN until
the `cacheControl` value set in `save()` — currently **30 days** — expires.

Measured directly against the live bucket:

| Step | Result |
|---|---|
| Upload, then fetch the public URL | `200`, `image/webp` |
| Delete the object | succeeds; bucket listing for the prefix returns 0 objects |
| Fetch the same public URL again | **`200`** — stale copy from CDN |
| Fetch with a cache-busting query string | `400` — origin confirms it is gone |

`packages/api/src/storage.integration.test.ts` asserts this honestly: its
post-delete check cache-busts the URL precisely because the plain URL still
succeeds. Do not "fix" that test by asserting the plain URL 404s — it will not.

### Why it matters

Fine for replacing a product photo: the old image lingering in cache is
harmless. Not fine for a **takedown** — a wrong product, a supplier's
copyrighted photograph, a mislabelled safety spec, anything with a legal or
contractual deadline. Anyone who already has the URL, or who scraped it, can
keep fetching the image for up to 30 days after an admin believes they deleted
it. Nothing in the admin UI tells them that.

### Definition of done

One of:

1. `remove()` in `packages/api/src/storage.ts` issues an explicit CDN purge
   after deleting the object, and the integration test asserts the plain
   (non-cache-busted) URL stops serving; **or**
2. `cacheControl` in `save()` is reduced to a window short enough for the
   business to accept as a takedown delay, documented as an accepted risk with
   the agreed number; **or**
3. Product images move behind signed, expiring URLs, which makes revocation a
   property of the link rather than of the cache.

Whichever is chosen, the admin UI should stop implying that deletion is
instant if it is not.

---

## KI-2 — The E2E suite runs against dev servers, so it inherits cold-compile flake

**Severity:** low — affects test reliability, not the product.
**Status:** open. Worked around with raised timeouts.

`apps/e2e` drives `next dev`, where each route compiles on first visit.
Measured: a `router.replace` into `/products/[id]` fetched its RSC payload in
about a second and then waited **13.7s** for that route's page chunk, because
the route had never been compiled in that server's lifetime. The client-side
transition — and therefore the URL — cannot commit until the chunk arrives, so
assertions fail for reasons unrelated to the application.

Worked around by raising the timeouts in `playwright.config.ts` well above
Playwright's defaults. That is a mitigation, not a fix: the next
never-yet-visited route will find the new ceiling.

**Definition of done:** the suite runs against production builds (`next build`
then `next start`) so no route compiles on demand, and the timeouts come back
down to something close to default. Not done here because it changes what the
harness must build before it can run.

### Related operational note, not a bug

Do not edit source files while `pnpm test:e2e` is running. Both web apps set
`transpilePackages: ["@buildanta/api"]`, so a write anywhere in that package
triggers a webpack rebuild and a Fast Refresh remount mid-test. That detaches
React event handlers and produces failures — clicks that do nothing, forms that
never submit — which look exactly like application bugs. Two such failures were
chased during this project's test hardening before the cause was identified.
