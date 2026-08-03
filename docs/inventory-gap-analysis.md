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
| Stock transactions (§7) | No table. Needs product+variant, quantity delta, previous and updated stock, type, reason, supplier/customer reference, invoice or challan number, staff member, timestamp — append-only per D1 |
| Balance table + reconciliation (D1) | Neither exists. Balances must be transactionally maintained and rebuildable/verifiable from the ledger |
| Base unit + conversion factors (D3) | No base inventory unit, no conversion factors |
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
| Pricing | One `price` per variant | **Purchase price, selling price, bulk price**, all tax-exclusive (D5). Purchase price is role-restricted and redacted from payloads (D2) |
| Tax | Nothing | `hsnSacCode` + `gstRate` on the product, optional variant override; GST calculated explicitly, never stored inclusive (D5) |
| Units | `SalesUnit` on the variant only | Adds a **base inventory unit** plus exact `Decimal` conversion factors, e.g. 1 pallet = 50 bags (D3) |
| Supplier | Contact, address, notes, active | Adds GST number, payment terms, delivery lead time, minimum order quantity, supplied brands and categories |
| Supplier ↔ product | One optional `supplierId` per variant | **Many-to-many** — "one or more suppliers", each with its own purchase price and lead time |
| Minimum order quantity | Absent | Per product and per variant |
| Delivery info | Absent | Availability, time, return eligibility |
| Variant attributes | Free-form `attributes` JSON | Named size / colour / grade / material, to make §11's size and grade filters real rather than JSON scans |
| Upload limit | 8 MB | Context says 5 MB practical maximum — a deliberate decision, not a bug |

### 3.3 Stock consistency — settled by D1

**Question:** does published stock availability need to be transactionally
consistent with the storefront? `Product.minPrice` is already denormalized and
recomputed inside the same transaction as any variant change; that works because
price changes are rare and admin-driven. Stock changes are frequent, so a
denormalized availability column is wrong for as long as the recompute lags.

**Resolved by D1:** immutable ledger as the source of truth, with a balance table
maintained in the same transaction, plus reconciliation that can rebuild and
verify. This keeps fast reads *and* makes drift detectable instead of silent —
the existing `recomputeProductPricing()` has no equivalent check, which is
tolerable for price and would not be for stock.

## 4. Phased plan

Each phase is independently shippable and leaves the system working. Phases 1–3
are the ones that unlock §20's success definition.

### Phase 0 — Decisions: APPROVED 2026-08-02

All five are settled and recorded verbatim as **D1–D5** in
[project-context.md](project-context.md) §20. Summary and what each one commits
the implementation to:

| # | Decision | Consequence for the build |
|---|---|---|
| **D1** | Immutable ledger is the source of truth; a balance table is maintained in the same transaction for fast reads; reconciliation can rebuild and verify | Resolves §3.3. Both halves, not one — balances are a cache with a proof, so reconciliation is Phase 2 scope, not "later" |
| **D2** | Cost and valuation restricted to owner/super-admin, procurement and finance, enforced in the API | Forces real roles **and** field-level redaction. See the open role-naming question below |
| **D3** | Base inventory unit per variant; exact `Decimal` conversion factors; no floating point | New unit and conversion columns; stock compared in base units only |
| **D4** | Negative stock prohibited; override limited, reason mandatory, immutable audit entry | Override is a distinct capability, and the audit row is written in the same transaction |
| **D5** | HSN/SAC and GST rate at product level with optional variant override; prices tax-exclusive; GST calculated explicitly | Tax columns on `products` and `product_variants`; no stored tax-inclusive prices anywhere |

**D1 is more demanding than the recommendation it replaces.** I had suggested
deriving availability from the ledger and only caching if a measured need
appeared; the approved decision is to maintain the cache from the start *and*
prove it. That is the stronger choice for a stock system, and it makes
reconciliation a first-class deliverable rather than a debugging tool — but it
means Phase 2 carries the balance table, its transactional maintenance and the
rebuild-and-verify path together. Sequencing below reflects that.

**One open question, blocking Phase 1 only.** D2 grants access to "procurement"
and "finance" roles, which are not among the five roles in §14. The mapping I
have assumed — procurement = inventory manager, finance = administrator — and the
alternative of adding a genuine sixth Finance role are set out in
[permissions-matrix.md](permissions-matrix.md) §1. Confirm before Phase 1 starts,
because it decides the role enum, and a separation-of-duties boundary is
expensive to introduce after the procedures exist.

