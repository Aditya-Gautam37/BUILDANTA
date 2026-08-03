# Role and permission matrix

The binding authorization model for Buildanta. Derived from
[project-context.md](project-context.md) §14 and decisions **D2** and **D6** in
§20.

**Not implemented yet.** This document is the specification that
`packages/api/src/trpc.ts` and every admin procedure will be built and tested
against. Procedure names below are the ones that exist today, read from
`packages/api/src/root.ts` and the routers under `packages/api/src/routers/`;
names marked *(new)* do not exist yet and belong to the phases in
[inventory-gap-analysis.md](inventory-gap-analysis.md).

---

## 1. Authorization is capability-based, not role-based

The single most important rule here, and the one that decides whether this
document stays true a year from now:

> **No code branches on a role name.** Roles are nothing but named sets of
> capabilities. Every check asks "does this caller hold capability *X*?", never
> "is this caller an inventory manager?".

Consequences, all of them deliberate:

- Adding a role is a data change — one new capability set — not a hunt through
  procedures for `if (role === …)`.
- A capability can be re-assigned between roles without touching a single
  procedure.
- `FINANCE` exists at all because this held: it is a new set assembled from
  capabilities that already had to exist for D2.
- A procedure declares the capability it requires **at definition**, so it cannot
  be written without answering the question. A procedure with no declaration
  fails at startup rather than defaulting to open.

Role names appear in exactly two places: the `AdminRole` enum, and the one table
mapping each role to its capability set. Nowhere else.

## 2. Roles

Six roles. `FINANCE` was approved on 2026-08-02, resolving the mismatch between
D2's "procurement and finance" wording and the original five-role list.

| Key | Role | Scope |
|---|---|---|
| `ADMINISTRATOR` | Administrator (owner / super-admin) | Everything, including staff permissions and audit records |
| `INVENTORY_MANAGER` | Inventory manager | Procurement and inventory operations: products, stock, suppliers, purchase costs, inventory reports |
| `CATALOGUE_EDITOR` | Catalogue editor | Descriptions, images, categories, drafts. **No stock, no cost data** |
| `SALES_STAFF` | Sales staff | Quotations, selling prices, availability, reservations |
| `FINANCE` | Finance | **Read-only.** Purchase costs, GST, inventory valuation, financial reports |
| `CUSTOMER` | Customer | Public browsing and own enquiries. Not an admin session |

`CUSTOMER` sits outside the admin role enum — customers authenticate against a
separate model (not yet built) and reach only public procedures. Today
`enum AdminRole` has a single value, `ADMIN`, which maps to `ADMINISTRATOR`.

### What FINANCE deliberately cannot do

Finance is a **read-only** role. It holds no `*:write` capability at all, which
is worth stating as an invariant rather than leaving implicit in the grid:

- cannot create or edit catalogue data, at any status
- cannot set or change selling prices, or purchase costs
- cannot create or edit suppliers
- cannot record purchases
- cannot record any stock transaction, and cannot override the zero floor

A single test asserts the invariant directly — `FINANCE` holds no capability
ending in `:write`, plus none of the named privileged operations — so a future
grant cannot widen the role by accident.

## 3. Capabilities

| Capability | ADMIN­ISTRATOR | INVENTORY_MANAGER | CATALOGUE_EDITOR | SALES_STAFF | FINANCE |
|---|:--:|:--:|:--:|:--:|:--:|
| `catalogue:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `catalogue:write` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `catalogue:publish` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `catalogue:archive` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `catalogue:delete` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `taxonomy:write` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `taxonomy:delete` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `image:write` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `price:sell:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `price:sell:write` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **`price:cost:read`** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **`price:cost:write`** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **`tax:read`** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`tax:write`** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **`valuation:read`** | ✅ | ✅ | ❌ | ❌ | ✅ |
| `stock:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `stock:write` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **`stock:override_negative`** | ✅ | ✅ | ❌ | ❌ | ❌ |
| `stock:reserve` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `supplier:read` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `supplier:write` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `supplier:delete` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `purchase:read` *(new module)* | ✅ | ✅ | ❌ | ❌ | ✅ |
| `purchase:write` *(new module)* | ✅ | ✅ | ❌ | ❌ | ❌ |
| `quote:read` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `quote:write` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `report:inventory` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `report:financial` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `report:sales` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `audit:read` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `staff:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `reconcile:run` | ✅ | ✅ | ❌ | ❌ | ❌ |

