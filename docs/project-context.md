# Buildanta — project context

The product vision for Buildanta: website plus inventory management. This is the
**target state**, recorded as given by the business. It is not a description of
what the repository currently does — for that, and for the distance between the
two, see [inventory-gap-analysis.md](inventory-gap-analysis.md).

Where this document and the older planning notes disagree, this one wins.

---

## 1. Project overview

Buildanta Pvt. Ltd. will be a construction-material discovery, quotation, sales
and inventory-management platform serving homeowners, contractors, architects,
builders and businesses. The platform will help customers:

- Find construction materials
- Compare brands and specifications
- Check availability
- Request current prices and bulk quotations
- Estimate material requirements
- Contact Buildanta through phone or WhatsApp
- Arrange delivery to their construction site

Buildanta should support the customer from the foundation stage through finishing
while giving the business a central dashboard for controlling products, prices,
images, suppliers and inventory.

## 2. Business positioning

Buildanta is your trusted construction-material partner — from foundation to
finish. Buildanta supplies genuine construction materials at competitive prices
with expert assistance, transparent specifications, GST billing and dependable
site delivery.

Initial focus:

- Kanpur Nagar, Uttar Pradesh
- PIN code-based product availability
- Local and nearby delivery
- Retail and bulk orders
- Contractors, homeowners and construction businesses

## 3. Platform components

Two connected applications.

**Customer website** — browse materials; search; browse by category, by
construction stage, by room or application; view brands; view specifications and
images; request the latest price; request bulk quotations; submit a bill of
quantities; contact the supplier; use material calculators.

**Inventory management dashboard** — add and edit products; organize the
catalogue; upload product images; update prices; manage stock; manage suppliers;
control website visibility; review low-stock alerts; maintain an inventory audit
history; publish changes to the customer website.

## 4. Three-level catalogue structure

```text
Level 1: Main Category
    └── Level 2: Subcategory
            └── Level 3: Product
```

Example:

```text
Steel & Structure
    └── TMT Bars
            ├── Tata Tiscon Fe 550D — 8 mm
            ├── Tata Tiscon Fe 550D — 10 mm
            └── Tata Tiscon Fe 550D — 12 mm
```

Recommended Level 1 categories: Steel & Structure; Cement & Masonry; Sand &
Aggregates; Plumbing; Electrical; Tiles & Flooring; Paints & Finishes;
Waterproofing; Roofing; Doors & Windows; Sanitaryware & Bathware; Hardware &
Tools; Construction Chemicals; Safety Equipment.

## 5. Catalogue-management behaviour

Every category, subcategory and product will be clickable inside the dashboard.

**Main-category editor:** name; icon or image; description; display sequence;
website visibility; SEO title and description.

**Subcategory editor:** name; parent category; image; description; display
sequence; website visibility; SEO information.

**Product editor:** name; SKU or product code; brand; main category;
subcategory; short description; detailed description; main image; additional
gallery images; technical specifications; size, colour, grade and material; unit
of measurement; minimum order quantity; purchase price; selling price; bulk
price; GST percentage; available stock; low-stock threshold; supplier; delivery
availability; delivery time; return eligibility; featured-product status; draft,
published, hidden or archived status.

## 6. Product variants

One product may contain multiple variants.

```text
Product: Tata Tiscon Fe 550D TMT Bar
Variants: 8 mm, 10 mm, 12 mm, 16 mm, 20 mm, 25 mm
```

Each variant can have its own SKU, size, grade, unit, price, stock quantity,
minimum order quantity, supplier, images and availability status.

## 7. Inventory-management features

**Dashboard overview** should display: total active products; total categories;
total suppliers; total available stock; estimated inventory value; low-stock
products; out-of-stock products; recent inventory changes; recently added
products; pending quotation requests.

**Stock management** — every stock transaction records: product and variant;
quantity added or removed; previous stock; updated stock; transaction type;
reason; supplier or customer reference; invoice or challan number; staff member;
date and time.

Transaction types: stock purchased; stock received; customer sale; damaged
stock; returned stock; manual correction; supplier return; reserved for order.

The system should prevent stock from falling below zero unless an administrator
explicitly authorizes it.

