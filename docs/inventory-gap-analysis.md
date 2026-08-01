# Inventory management — gap analysis and phased plan

Measures [project-context.md](project-context.md) against what this repository
actually contains today, then proposes an order of work.

**Nothing here is implemented yet. This is for review.**

Every "exists today" claim below was checked against
`packages/db/prisma/schema.prisma` and the routers in `packages/api/src`, not
recalled. Field and enum names are quoted from the schema.

---

## 1. Headline finding

The catalogue-and-quotation half of the vision largely exists. **The inventory
half does not exist at all** — not partially, not stubbed. There is no stock
quantity anywhere in the schema, no stock transaction table, no audit history, no
low-stock concept, and no inventory valuation. Sections 7, 17 and most of 5 of
the context document are greenfield.

The second structural gap is **roles**. `enum AdminRole` has exactly one value,
`ADMIN`. The context document describes five roles with genuinely different
capabilities — notably a catalogue editor who must *not* see purchase prices or
change stock. That is an authorization model, and retrofitting one after the
procedures exist is materially harder than building it with them.

A useful way to hold it: the current system answers *"what do we sell?"*. The
target system also answers *"what do we have, what did it cost, and who touched
it?"* — and that second question is what the inventory dashboard is for.

## 2. What already exists and needs no work

| Vision | Where it lives today |
|---|---|
| Multi-level category tree | `Category.parentId` self-relation — arbitrary depth, so three levels need no migration |
| Product / variant split | `Product` (editorial) + `ProductVariant` (SKU, price, unit) |
| Brands, rooms, construction stages | `Brand`, `Room`, `ConstructionStage`, with `ProductRooms` / `ProductStages` joins |
| Browse by stage and by room | `/stages/[slug]`, `/rooms/[slug]` on the storefront |
| Product images with ordering and alt text | `ProductImage` + Supabase Storage, sequence and alt text editable |
| Draft vs published, hidden from public | `ProductStatus` + every public query filtering on it, proven by `products.integration.test.ts` |
| Search across name, summary, SKU | `products.search` (ILIKE) |
| Filter by category, brand, stage, room, price | `catalog-results.tsx` + `filter-panel.tsx` |
| Bulk quote requests with reference numbers | `QuoteRequest`, `QuoteRequestItem`, `QuoteReferenceCounter` |
| Admin quote inbox | `/quotes` and `/quotes/[id]` |
| Sales unit as an enum, not free text | `SalesUnit` — 12 values including BAG, TONNE, CUBIC_METRE |
| Money as `Decimal(12,2)` with currency | `ProductVariant.price` / `currency` |
| Supplier records linked to variants | `Supplier` ← `ProductVariant.supplierId` |
| Server-side authorization on every admin write | `adminProcedure` in `packages/api/src/trpc.ts` |

## 3. Gaps, by size

### 3.1 Absent entirely — needs new tables

| Vision (context §) | Gap |
|---|---|
| Stock quantity (§6, §7) | No stock field exists on `ProductVariant` or anywhere else |
| Stock transactions (§7) | No table. Needs product+variant, quantity delta, previous and updated stock, type, reason, supplier/customer reference, invoice or challan number, staff member, timestamp |
| 8 transaction types (§7) | No enum. Purchased, received, customer sale, damaged, returned, manual correction, supplier return, reserved |
| Never below zero unless an admin authorizes (§7) | No constraint, and no override path |
| Low-stock threshold and alerts (§7) | No threshold field, no alert surface |
| Reserved / discontinued states (§7) | No representation |
| Inventory audit history (§19.13) | No table |
| Inventory valuation (§7, §17) | Impossible today: needs both stock quantity and purchase price, neither of which exists |
| 11 reports (§17) | None; and most are unanswerable until stock and purchase price exist |
| Five roles (§14) | `AdminRole` has one value |
| Customer accounts (§14) | No customer user model — quotes are submitted anonymously |
| PIN-code availability (§2, §11) | No service-area or pincode model |
| Calculators (§16) | Not built |
| BOQ upload (§12) | `QuoteRequest` has no file attachment |
| Delivery date on a quote (§12) | No field |
| WhatsApp ordering (§19.10) | No integration |
| Policy pages (§18) | Not written |
| Featured products (§5) | No flag |
| SEO title/description per category and product (§5) | No fields |
| Category icon or image (§5) | `Category` has no image |
| Customer reviews, construction guides (§9) | Not built |

### 3.2 Exists but too narrow — needs migration or extension

| Area | Today | Target |
|---|---|---|
| Product status | `DRAFT`, `ACTIVE`, `ARCHIVED` | Adds **HIDDEN** — published-but-withdrawn, distinct from never-published and from archived |
| Quote status | `NEW`, `IN_REVIEW`, `QUOTED`, `WON`, `LOST`, `CLOSED` | Nine states, splitting *price requested from supplier*, *quotation prepared* and *sent to customer*, and *converted to order* |
| Pricing | One `price` per variant | **Purchase price, selling price, bulk price**, plus GST percentage. Purchase price is role-restricted — see §14 |
| Supplier | Contact, address, notes, active | Adds GST number, payment terms, delivery lead time, minimum order quantity, supplied brands and categories |
| Supplier ↔ product | One optional `supplierId` per variant | **Many-to-many** — "one or more suppliers", each with its own purchase price and lead time |
| Minimum order quantity | Absent | Per product and per variant |
| Delivery info | Absent | Availability, time, return eligibility |
| Variant attributes | Free-form `attributes` JSON | Named size / colour / grade / material, to make §11's size and grade filters real rather than JSON scans |
| Upload limit | 8 MB | Context says 5 MB practical maximum — a deliberate decision, not a bug |