**Now specified in full:** [permissions-matrix.md](permissions-matrix.md) — the
capability set, the role-by-capability grid, every existing procedure mapped to
the capability it will require, the six enforcement rules and the test
obligations.

### Phase 1 — Roles, capabilities and field-level redaction

First, because every later phase asks "may this person do this?", and adding that
question afterwards means revisiting every procedure. Blocked only on the
role-naming confirmation above.

- Extend `AdminRole` to the approved roles; add the capability map from
  `permissions-matrix.md` §3
- Enforce in `packages/api/src/trpc.ts` as capability-declaring procedure
  builders, so a procedure **cannot be written without declaring** what it needs,
  and a missing declaration fails at startup rather than defaulting to open
- Support per-input checks: `admin.products.setStatus` needs `catalogue:publish`
  for `ACTIVE`/`HIDDEN` but `catalogue:archive` for `ARCHIVED`
- **Field-level redaction in `serializers.ts`** (D2): a caller without
  `price:cost:read` gets payloads where cost fields are *absent*, not nulled.
  Doing this in the one place database values are already shaped for the wire is
  what stops a future route from leaking by omission
- Admin UI hides what a role cannot use, **in addition to** the server check
- The full table-driven test matrix from `permissions-matrix.md` §6, negative
  cases included, structured so a new procedure with no row fails the suite

### Phase 2 — Stock foundation: ledger, balances, reconciliation

Per D1 this is three deliverables that ship together, since a balance cache
without a rebuild path is a liability.

- **`StockMovement`** — append-only ledger with the full §7 field list plus the
  transaction-type enum. No update or delete path exists at the router level;
  corrections are compensating movements
- **`StockBalance`** — current balance per variant, written **in the same
  transaction** as every movement, never independently
- **Reconciliation** (`admin.stock.reconcile`) — rebuilds balances from the ledger
  and verifies stored against rebuilt, **reporting** divergence rather than
  silently repairing it. A silent auto-repair would hide the bug that caused the
  drift
- **Base units and conversion** (D3) — base inventory unit per variant, `Decimal`
  conversion factors for purchase and sale units, all comparison in base units.
  Rounding behaviour explicit wherever a conversion is inexact
- **Row-level locking** on the variant row before reading any balance, matching
  the `SELECT … FOR UPDATE` pattern `variants.create` already uses — a concurrent
  sale and correction must not interleave into a wrong balance
- **Zero floor** (D4) with the authorized-override path: mandatory reason,
  immutable audit row, same transaction
- Low-stock threshold per variant, and the four availability states
- Integration tests: concurrency (two simultaneous movements cannot lose an
  update), the zero floor, override authorization and its audit row,
  ledger/balance agreement, and reconciliation detecting a deliberately corrupted
  balance

### Phase 3 — Commercial fields, tax and the product editor

- Purchase / selling / bulk price, minimum order quantity, delivery fields,
  featured flag, `HIDDEN` status
- **Tax per D5** — `hsnSacCode` and `gstRate` on `products`, optional override on
  `product_variants`; prices stored tax-exclusive; GST computed explicitly in
  quote, purchase and report calculations, with the same `Decimal` discipline as
  price
- Supplier extensions and the many-to-many supplier link with per-supplier
  purchase price and lead time — cost fields gated by `price:cost:read`
- Product editor extended to match context §5, respecting Phase 1 capabilities
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

- **Migrations:** phases 2 and 3 add columns to `products` / `product_variants`
  and new tables. Both are additive; no destructive migration is currently
  foreseen. Any that becomes necessary gets flagged for approval before it is
  written. One caveat: D3's base inventory unit has **no correct default** for
  existing variants — backfilling it is a data decision, not a schema one, and
  will need your input when Phase 2 reaches it.
- **No floating point** (D3): stock quantities and conversion factors are
  `Decimal` end to end, the same rule money already follows. The
  `addQuantities()` helper in the storefront exists precisely because
  `0.1 + 0.2` broke a quote basket, and stock arithmetic has the same exposure.
- **Test tiers:** each phase extends the existing three tiers. Stock concurrency
  in particular belongs in `test:integration`, since it needs a real database to
  mean anything — a mocked transaction cannot demonstrate a lost update.
- **`docs/known-issues.md` KI-1** (deleting an image does not revoke its public
  URL) is unrelated to inventory but still open, and Phase 3 touches image
  handling — worth resolving in the same pass.
- **Estimates:** deliberately not given. I have no basis for honest ones here,
  and invented numbers would only anchor a plan badly.
