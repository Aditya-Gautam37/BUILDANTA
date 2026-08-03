# Role and permission matrix

The binding authorization model for Buildanta. Derived from
[project-context.md](project-context.md) §14 and decision **D2** in §20.

**Not implemented yet.** This document is the specification that
`packages/api/src/trpc.ts` and every admin procedure will be built and tested
against. Procedure names below are the ones that exist today, read from
`packages/api/src/root.ts` and the routers under
`packages/api/src/routers/`; names marked *(new)* do not exist yet and belong to
the phases in [inventory-gap-analysis.md](inventory-gap-analysis.md).

---

## 1. An open question that must be settled first

§14 names **five** roles. Decision D2 grants purchase-price and valuation access
to "owner/super-admin, **procurement** and **finance**" — two names that are not
among the five. That is not a wording quibble; it changes the enum.

The mapping I have assumed, and which needs your confirmation:

| D2 name | Assumed five-role equivalent | Confidence |
|---|---|---|
| owner / super-admin | **Administrator** | high — same description in §14 |
| procurement | **Inventory manager** | reasonable — §14 gives it suppliers and stock, which is the procurement function |
| finance | **no equivalent exists** | — |

**There is no finance role among the five.** So one of these is true, and I need
you to pick:

- **(a)** Purchase price and valuation are readable by **Administrator and
  Inventory manager only**, and "finance" was shorthand for the Administrator.
  Stays at five roles. *This is what the matrix below encodes.*
- **(b)** A sixth **Finance** role exists — read-only on purchase prices,
  valuation and reports, no catalogue or stock write. Six roles.

I have encoded **(a)** because you asked for exactly five roles. If finance is a
real separate person in the business who must not also be able to edit the
catalogue, choose (b) — that is a genuine separation-of-duties concern, and
retrofitting it later means revisiting every procedure that touches cost.

## 2. Roles

| Key | Role | Scope |
|---|---|---|
| `ADMINISTRATOR` | Administrator (owner / super-admin) | Everything, including staff permissions and audit records |
| `INVENTORY_MANAGER` | Inventory manager | Products, stock, suppliers, purchase prices, inventory reports |
| `CATALOGUE_EDITOR` | Catalogue editor | Descriptions, images, categories, drafts. **No stock, no cost data** |
| `SALES_STAFF` | Sales staff | Quotations, selling prices, availability, reservations |
| `CUSTOMER` | Customer | Public browsing and own enquiries. Not an admin session |

`CUSTOMER` is deliberately outside the admin role enum — customers authenticate
against a separate model (not yet built) and reach only public procedures. Today
`enum AdminRole` has a single value, `ADMIN`, which maps to `ADMINISTRATOR`.

## 3. Capabilities

Permissions are expressed as named capabilities rather than per-procedure
booleans, so a new procedure joins an existing capability instead of adding a
row everyone must remember to update.

| Capability | ADMINISTRATOR | INVENTORY_MANAGER | CATALOGUE_EDITOR | SALES_STAFF |
|---|:--:|:--:|:--:|:--:|
| `catalogue:read` | ✅ | ✅ | ✅ | ✅ |
| `catalogue:write` | ✅ | ✅ | ✅ | ❌ |
| `catalogue:publish` | ✅ | ✅ | ❌ | ❌ |
| `catalogue:archive` | ✅ | ✅ | ❌ | ❌ |
| `catalogue:delete` | ✅ | ❌ | ❌ | ❌ |
| `taxonomy:write` | ✅ | ✅ | ✅ | ❌ |
| `taxonomy:delete` | ✅ | ❌ | ❌ | ❌ |
| `image:write` | ✅ | ✅ | ✅ | ❌ |
| `price:sell:read` | ✅ | ✅ | ✅ | ✅ |
| `price:sell:write` | ✅ | ✅ | ❌ | ❌ |
| **`price:cost:read`** | ✅ | ✅ | ❌ | ❌ |
| **`price:cost:write`** | ✅ | ✅ | ❌ | ❌ |
| **`valuation:read`** | ✅ | ✅ | ❌ | ❌ |
| `stock:read` | ✅ | ✅ | ✅ | ✅ |
| `stock:write` | ✅ | ✅ | ❌ | ❌ |
| **`stock:override_negative`** | ✅ | ✅ | ❌ | ❌ |
| `stock:reserve` | ✅ | ✅ | ❌ | ✅ |
| `supplier:read` | ✅ | ✅ | ✅ | ❌ |
| `supplier:write` | ✅ | ✅ | ❌ | ❌ |
| `supplier:delete` | ✅ | ❌ | ❌ | ❌ |
| `quote:read` | ✅ | ❌ | ❌ | ✅ |
| `quote:write` | ✅ | ❌ | ❌ | ✅ |
| `report:inventory` | ✅ | ✅ | ❌ | ❌ |
| `report:sales` | ✅ | ❌ | ❌ | ✅ |
| `audit:read` | ✅ | ❌ | ❌ | ❌ |
| `staff:manage` | ✅ | ❌ | ❌ | ❌ |
| `reconcile:run` | ✅ | ✅ | ❌ | ❌ |