### 3.3 A correctness question worth settling before any of it is built

**Does published stock availability need to be transactionally consistent with
the storefront?** Today `Product.minPrice` is denormalized and recomputed inside
the same transaction as any variant change — that pattern works because price
changes are rare and admin-driven. Stock changes are frequent, and if the
storefront shows "in stock" from a denormalized column, that column is wrong for
as long as the recompute lags.

This decides the shape of the stock feature, so it should be answered first, not
discovered. My recommendation: derive availability from the transaction ledger
inside a request rather than caching a status column, and only denormalize once
there is a measured performance reason. A wrong "in stock" badge costs a customer
call; a slightly slower query does not.

## 4. Phased plan

Each phase is independently shippable and leaves the system working. Phases 1–3
are the ones that unlock §20's success definition.

### Phase 0 — Decisions needed from you

No code. These change the design, so they are worth ten minutes now:

1. **Stock consistency** — ledger-derived or denormalized column? (§3.3; I
   recommend ledger-derived.)
2. **Purchase price visibility** — confirm catalogue editors and sales staff must
   never see it. This is what forces real roles rather than UI hiding.
3. **Stock unit vs sales unit** — is stock counted in the same `SalesUnit` the
   variant sells in, or in a base unit with `packSize` conversion? Cement sold by
   the bag but stocked by the pallet is the case that breaks a naive answer.
4. **Negative stock override** — which role may authorize it, and must a reason
   be mandatory?
5. **GST** — one rate per product, or per variant? Inclusive or exclusive
   display?

### Phase 1 — Roles and permissions

First, because every later phase needs to ask "may this person do this?", and
adding that question afterwards means revisiting every procedure.

- Extend `AdminRole` to the five roles; add a per-role capability map
- Enforce in `packages/api/src/trpc.ts` as role-aware procedure builders, so
  authorization is a property of the procedure, not a check someone remembered
- Hide what a role cannot use in the admin UI **in addition to** the server check
- Integration tests per role per procedure, including negative cases: a catalogue
  editor is refused a purchase-price read and a stock write

### Phase 2 — Stock foundation

- `StockTransaction` table with the full §7 field list, plus its type enum
- Availability derived from it (per Phase 0's answer)
- Every mutation in one transaction with row-level locking, matching the
  `SELECT … FOR UPDATE` pattern the variant and image routers already use — a
  concurrent sale and correction must not interleave into a wrong balance
- Non-negative enforcement, with an explicit authorized-override path
- Low-stock threshold per variant, and the four availability states
- Integration tests for concurrency, for the zero floor, and for ledger/balance
  agreement

### Phase 3 — Commercial fields and the product editor

- Purchase / selling / bulk price, GST, minimum order quantity, delivery fields,
  featured flag, `HIDDEN` status
- Supplier extensions and the many-to-many supplier link with per-supplier
  purchase price and lead time
- Product editor extended to match §5, respecting Phase 1 roles
- Storefront shows availability and honours `HIDDEN`

At the end of Phase 3, §20's success definition is met.

### Phase 4 — Dashboard, alerts and audit history

- Dashboard overview tiles (§7), including inventory valuation
- Low-stock and out-of-stock alerts
- Inventory audit history view over the Phase 2 ledger
- Recent-changes and recently-added feeds

### Phase 5 — Reports and export

- The eleven §17 reports, date-filterable, CSV export
- Deliberately after Phase 4: reports are read models over Phase 2's ledger, and
  building them earlier means rewriting them

### Phase 6 — Customer-facing expansion

- PIN-code service areas and availability filtering
- Calculators, with "add to quotation"
- BOQ upload and delivery date on quotes
- Nine-state quote workflow
- WhatsApp and phone flows
- Policy pages
- Customer accounts and saved products

### Phase 7 — Search quality

- Replace ILIKE with a `tsvector` column and GIN index
- Synonyms, so "sariya" finds TMT bars — already a stated requirement in §11 and
  the reason ranked search cannot stay deferred forever

## 5. Cross-cutting notes

- **Migrations:** phases 2 and 3 add columns to `product_variants` and new
  tables. Both are additive; no destructive migration is currently foreseen. Any
  that becomes necessary gets flagged for approval before it is written.
- **Test tiers:** each phase extends the existing three tiers. Stock concurrency
  in particular belongs in `test:integration`, since it needs a real database to
  mean anything — a mocked transaction cannot demonstrate a lost update.
- **`docs/known-issues.md` KI-1** (deleting an image does not revoke its public
  URL) is unrelated to inventory but still open, and Phase 3 touches image
  handling — worth resolving in the same pass.
- **Estimates:** deliberately not given. I have no basis for honest ones here,
  and invented numbers would only anchor a plan badly.