Bold rows are the D2, D4 and D5 controls. Their negative cases need explicit
tests.

`tax:read` is separated from `price:cost:read` on purpose: GST rate and HSN/SAC
appear on customer-facing quotes, so sales staff and the catalogue editor need to
read them, while cost stays restricted.

### Four non-grants to FINANCE, called out rather than buried

These follow least privilege, and each is a judgement I would rather you
overturn deliberately than discover later:

1. **`quote:read`** — quote records carry customer names, phone numbers and
   addresses. GST *rates* are readable via `tax:read`, and quote-level GST totals
   are reachable through `report:financial`, so finance can do the tax work
   without holding personal data. Grant it if finance must audit individual
   quotes.
2. **`report:sales`** — sales performance reads as a sales-team concern.
   Financial and inventory reporting is already granted.
3. **`audit:read`** — §14 reserves audit records to the administrator. Finance
   often wants the stock-movement history for cost verification; `stock:read`
   covers the ledger itself, so this is only about the separate audit log.
4. **`reconcile:run`** — reconciliation can rebuild balances, so it is not
   read-only. If finance should be able to *verify* without rebuilding, the clean
   answer is to split a `reconcile:verify` capability rather than widen this one.

## 4. Procedure map

### Catalogue

| Procedure | Capability |
|---|---|
| `admin.products.list` / `.byId` / `.formOptions` | `catalogue:read` |
| `admin.products.create` / `.update` | `catalogue:write` |
| `admin.products.update` touching `hsnSacCode` / `gstRate` *(new fields)* | `catalogue:write` + `tax:write` |
| `admin.products.setStatus` → `ACTIVE`, `HIDDEN` *(new status)* | `catalogue:publish` |
| `admin.products.setStatus` → `ARCHIVED` | `catalogue:archive` |
| `admin.products.delete` | `catalogue:delete` |
| `admin.variants.byProduct` | `catalogue:read` |
| `admin.variants.create` / `.update` | `catalogue:write` + `price:sell:write` |
| `admin.variants.create` / `.update` setting purchase cost *(new field)* | additionally `price:cost:write` |
| `admin.variants.setActive` / `.setDefault` | `catalogue:write` |
| `admin.variants.delete` | `catalogue:delete` |
| `admin.images.byProduct` | `catalogue:read` |
| `admin.images.updateMetadata` / `.reorder` / `.setPrimary` / `.delete` | `image:write` |

`admin.products.setStatus` requires **different capabilities depending on its
input**. That is a per-input check, not a per-procedure one — the authorization
layer must support it, or the check ends up inlined in a handler and eventually
forgotten.

### Taxonomy

| Procedure | Capability |
|---|---|
| `admin.{categories,brands,rooms,stages}.list` / `.byId` | `catalogue:read` |
| `admin.{categories,brands,rooms,stages}.create` / `.update` / `.setActive` | `taxonomy:write` |
| `admin.{categories,brands,rooms,stages}.delete` | `taxonomy:delete` |

### Suppliers

| Procedure | Capability |
|---|---|
| `admin.suppliers.list` / `.options` / `.byId` | `supplier:read` |
| `admin.suppliers.create` / `.update` / `.setActive` | `supplier:write` |
| `admin.suppliers.delete` | `supplier:delete` |

Suppliers gain purchase prices, payment terms and lead times (gap analysis
§3.2). Those are cost fields: `supplier:read` alone returns the record **without**
them, per §5.2. That is why the catalogue editor may hold `supplier:read`
safely.

### Quotes

| Procedure | Capability |
|---|---|
| `admin.quotes.list` / `.byId` / `.assignees` | `quote:read` |
| `admin.quotes.setStatus` / `.assign` | `quote:write` |