The three bold rows are the D2 and D4 controls. They are the ones whose negative
cases must have explicit tests.

## 4. Procedure map

Existing procedures and the capability each will require.

### Catalogue

| Procedure | Capability |
|---|---|
| `admin.products.list` / `.byId` / `.formOptions` | `catalogue:read` |
| `admin.products.create` / `.update` | `catalogue:write` |
| `admin.products.setStatus` → `ACTIVE`, `HIDDEN` *(new status)* | `catalogue:publish` |
| `admin.products.setStatus` → `ARCHIVED` | `catalogue:archive` |
| `admin.products.delete` | `catalogue:delete` |
| `admin.variants.byProduct` | `catalogue:read` |
| `admin.variants.create` / `.update` | `catalogue:write` + `price:sell:write` |
| `admin.variants.setActive` / `.setDefault` | `catalogue:write` |
| `admin.variants.delete` | `catalogue:delete` |
| `admin.images.byProduct` | `catalogue:read` |
| `admin.images.updateMetadata` / `.reorder` / `.setPrimary` / `.delete` | `image:write` |

Note `admin.products.setStatus` requires **different** capabilities depending on
the target status. That is a per-input check, not a per-procedure one — the
authorization layer must support it rather than forcing the procedure to be split
or the check to be inlined and forgotten.

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

Supplier records will gain purchase prices, payment terms and lead times
(gap analysis §3.2). Those fields are `price:cost:read`, so `supplier:read` alone
must return the record **without** them — see §5.

### Quotes

| Procedure | Capability |
|---|---|
| `admin.quotes.list` / `.byId` / `.assignees` | `quote:read` |
| `admin.quotes.setStatus` / `.assign` | `quote:write` |

Inventory manager and catalogue editor are intentionally excluded from quotes:
§14 gives quotations to sales staff, and an inventory manager has no reason to
read customer contact details.

### Stock and inventory — all *(new)*

| Procedure | Capability |
|---|---|
| `admin.stock.balances` / `.byVariant` | `stock:read` |
| `admin.stock.movements` (ledger history) | `stock:read` |
| `admin.stock.record` (purchase, receipt, sale, damage, return, correction) | `stock:write` |
| `admin.stock.record` with a negative-balance override | `stock:write` + `stock:override_negative` |
| `admin.stock.reserve` / `.release` | `stock:reserve` |
| `admin.stock.reconcile` (rebuild and verify, per D1) | `reconcile:run` |
| `admin.inventory.valuation` | `valuation:read` |
| `admin.reports.inventory.*` | `report:inventory` |
| `admin.audit.list` | `audit:read` |

### Public

`catalog.*` and `quotes.submit` stay unauthenticated. They must never expose cost
or valuation, and must continue to exclude non-public product statuses —
including the new `HIDDEN`.

## 5. Enforcement rules

These are the rules that make the matrix real rather than decorative.

1. **Server-side, always.** Enforcement lives in the tRPC procedure builder, so a
   procedure cannot be written without declaring a capability. UI hiding is
   additional, never the control (D2).
2. **Field-level redaction, not just procedure gating.** A caller without
   `price:cost:read` must receive a payload with **no cost fields present** — not
   `null`, not zero, absent. Redaction belongs in the serializer layer
   (`packages/api/src/serializers.ts`), which is already the single place
   database values are shaped for the wire, so this cannot be bypassed by a route
   that forgets.
3. **Deny by default.** An unrecognised role, or a procedure with no declared
   capability, is refused. A missing declaration must fail loudly at startup
   rather than default to open.
4. **Overrides are attributable.** `stock:override_negative` additionally requires
   a non-empty reason and writes an immutable audit row in the same transaction
   as the movement (D4). No reason means no override, enforced by the schema, not
   by the form.
5. **Errors do not leak.** A caller who lacks a capability gets `FORBIDDEN` with
   no hint about the resource. Absent cost fields are indistinguishable from a
   product that has none.
6. **Session carries the role.** `AdminSession` resolves to a role on every
   request; a role change takes effect on the next request rather than waiting for
   a session to expire.

## 6. Test obligations

The matrix is only true if it is tested. Each row below is a required integration
test, not a suggestion — negative cases especially, since a permissions bug is
invisible when you only test the happy path.

- For **every** admin procedure: each of the four admin roles is either allowed or
  refused, matching §4 exactly. Table-driven, so a new procedure without a row
  fails the suite.
- `CATALOGUE_EDITOR` reading a product receives **no cost fields** — asserted on
  the payload, not the UI.
- `CATALOGUE_EDITOR` and `SALES_STAFF` are refused `admin.stock.record`.
- `SALES_STAFF` is refused `admin.inventory.valuation`.
- A negative-balance movement without `stock:override_negative` is refused and
  writes **nothing** — ledger and balance both unchanged.
- An authorized override with an empty reason is refused.
- An authorized override with a reason writes movement, balance and audit row
  **atomically**; killing the transaction mid-way leaves none of the three.
- `reconcile` detects a deliberately corrupted balance row and reports the
  divergence without silently repairing it.
- Unauthenticated callers are refused every admin procedure — already covered by
  `products.integration.test.ts` and extended per procedure.