**Stock alerts** — products show: in stock; low stock (below configured
threshold); out of stock; reserved (allocated to orders); discontinued.

## 8. Website and inventory connection

Both applications use the same central product database.

```text
Administrator edits product
        ↓
Product information is validated
        ↓
Changes are saved to the database
        ↓
Published catalogue is updated
        ↓
Customer sees updated information
```

Changes to these fields should automatically appear on the website: product
name; category; brand; images; description; specifications; price or "Request
Price"; stock availability; available variants; delivery information; published
status.

**Draft and hidden products must not appear publicly.**

## 9. Website structure

**Header:** logo; delivery location or PIN code; product search; shop products;
browse by stage; material calculators; professionals; bulk quotation; help and
support; login; cart or enquiry list; language selector; phone and WhatsApp
actions.

**Homepage sections:** main promotional banner; shop by category; browse by
construction stage; popular products; request today's prices; bulk-quotation
form; material calculators; featured brands; why choose Buildanta; service
areas; customer reviews; construction guides; contact and support; footer.

## 10. Construction-stage navigation

- **Planning** — budget planning; quantity estimation; professional
  consultation; project checklist
- **Foundation and structure** — cement; TMT steel; binding wire; sand;
  aggregate; blocks and bricks; waterproofing chemicals
- **Walls and masonry** — bricks; AAC blocks; cement; plaster material; wall
  mesh
- **Plumbing and electrical** — pipes; fittings; water tanks; wires; switches;
  distribution boards
- **Flooring and finishing** — tiles; adhesives; grout; paint; putty;
  sanitaryware; doors and windows

## 11. Search and filtering

Filter by: category; subcategory; brand; construction stage; price range; size;
grade; unit; stock availability; delivery location; application.

Search should recognize product names, brands, SKUs and common terms such as
"sariya", "TMT", "cement" and "waterproofing".

## 12. Quotation workflow

Because construction-material prices change frequently, Buildanta should
initially use a catalogue-and-quotation model.

Customer process: select products → enter required quantities → provide delivery
PIN code → add required delivery date → upload a BOQ when available → submit the
request → receive a reference number → get a response by phone, email or
WhatsApp.

Quotation statuses: new; under review; price requested from supplier; quotation
prepared; sent to customer; accepted; rejected; converted to order; closed.

## 13. Supplier management

Each supplier profile should include: supplier or company name; contact person;
phone; email; GST number; address; supplied brands; supplied categories;
purchase prices; payment terms; delivery lead time; minimum order quantity;
active status; internal notes.

Products and variants can be connected to one or more suppliers.

## 14. User roles and permissions

- **Administrator** — full access; manage staff permissions; manage products and
  suppliers; view prices and inventory value; publish or archive products; view
  audit records
- **Inventory manager** — add and edit products; update stock; upload images;
  manage suppliers; view inventory reports
- **Catalogue editor** — edit descriptions and images; manage categories; prepare
  drafts; **cannot** change stock or purchase prices
- **Sales staff** — review quotation requests; prepare customer quotations; view
  selling prices and availability; reserve inventory
- **Finance** *(added by D6)* — **read-only**: purchase costs, GST, inventory
  valuation and financial reports. Cannot create or edit catalogue data, selling
  prices, suppliers, purchases or stock transactions
- **Customer** — browse products; request quotations; save products; track
  enquiries and orders

**All protected permissions must be checked by the server, not only hidden in
the interface.** The binding, procedure-by-procedure matrix is
[permissions-matrix.md](permissions-matrix.md); see also decisions **D2** and
**D6** in §20. Checks are **capability-based** — no code branches on a role
name.

## 15. Image management

Main product image; multiple gallery images; preview; replace; remove; change
sequence; alternative text; file-size and format validation; optimized website
images.

Recommended: JPEG or WebP for photographs; PNG for transparent brand assets;
maximum practical upload size of 5 MB; automatic resizing and compression.

## 16. Calculators

Cement; TMT steel; brick and block; concrete-material; tile; paint; flooring.

Calculator results should allow customers to add suggested quantities to a
quotation request.

## 17. Reports

Current stock; low stock; out of stock; stock movement; inventory valuation;
supplier-wise inventory; category-wise inventory; fast-moving products;
slow-moving products; quotation conversion; product performance.