### Stock and inventory — all *(new)*

| Procedure | Capability |
|---|---|
| `admin.stock.balances` / `.byVariant` | `stock:read` |
| `admin.stock.movements` (ledger history) | `stock:read` |
| `admin.stock.record` | `stock:write` |
| `admin.stock.record` with a negative-balance override | `stock:write` + `stock:override_negative` |
| `admin.stock.reserve` / `.release` | `stock:reserve` |
| `admin.stock.reconcile` | `reconcile:run` |
| `admin.inventory.valuation` | `valuation:read` |
| `admin.purchases.list` / `.byId` | `purchase:read` |
| `admin.purchases.create` / `.update` | `purchase:write` |
| `admin.reports.inventory.*` | `report:inventory` |
| `admin.reports.financial.*` | `report:financial` |
| `admin.audit.list` | `audit:read` |

### Public

`catalog.*` and `quotes.submit` stay unauthenticated. They must never expose cost
or valuation, and must continue to exclude non-public product statuses —
including the new `HIDDEN`.

## 5. Enforcement rules

1. **Capability-based, never role-based.** Per §1. A `grep` for a role name
   outside the enum and the role→capability table is a defect.
2. **Field-level redaction, not just procedure gating.** A caller without
   `price:cost:read` receives payloads where cost fields are **absent** — not
   `null`, not zero. Redaction lives in `packages/api/src/serializers.ts`, already
   the single place database values are shaped for the wire, so a future route
   cannot leak by forgetting.
3. **Server-side, always.** Enforcement lives in the tRPC procedure builder. UI
   hiding is additional, never the control (D2).
4. **Deny by default.** An unrecognised role, or a procedure with no declared
   capability, is refused, and the missing declaration fails loudly at startup.
5. **Overrides are attributable.** `stock:override_negative` additionally requires
   a non-empty reason and writes an immutable audit row in the same transaction as
   the movement (D4). No reason, no override — enforced by the schema, not the
   form.
6. **Errors do not leak.** A caller lacking a capability gets `FORBIDDEN` with no
   hint about the resource. Absent cost fields are indistinguishable from a
   product that has none.
7. **Session carries the role.** `AdminSession` resolves to a role on every
   request, so a role change takes effect on the next request rather than when a
   session expires.

## 6. Test obligations

The matrix is only true if it is tested, and permissions bugs are invisible when
only the happy path is exercised.

- **Table-driven, exhaustive:** for every admin procedure, each of the five admin
  roles is allowed or refused exactly as §4 says. A new procedure with no row
  fails the suite.
- **The FINANCE invariant:** `FINANCE` holds no capability ending in `:write`, and
  none of `catalogue:publish`, `catalogue:archive`, `catalogue:delete`,
  `taxonomy:delete`, `supplier:delete`, `stock:override_negative`,
  `stock:reserve`, `reconcile:run`, `audit:read`, `staff:manage`. Asserted against
  the capability set itself, so it cannot be widened by accident.
- **No role-name branching:** a static check that no source file outside the enum
  and the role→capability map compares against a role name.
- `CATALOGUE_EDITOR` and `SALES_STAFF` reading a product receive **no cost
  fields** — asserted on the payload, not the UI.
- `FINANCE` reading a product **does** receive cost fields, and `tax:read`
  holders receive GST and HSN/SAC.
- `FINANCE` is refused `admin.stock.record`, `admin.purchases.create`,
  `admin.suppliers.update`, `admin.variants.update` and
  `admin.products.setStatus`.
- `SALES_STAFF` is refused `admin.inventory.valuation`.
- A negative-balance movement without `stock:override_negative` is refused and
  writes **nothing** — ledger and balance both unchanged.
- An authorized override with an empty reason is refused.
- An authorized override with a reason writes movement, balance and audit row
  **atomically**; a failure mid-way leaves none of the three.
- `reconcile` detects a deliberately corrupted balance row and reports the
  divergence without silently repairing it.
- Unauthenticated callers are refused every admin procedure — already covered by
  `products.integration.test.ts`, extended per procedure.