Filterable by date and exportable to CSV or Excel.

## 18. Essential policies

Privacy policy; cookie policy; terms and conditions; delivery policy;
cancellation policy; return and refund policy; product disclaimer; pricing
disclaimer; GST and invoicing information.

Prices should state whether GST and transportation are included.

## 19. Initial MVP priorities

1. Three-level product catalogue
2. Category and subcategory management
3. Complete product editor
4. Product and variant image management
5. Price and inventory controls
6. Supplier management
7. Public catalogue synchronization
8. Search and filtering
9. Bulk-quotation requests
10. Phone and WhatsApp ordering
11. Low-stock alerts
12. Staff authentication and permissions
13. Inventory audit history

Cart, online payment, logistics automation and a professional marketplace can be
added after the core catalogue and quotation workflow is operating reliably.

## 20. Approved architecture decisions

Ratified by the business on 2026-08-02. These are **binding** — they resolve the
open questions that the earlier sections left implicit, and they override any
looser reading of §6, §7, §13 or §14. Implementation rationale and phasing are in
[inventory-gap-analysis.md](inventory-gap-analysis.md).

### D1 — Stock is an immutable ledger with a maintained balance table

An immutable stock-movement ledger is the **single source of truth**. A
current-balance table is maintained **in the same transaction** as every movement,
purely to make reads fast. Balances are therefore a cache, never an authority.

Reconciliation is a required deliverable, not an afterthought: the system must be
able to **rebuild** balances from the ledger and **verify** the stored balances
against that rebuild, reporting any divergence. Ledger rows are append-only —
corrections are new compensating movements, never edits or deletes.

### D2 — Purchase prices and valuation are access-controlled at the API layer

Purchase price and stock valuation are **sensitive**. Access is enforced **in the
API**, for the owner/super-admin, procurement and finance roles only. UI hiding is
not a control and must never be the only barrier: a field the caller may not read
must not appear in the response payload at all.

### D3 — Every variant has a base inventory unit, with exact Decimal conversion

Each variant declares a **base inventory unit**. Purchasing and selling units
convert into that base unit by **exact Decimal conversion factors** — one pallet
may equal 50 bags. Stock is held and compared in base units.

**Floating-point arithmetic is prohibited** anywhere in this path, matching the
rule already applied to money throughout this codebase. Conversion factors are
stored as `Decimal`, and rounding behaviour must be explicit wherever a
conversion cannot be exact.

### D4 — Negative stock is prohibited by default and overrides are audited

Stock may not fall below zero. Only an **explicitly authorized owner/super-admin
or inventory manager** may override that, and every override requires:

- a **mandatory reason** — not an optional note
- an **immutable audit entry** recording who, when, what, and why

An override is a deliberate, attributable act, and the audit entry is part of the
same transaction as the movement it permits.

### D6 — Six roles, with a read-only Finance role, and capability-based checks

The role list in §14 is extended by a sixth role: **Finance**, with **read-only**
access to purchase costs, GST, inventory valuation and financial reports.

Finance may **not** create or edit catalogue data, selling prices, suppliers,
purchases or stock transactions. Administrator retains full access. Inventory
manager handles procurement and inventory operations — the "procurement" function
D2 refers to.

Authorization is **capability-based**: a role is a named set of permissions, and
no code branches on a role name. Adding or re-shaping a role is therefore a data
change, not an edit to every procedure. This is what made Finance cheap to add,
and it is a binding constraint on the implementation, not a style preference.

The full grid is in [permissions-matrix.md](permissions-matrix.md).

### D5 — Tax is explicit: HSN/SAC and GST at product level, variant override

**HSN/SAC code and GST rate are stored on the product**, with an **optional
variant-level override** for exceptions.

All stored prices are **tax-exclusive**. GST is **calculated explicitly** wherever
it is shown or totalled — quotes, purchases and reports — never inferred from a
tax-inclusive figure and never folded into a stored price.

## 21. Success definition

The initial Buildanta platform will be successful when an authorized staff
member can create or edit a product — including its category, variants, images,
price, supplier and stock — and publish it so that a customer can immediately
discover the correct information and submit a quotation request.
