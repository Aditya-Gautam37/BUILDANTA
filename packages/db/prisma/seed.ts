/**
 * Development seed data.
 *
 * The taxonomy here is the real Buildanta information architecture, taken from
 * buildanta.com: ten build stages, six rooms, nine top-level categories and the
 * twenty-eight brands the site features. It is reproduced faithfully with three
 * corrections:
 *
 *   1. The live site's slugs contain a double-hyphen artefact from stripping "&"
 *      without collapsing the separator — `/categories/tiles--flooring`,
 *      `sanitaryware--bathware`, `cement--structure`. Slugs here are single-hyphen.
 *   2. The live homepage advertises ten stages while its footer lists seven, and
 *      three different category lists are in circulation. There is one list here,
 *      and every menu in both apps is generated from it.
 *   3. Rooms differ between pages too (six vs five). Six, per the homepage.
 *
 * Idempotent: every write is an upsert keyed on a slug, SKU or reference, so it
 * can be re-run after a schema change without a reset.
 */
import { hashPassword } from "@buildanta/auth";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type SalesUnit = Prisma.ProductVariantCreateInput["unit"];

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

async function seedAdmin(): Promise<void> {
  const email = (process.env["SEED_ADMIN_EMAIL"] ?? "admin@buildanta.local")
    .trim()
    .toLowerCase();
  const name = (process.env["SEED_ADMIN_NAME"] ?? "Buildanta Admin").trim();
  const password = process.env["SEED_ADMIN_PASSWORD"];

  if (!password) {
    throw new Error(
      "SEED_ADMIN_PASSWORD is not set. Add it to .env — the seed will not invent a password for you.",
    );
  }
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("Refusing to run the development seed against production.");
  }

  const passwordHash = await hashPassword(password);

  await prisma.adminUser.upsert({
    where: { email },
    // The password is only set on creation. Re-running the seed must not silently
    // reset a password someone has since changed.
    update: { name, isActive: true },
    create: { email, passwordHash, name },
  });

  console.log(`  admin user: ${email}`);
}

// ---------------------------------------------------------------------------
// Build stages — buildanta.com homepage order, which is the order work happens
// ---------------------------------------------------------------------------

const STAGES = [
  {
    slug: "foundation-structure",
    name: "Foundation & Structure",
    description:
      "Excavation, footings, columns, beams and slabs — everything that carries load.",
  },
  {
    slug: "walls-masonry",
    name: "Walls & Masonry",
    description: "Block work, brickwork and the mortar that binds it.",
  },
  {
    slug: "bathroom-plumbing",
    name: "Bathroom & Plumbing",
    description: "Supply and drainage rough-in, then sanitaryware and fittings.",
  },
  {
    slug: "electrical-wiring",
    name: "Electrical & Wiring",
    description: "Conduit, cable, boards, switches and fixtures.",
  },
  {
    slug: "plastering-waterproofing",
    name: "Plastering & Waterproofing",
    description:
      "Internal and external plaster, and the membranes and admixtures that keep water out.",
  },
  {
    slug: "flooring-tiling",
    name: "Flooring & Tiling",
    description: "Floor and wall tile, adhesives, grout and skirting.",
  },
  {
    slug: "false-ceiling",
    name: "False Ceiling",
    description: "Gypsum and grid ceilings, framing and access panels.",
  },
  {
    slug: "paint-finishing",
    name: "Paint & Finishing",
    description: "Putty, primer, interior and exterior paint, and final finishes.",
  },
  {
    slug: "doors-windows-railings-glass",
    name: "Doors, Windows, Railings & Glass",
    description: "Frames, shutters, glazing, handrails and hardware.",
  },
  {
    slug: "kitchen-wardrobes",
    name: "Kitchen & Wardrobes",
    description: "Modular carcasses, shutters, counters and internal fittings.",
  },
];

// ---------------------------------------------------------------------------
// Rooms — six, per the buildanta.com homepage
// ---------------------------------------------------------------------------

const ROOMS = [
  {
    slug: "living-room",
    name: "Living Room",
    description: "Flooring, lighting, paint and finishes for the main living area.",
  },
  { slug: "bedroom", name: "Bedroom", description: "Flooring, wardrobes, paint and lighting." },
  {
    slug: "kitchen",
    name: "Kitchen",
    description: "Counters, wall tile, plumbing, exhaust and modular units.",
  },
  {
    slug: "bathroom",
    name: "Bathroom",
    description: "Waterproofing, tile, sanitaryware and CP fittings.",
  },
  {
    slug: "study-home-office",
    name: "Study / Home Office",
    description: "Lighting, cabling, acoustic and storage requirements.",
  },
  {
    slug: "balcony-terrace",
    name: "Balcony & Terrace",
    description: "External-grade tile, waterproofing, railings and weather paint.",
  },
];

// ---------------------------------------------------------------------------
// Categories — the nine buildanta.com top-level groups, with subcategories
// ---------------------------------------------------------------------------

interface CategorySeed {
  slug: string;
  name: string;
  description?: string;
  children?: { slug: string; name: string }[];
}

const CATEGORIES: CategorySeed[] = [
  {
    slug: "cement-structure",
    name: "Cement & Structure",
    description: "Cement, concrete, blocks, bricks and aggregate.",
    children: [
      { slug: "cement", name: "Cement" },
      { slug: "blocks-bricks", name: "Blocks & Bricks" },
      { slug: "aggregate-sand", name: "Aggregate & Sand" },
      { slug: "ready-mix-concrete", name: "Ready-Mix Concrete" },
    ],
  },
  {
    slug: "steel-tmt",
    name: "Steel & TMT",
    description: "Reinforcement bar, structural sections and binding wire.",
    children: [
      { slug: "tmt-bars", name: "TMT Bars" },
      { slug: "structural-steel", name: "Structural Steel" },
      { slug: "binding-wire-mesh", name: "Binding Wire & Mesh" },
    ],
  },
  {
    slug: "electrical",
    name: "Electrical",
    description: "Cable, conduit, switchgear, switches and lighting.",
    children: [
      { slug: "wires-cables", name: "Wires & Cables" },
      { slug: "switches-sockets", name: "Switches & Sockets" },
      { slug: "mcb-distribution-boards", name: "MCBs & Distribution Boards" },
      { slug: "lighting", name: "Lighting" },
      { slug: "fans", name: "Fans" },
    ],
  },
  {
    slug: "paints",
    name: "Paints",
    description: "Interior and exterior paint, primer, putty and enamel.",
    children: [
      { slug: "interior-paint", name: "Interior Paint" },
      { slug: "exterior-paint", name: "Exterior Paint" },
      { slug: "primers-putty", name: "Primers & Putty" },
      { slug: "wood-metal-finishes", name: "Wood & Metal Finishes" },
    ],
  },
  {
    slug: "tiles-flooring",
    name: "Tiles & Flooring",
    description: "Vitrified and ceramic tile, adhesives, grout and skirting.",
    children: [
      { slug: "floor-tiles", name: "Floor Tiles" },
      { slug: "wall-tiles", name: "Wall Tiles" },
      { slug: "tile-adhesive-grout", name: "Tile Adhesive & Grout" },
    ],
  },
  {
    slug: "sanitaryware-bathware",
    name: "Sanitaryware & Bathware",
    description: "WCs, basins, CP fittings, showers and accessories.",
    children: [
      { slug: "wc-basins", name: "WCs & Basins" },
      { slug: "cp-fittings", name: "CP Fittings" },
      { slug: "showers", name: "Showers" },
      { slug: "pipes-fittings", name: "Pipes & Fittings" },
    ],
  },
  {
    slug: "waterproofing",
    name: "Waterproofing",
    description: "Admixtures, coatings, membranes and sealants.",
    children: [
      { slug: "waterproofing-compounds", name: "Waterproofing Compounds" },
      { slug: "membranes", name: "Membranes" },
      { slug: "sealants", name: "Sealants" },
    ],
  },
  {
    slug: "doors-windows",
    name: "Doors & Windows",
    description: "Frames, shutters, glazing and hardware.",
    children: [
      { slug: "door-frames-shutters", name: "Door Frames & Shutters" },
      { slug: "windows-glazing", name: "Windows & Glazing" },
      { slug: "door-hardware", name: "Door Hardware" },
    ],
  },
  {
    slug: "false-ceiling-drywall",
    name: "False Ceiling & Drywall",
    description: "Gypsum board, grid systems, framing and jointing compound.",
    children: [
      { slug: "gypsum-board", name: "Gypsum Board" },
      { slug: "ceiling-grid-framing", name: "Ceiling Grid & Framing" },
      { slug: "jointing-compound", name: "Jointing Compound" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Brands — the 28 featured on buildanta.com
// ---------------------------------------------------------------------------

const BRANDS = [
  // Electrical
  { slug: "havells", name: "Havells" },
  { slug: "polycab", name: "Polycab" },
  { slug: "anchor", name: "Anchor" },
  { slug: "finolex", name: "Finolex" },
  { slug: "crompton", name: "Crompton" },
  { slug: "philips", name: "Philips" },
  // Paints
  { slug: "asian-paints", name: "Asian Paints" },
  { slug: "berger-paints", name: "Berger Paints" },
  { slug: "nerolac-paints", name: "Nerolac Paints" },
  { slug: "birla-opus-paints", name: "Birla Opus Paints" },
  // Tiles
  { slug: "kajaria", name: "Kajaria" },
  { slug: "simpolo", name: "Simpolo" },
  { slug: "hr-johnson", name: "H&R Johnson" },
  { slug: "somany", name: "Somany" },
  // Sanitaryware
  { slug: "cera", name: "Cera" },
  { slug: "hindware", name: "Hindware" },
  { slug: "parryware", name: "Parryware" },
  { slug: "jaquar", name: "Jaquar" },
  { slug: "kohler", name: "Kohler" },
  // Cement
  { slug: "ultratech-cement", name: "UltraTech Cement" },
  { slug: "acc-cement", name: "ACC Cement" },
  { slug: "shree-cement", name: "Shree Cement" },
  { slug: "mp-birla-cement", name: "MP Birla Cement" },
  // Steel
  { slug: "sail", name: "SAIL" },
  { slug: "tata-steel", name: "Tata Steel" },
  { slug: "jsw-steel", name: "JSW Steel" },
  { slug: "jindal-steel", name: "Jindal Steel" },
  // Waterproofing
  { slug: "dr-fixit", name: "Dr Fixit" },
];

const SUPPLIERS = [
  {
    slug: "metro-building-supplies",
    name: "Metro Building Supplies",
    contactName: "Rakesh Menon",
    contactEmail: "orders@metrobuild.example",
    contactPhone: "+91 80 4000 1100",
    city: "Bengaluru",
    region: "Karnataka",
    country: "India",
  },
  {
    slug: "coastal-cement-depot",
    name: "Coastal Cement Depot",
    contactName: "Priya Nair",
    contactEmail: "sales@coastalcement.example",
    contactPhone: "+91 484 220 3300",
    city: "Kochi",
    region: "Kerala",
    country: "India",
  },
  {
    slug: "northline-finishes",
    name: "Northline Finishes",
    contactName: "Amit Sharma",
    contactEmail: "hello@northlinefinishes.example",
    contactPhone: "+91 11 4155 8800",
    city: "New Delhi",
    region: "Delhi",
    country: "India",
  },
  {
    slug: "deccan-electricals",
    name: "Deccan Electricals",
    contactName: "Sudha Rao",
    contactEmail: "desk@deccanelec.example",
    city: "Hyderabad",
    region: "Telangana",
    country: "India",
  },
];

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

interface VariantSeed {
  sku: string;
  name: string;
  price: string;
  unit: SalesUnit;
  packSize?: string;
  weightKg?: string;
  attributes?: Record<string, string>;
  supplier?: string;
  isDefault?: boolean;
}

interface ProductSeed {
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  brand: string;
  rooms: string[];
  stages: string[];
  specifications: Record<string, string>;
  variants: VariantSeed[];
}

const PRODUCTS: ProductSeed[] = [
  {
    slug: "ultratech-opc-53-grade-cement",
    name: "UltraTech OPC 53 Grade Cement",
    summary: "High-strength ordinary Portland cement for structural concrete.",
    description:
      "Ordinary Portland Cement, 53 grade, for reinforced concrete where early strength matters — columns, beams, slabs and precast. Supplied in moisture-resistant bags.",
    category: "cement",
    brand: "ultratech-cement",
    rooms: [],
    stages: ["foundation-structure"],
    specifications: {
      Grade: "53",
      Standard: "IS 269:2015",
      "Compressive strength (28 days)": "53 MPa minimum",
      "Initial setting time": "30 minutes minimum",
      "Shelf life": "3 months from packing",
    },
    variants: [
      {
        sku: "UT-OPC53-50KG",
        name: "50 kg bag",
        price: "435.00",
        unit: "BAG",
        packSize: "1",
        weightKg: "50",
        attributes: { "Pack size": "50 kg" },
        supplier: "coastal-cement-depot",
        isDefault: true,
      },
      {
        sku: "UT-OPC53-PALLET40",
        name: "Pallet of 40 bags",
        price: "16800.00",
        unit: "BUNDLE",
        packSize: "40",
        weightKg: "2000",
        attributes: { "Pack size": "40 × 50 kg" },
        supplier: "coastal-cement-depot",
      },
    ],
  },
  {
    slug: "acc-ppc-cement",
    name: "ACC PPC Cement",
    summary: "Portland pozzolana cement for masonry, plaster and general use.",
    description:
      "Blended pozzolana cement with better workability and lower heat of hydration than OPC. Preferred for brickwork, plastering and mass concrete.",
    category: "cement",
    brand: "acc-cement",
    rooms: [],
    stages: ["walls-masonry", "plastering-waterproofing"],
    specifications: {
      Type: "PPC",
      Standard: "IS 1489 (Part 1)",
      "Fly ash content": "15–35%",
    },
    variants: [
      {
        sku: "ACC-PPC-50KG",
        name: "50 kg bag",
        price: "395.00",
        unit: "BAG",
        packSize: "1",
        weightKg: "50",
        supplier: "coastal-cement-depot",
        isDefault: true,
      },
    ],
  },
  {
    slug: "shree-ppc-cement",
    name: "Shree PPC Cement",
    summary: "Pozzolana cement for plaster and non-structural concrete.",
    description:
      "General-purpose blended cement with a fine grind, giving a smooth plaster finish and reduced shrinkage cracking.",
    category: "cement",
    brand: "shree-cement",
    rooms: [],
    stages: ["plastering-waterproofing", "walls-masonry"],
    specifications: { Type: "PPC", Standard: "IS 1489 (Part 1)" },
    variants: [
      {
        sku: "SHR-PPC-50KG",
        name: "50 kg bag",
        price: "382.00",
        unit: "BAG",
        packSize: "1",
        weightKg: "50",
        supplier: "coastal-cement-depot",
        isDefault: true,
      },
    ],
  },
  {
    slug: "tata-tiscon-tmt-rebar-fe500d",
    name: "Tata Tiscon TMT Rebar Fe500D",
    summary: "Thermo-mechanically treated reinforcement bar, Fe500D grade.",
    description:
      "Ribbed TMT reinforcement bar with high yield strength and good ductility, for reinforced concrete throughout the structure. Sold by weight.",
    category: "tmt-bars",
    brand: "tata-steel",
    rooms: [],
    stages: ["foundation-structure"],
    specifications: {
      Grade: "Fe500D",
      Standard: "IS 1786:2008",
      "Yield strength": "500 MPa minimum",
      Elongation: "16% minimum",
    },
    variants: [
      {
        sku: "TT-TMT-8MM",
        name: "8 mm",
        price: "62500.00",
        unit: "TONNE",
        attributes: { Diameter: "8 mm" },
        supplier: "metro-building-supplies",
      },
      {
        sku: "TT-TMT-10MM",
        name: "10 mm",
        price: "61800.00",
        unit: "TONNE",
        attributes: { Diameter: "10 mm" },
        supplier: "metro-building-supplies",
        isDefault: true,
      },
      {
        sku: "TT-TMT-12MM",
        name: "12 mm",
        price: "61200.00",
        unit: "TONNE",
        attributes: { Diameter: "12 mm" },
        supplier: "metro-building-supplies",
      },
      {
        sku: "TT-TMT-16MM",
        name: "16 mm",
        price: "60900.00",
        unit: "TONNE",
        attributes: { Diameter: "16 mm" },
        supplier: "metro-building-supplies",
      },
      {
        sku: "TT-TMT-20MM",
        name: "20 mm",
        price: "60700.00",
        unit: "TONNE",
        attributes: { Diameter: "20 mm" },
        supplier: "metro-building-supplies",
      },
    ],
  },
  {
    slug: "jsw-neosteel-tmt-fe550d",
    name: "JSW Neosteel TMT Fe550D",
    summary: "Higher-grade TMT bar for heavily loaded members.",
    description:
      "Fe550D reinforcement bar for columns and rafts carrying high load, where a smaller bar diameter at the same capacity eases congestion.",
    category: "tmt-bars",
    brand: "jsw-steel",
    rooms: [],
    stages: ["foundation-structure"],
    specifications: {
      Grade: "Fe550D",
      Standard: "IS 1786:2008",
      "Yield strength": "550 MPa minimum",
    },
    variants: [
      {
        sku: "JSW-TMT-12MM",
        name: "12 mm",
        price: "63400.00",
        unit: "TONNE",
        attributes: { Diameter: "12 mm" },
        supplier: "metro-building-supplies",
        isDefault: true,
      },
      {
        sku: "JSW-TMT-16MM",
        name: "16 mm",
        price: "63100.00",
        unit: "TONNE",
        attributes: { Diameter: "16 mm" },
        supplier: "metro-building-supplies",
      },
    ],
  },
  {
    slug: "aac-block-600x200",
    name: "AAC Block 600 × 200 mm",
    summary: "Lightweight autoclaved aerated concrete block for walls.",
    description:
      "AAC blocks weigh roughly a third of clay brick, cutting dead load and speeding up masonry. Dimensionally accurate, so plaster thickness drops.",
    category: "blocks-bricks",
    brand: "ultratech-cement",
    rooms: [],
    stages: ["walls-masonry"],
    specifications: {
      "Nominal length": "600 mm",
      "Nominal height": "200 mm",
      "Dry density": "550–650 kg/m³",
      "Compressive strength": "3.0 N/mm² minimum",
      "Fire rating": "4 hours",
    },
    variants: [
      {
        sku: "AAC-600-200-100",
        name: "100 mm thick",
        price: "58.00",
        unit: "PIECE",
        weightKg: "7.8",
        attributes: { Thickness: "100 mm" },
        supplier: "metro-building-supplies",
        isDefault: true,
      },
      {
        sku: "AAC-600-200-150",
        name: "150 mm thick",
        price: "84.00",
        unit: "PIECE",
        weightKg: "11.7",
        attributes: { Thickness: "150 mm" },
        supplier: "metro-building-supplies",
      },
      {
        sku: "AAC-600-200-200",
        name: "200 mm thick",
        price: "112.00",
        unit: "PIECE",
        weightKg: "15.6",
        attributes: { Thickness: "200 mm" },
        supplier: "metro-building-supplies",
      },
    ],
  },
  {
    slug: "washed-river-sand",
    name: "Washed River Sand",
    summary: "Graded fine aggregate for concrete, plaster and mortar.",
    description:
      "Screened and washed river sand with silt content low enough for structural concrete and finishing plaster. Sold by volume.",
    category: "aggregate-sand",
    brand: "ultratech-cement",
    rooms: [],
    stages: ["foundation-structure", "walls-masonry", "plastering-waterproofing"],
    specifications: {
      Type: "Fine aggregate",
      Zone: "Zone II per IS 383",
      "Silt content": "< 3%",
    },
    variants: [
      {
        sku: "SAND-RIVER-CUM",
        name: "Per cubic metre",
        price: "2350.00",
        unit: "CUBIC_METRE",
        supplier: "metro-building-supplies",
        isDefault: true,
      },
    ],
  },
  {
    slug: "polycab-fr-house-wire",
    name: "Polycab FR House Wire",
    summary: "Flame-retardant PVC insulated copper wire for domestic circuits.",
    description:
      "Single-core flame-retardant copper wire for lighting, power and earthing circuits. Supplied on 90 m coils.",
    category: "wires-cables",
    brand: "polycab",
    rooms: ["living-room", "bedroom", "kitchen", "study-home-office"],
    stages: ["electrical-wiring"],
    specifications: {
      Conductor: "Annealed copper",
      Insulation: "FR PVC",
      "Voltage rating": "1100 V",
      "Coil length": "90 m",
      Standard: "IS 694",
    },
    variants: [
      {
        sku: "PCB-FR-1.0-90M",
        name: "1.0 mm² × 90 m",
        price: "1180.00",
        unit: "ROLL",
        packSize: "90",
        attributes: { "Cross-section": "1.0 mm²" },
        supplier: "deccan-electricals",
      },
      {
        sku: "PCB-FR-1.5-90M",
        name: "1.5 mm² × 90 m",
        price: "1740.00",
        unit: "ROLL",
        packSize: "90",
        attributes: { "Cross-section": "1.5 mm²" },
        supplier: "deccan-electricals",
        isDefault: true,
      },
      {
        sku: "PCB-FR-2.5-90M",
        name: "2.5 mm² × 90 m",
        price: "2790.00",
        unit: "ROLL",
        packSize: "90",
        attributes: { "Cross-section": "2.5 mm²" },
        supplier: "deccan-electricals",
      },
      {
        sku: "PCB-FR-4.0-90M",
        name: "4.0 mm² × 90 m",
        price: "4380.00",
        unit: "ROLL",
        packSize: "90",
        attributes: { "Cross-section": "4.0 mm²" },
        supplier: "deccan-electricals",
      },
    ],
  },
  {
    slug: "finolex-flame-retardant-cable",
    name: "Finolex Flame Retardant Cable",
    summary: "FR copper cable for concealed conduit wiring.",
    description:
      "Electrolytic-grade copper conductor with FR PVC insulation, for concealed conduit runs in domestic and light commercial work.",
    category: "wires-cables",
    brand: "finolex",
    rooms: ["living-room", "bedroom", "study-home-office"],
    stages: ["electrical-wiring"],
    specifications: {
      Conductor: "Electrolytic copper",
      Insulation: "FR PVC",
      "Coil length": "90 m",
    },
    variants: [
      {
        sku: "FNX-FR-1.5-90M",
        name: "1.5 mm² × 90 m",
        price: "1695.00",
        unit: "ROLL",
        packSize: "90",
        attributes: { "Cross-section": "1.5 mm²" },
        supplier: "deccan-electricals",
        isDefault: true,
      },
      {
        sku: "FNX-FR-2.5-90M",
        name: "2.5 mm² × 90 m",
        price: "2710.00",
        unit: "ROLL",
        packSize: "90",
        attributes: { "Cross-section": "2.5 mm²" },
        supplier: "deccan-electricals",
      },
    ],
  },
  {
    slug: "anchor-roma-modular-switches",
    name: "Anchor Roma Modular Switch Range",
    summary: "Modular switches and sockets on a common plate system.",
    description:
      "Modular switch range with polycarbonate plates and captive screws, compatible with standard modular boxes.",
    category: "switches-sockets",
    brand: "anchor",
    rooms: ["living-room", "bedroom", "kitchen", "bathroom", "study-home-office"],
    stages: ["electrical-wiring", "paint-finishing"],
    specifications: {
      Material: "Polycarbonate",
      "Current rating": "6 A / 16 A",
      Standard: "IS 3854",
    },
    variants: [
      {
        sku: "ANC-ROMA-1WAY-6A",
        name: "6 A one-way switch",
        price: "72.00",
        unit: "PIECE",
        supplier: "deccan-electricals",
        isDefault: true,
      },
      {
        sku: "ANC-ROMA-SOCK-6A",
        name: "6 A two-pin socket",
        price: "96.00",
        unit: "PIECE",
        supplier: "deccan-electricals",
      },
      {
        sku: "ANC-ROMA-SOCK-16A",
        name: "16 A three-pin socket",
        price: "168.00",
        unit: "PIECE",
        supplier: "deccan-electricals",
      },
    ],
  },
  {
    slug: "havells-mcb-distribution-board",
    name: "Havells MCB Distribution Board",
    summary: "Double-door SPN distribution board for domestic circuits.",
    description:
      "Powder-coated sheet steel distribution board with DIN rail and neutral link, for MCB protection of domestic final circuits.",
    category: "mcb-distribution-boards",
    brand: "havells",
    rooms: [],
    stages: ["electrical-wiring"],
    specifications: {
      Type: "SPN double door",
      "Ingress protection": "IP43",
      Standard: "IS 8623",
    },
    variants: [
      {
        sku: "HAV-DB-SPN-8W",
        name: "8-way",
        price: "1450.00",
        unit: "PIECE",
        supplier: "deccan-electricals",
        isDefault: true,
      },
      {
        sku: "HAV-DB-SPN-12W",
        name: "12-way",
        price: "1980.00",
        unit: "PIECE",
        supplier: "deccan-electricals",
      },
    ],
  },
  {
    slug: "philips-led-panel-light",
    name: "Philips LED Panel Light",
    summary: "Recessed LED panel for false ceilings.",
    description:
      "Slim recessed LED panel with uniform diffusion, sized for standard gypsum ceiling cut-outs.",
    category: "lighting",
    brand: "philips",
    rooms: ["living-room", "bedroom", "kitchen", "study-home-office"],
    stages: ["false-ceiling", "paint-finishing"],
    specifications: {
      "Colour temperature": "4000 K neutral white",
      "Beam angle": "120°",
      "Rated life": "25,000 hours",
    },
    variants: [
      {
        sku: "PHI-PANEL-10W",
        name: "10 W round",
        price: "540.00",
        unit: "PIECE",
        attributes: { Wattage: "10 W" },
        supplier: "deccan-electricals",
        isDefault: true,
      },
      {
        sku: "PHI-PANEL-15W",
        name: "15 W round",
        price: "720.00",
        unit: "PIECE",
        attributes: { Wattage: "15 W" },
        supplier: "deccan-electricals",
      },
      {
        sku: "PHI-PANEL-22W",
        name: "22 W square",
        price: "980.00",
        unit: "PIECE",
        attributes: { Wattage: "22 W" },
        supplier: "deccan-electricals",
      },
    ],
  },
  {
    slug: "crompton-ceiling-fan",
    name: "Crompton Ceiling Fan",
    summary: "1200 mm sweep ceiling fan with high air delivery.",
    description:
      "Aluminium-blade ceiling fan with a double ball bearing motor, sized for standard bedrooms and living rooms.",
    category: "fans",
    brand: "crompton",
    rooms: ["living-room", "bedroom", "study-home-office"],
    stages: ["electrical-wiring", "paint-finishing"],
    specifications: {
      Sweep: "1200 mm",
      "Air delivery": "230 m³/min",
      "Power input": "74 W",
      Speed: "370 rpm",
    },
    variants: [
      {
        sku: "CRM-FAN-1200-BR",
        name: "1200 mm, brown",
        price: "1690.00",
        unit: "PIECE",
        attributes: { Colour: "Brown" },
        supplier: "deccan-electricals",
        isDefault: true,
      },
      {
        sku: "CRM-FAN-1200-WH",
        name: "1200 mm, white",
        price: "1690.00",
        unit: "PIECE",
        attributes: { Colour: "White" },
        supplier: "deccan-electricals",
      },
    ],
  },
  {
    slug: "asian-paints-royale-luxury-emulsion",
    name: "Asian Paints Royale Luxury Emulsion",
    summary: "Low-sheen interior emulsion with a smooth, washable finish.",
    description:
      "Premium interior emulsion with good coverage, a soft sheen and a washable surface. Low VOC, suited to living rooms and bedrooms.",
    category: "interior-paint",
    brand: "asian-paints",
    rooms: ["living-room", "bedroom", "study-home-office"],
    stages: ["paint-finishing"],
    specifications: {
      Finish: "Low sheen",
      Coverage: "140–160 sq ft per litre per coat",
      "Recoat time": "4–6 hours",
      "Coats recommended": "2",
    },
    variants: [
      {
        sku: "AP-ROYALE-1L",
        name: "1 litre",
        price: "620.00",
        unit: "LITRE",
        packSize: "1",
        supplier: "northline-finishes",
      },
      {
        sku: "AP-ROYALE-4L",
        name: "4 litre",
        price: "2340.00",
        unit: "LITRE",
        packSize: "4",
        supplier: "northline-finishes",
        isDefault: true,
      },
      {
        sku: "AP-ROYALE-10L",
        name: "10 litre",
        price: "5650.00",
        unit: "LITRE",
        packSize: "10",
        supplier: "northline-finishes",
      },
      {
        sku: "AP-ROYALE-20L",
        name: "20 litre",
        price: "10850.00",
        unit: "LITRE",
        packSize: "20",
        supplier: "northline-finishes",
      },
    ],
  },
  {
    slug: "berger-weathercoat-anti-dust",
    name: "Berger WeatherCoat Anti Dust",
    summary: "Exterior emulsion that resists dust pickup and monsoon staining.",
    description:
      "Exterior acrylic emulsion formulated to shed dust and withstand heavy rain, keeping façades cleaner between repaints.",
    category: "exterior-paint",
    brand: "berger-paints",
    rooms: ["balcony-terrace"],
    stages: ["paint-finishing"],
    specifications: {
      Finish: "Matt",
      Coverage: "100–120 sq ft per litre per coat",
      "Dust resistance": "Anti-dust formulation",
    },
    variants: [
      {
        sku: "BRG-WC-AD-4L",
        name: "4 litre",
        price: "1980.00",
        unit: "LITRE",
        packSize: "4",
        supplier: "northline-finishes",
        isDefault: true,
      },
      {
        sku: "BRG-WC-AD-20L",
        name: "20 litre",
        price: "8900.00",
        unit: "LITRE",
        packSize: "20",
        supplier: "northline-finishes",
      },
    ],
  },
  {
    slug: "birla-opus-wall-putty",
    name: "Birla Opus Wall Putty",
    summary: "White cement-based putty for levelling interior plaster.",
    description:
      "White cement putty that fills fine plaster imperfections and gives a smooth, low-absorption base for emulsion, reducing paint consumption.",
    category: "primers-putty",
    brand: "birla-opus-paints",
    rooms: ["living-room", "bedroom", "study-home-office"],
    stages: ["plastering-waterproofing", "paint-finishing"],
    specifications: {
      Base: "White cement",
      Coverage: "16–18 sq ft per kg for two coats",
      "Drying time": "3–4 hours between coats",
    },
    variants: [
      {
        sku: "BOP-PUTTY-20KG",
        name: "20 kg bag",
        price: "620.00",
        unit: "BAG",
        packSize: "1",
        weightKg: "20",
        supplier: "northline-finishes",
        isDefault: true,
      },
      {
        sku: "BOP-PUTTY-40KG",
        name: "40 kg bag",
        price: "1180.00",
        unit: "BAG",
        packSize: "1",
        weightKg: "40",
        supplier: "northline-finishes",
      },
    ],
  },
  {
    slug: "nerolac-impressions-interior-emulsion",
    name: "Nerolac Impressions Interior Emulsion",
    summary: "Interior emulsion with a soft sheen and low odour.",
    description:
      "Water-based interior emulsion with low odour, suitable for occupied homes being repainted room by room.",
    category: "interior-paint",
    brand: "nerolac-paints",
    rooms: ["living-room", "bedroom"],
    stages: ["paint-finishing"],
    specifications: {
      Finish: "Soft sheen",
      Coverage: "130–150 sq ft per litre per coat",
    },
    variants: [
      {
        sku: "NRL-IMP-4L",
        name: "4 litre",
        price: "2150.00",
        unit: "LITRE",
        packSize: "4",
        supplier: "northline-finishes",
        isDefault: true,
      },
      {
        sku: "NRL-IMP-10L",
        name: "10 litre",
        price: "5180.00",
        unit: "LITRE",
        packSize: "10",
        supplier: "northline-finishes",
      },
    ],
  },
  {
    slug: "kajaria-vitrified-floor-tile-matt-grey",
    name: "Kajaria Vitrified Floor Tile — Matt Grey",
    summary: "600 × 600 mm double-charged vitrified tile, matt finish.",
    description:
      "Double-charged vitrified tile with low water absorption and high abrasion resistance, for living areas and corridors. Matt surface gives better slip resistance than gloss.",
    category: "floor-tiles",
    brand: "kajaria",
    rooms: ["living-room", "bedroom", "kitchen"],
    stages: ["flooring-tiling"],
    specifications: {
      Size: "600 × 600 mm",
      Finish: "Matt",
      Thickness: "9 mm",
      "Water absorption": "< 0.5%",
      "Coverage per box": "1.44 m²",
    },
    variants: [
      {
        sku: "KAJ-VIT-600-GREY-BOX",
        name: "Box of 4 tiles (1.44 m²)",
        price: "1090.00",
        unit: "BOX",
        packSize: "4",
        weightKg: "31",
        attributes: { Colour: "Matt grey", Coverage: "1.44 m²" },
        supplier: "northline-finishes",
        isDefault: true,
      },
      {
        sku: "KAJ-VIT-600-GREY-SQM",
        name: "Per square metre",
        price: "757.00",
        unit: "SQUARE_METRE",
        attributes: { Colour: "Matt grey" },
        supplier: "northline-finishes",
      },
    ],
  },
  {
    slug: "somany-ceramic-wall-tile-gloss-white",
    name: "Somany Ceramic Wall Tile — Gloss White",
    summary: "300 × 600 mm glazed ceramic wall tile.",
    description:
      "Glazed ceramic wall tile with a bright gloss finish that keeps small bathrooms feeling larger. Rectified edges allow narrow grout joints.",
    category: "wall-tiles",
    brand: "somany",
    rooms: ["bathroom", "kitchen"],
    stages: ["flooring-tiling"],
    specifications: {
      Size: "300 × 600 mm",
      Finish: "Gloss",
      Thickness: "8 mm",
      "Coverage per box": "1.08 m²",
    },
    variants: [
      {
        sku: "SOM-WALL-300600-WHT",
        name: "Box of 6 tiles (1.08 m²)",
        price: "640.00",
        unit: "BOX",
        packSize: "6",
        weightKg: "18",
        attributes: { Colour: "Gloss white", Coverage: "1.08 m²" },
        supplier: "northline-finishes",
        isDefault: true,
      },
    ],
  },
  {
    slug: "hr-johnson-anti-skid-floor-tile",
    name: "H&R Johnson Anti-Skid Floor Tile",
    summary: "300 × 300 mm textured tile for wet areas and balconies.",
    description:
      "Matt textured ceramic tile with raised slip resistance, intended for bathroom floors, balconies and utility areas that stay wet.",
    category: "floor-tiles",
    brand: "hr-johnson",
    rooms: ["bathroom", "balcony-terrace"],
    stages: ["flooring-tiling"],
    specifications: {
      Size: "300 × 300 mm",
      Finish: "Matt anti-skid",
      "Coverage per box": "1.00 m²",
    },
    variants: [
      {
        sku: "HRJ-AS-300-BOX",
        name: "Box of 11 tiles (1.00 m²)",
        price: "480.00",
        unit: "BOX",
        packSize: "11",
        weightKg: "16",
        attributes: { Coverage: "1.00 m²" },
        supplier: "northline-finishes",
        isDefault: true,
      },
    ],
  },
  {
    slug: "simpolo-glazed-vitrified-tile",
    name: "Simpolo Glazed Vitrified Tile",
    summary: "800 × 800 mm glazed vitrified tile with a stone-look surface.",
    description:
      "Large-format glazed vitrified tile printed with a natural stone pattern, for living rooms where fewer joints are wanted.",
    category: "floor-tiles",
    brand: "simpolo",
    rooms: ["living-room"],
    stages: ["flooring-tiling"],
    specifications: {
      Size: "800 × 800 mm",
      Finish: "Glazed satin",
      Thickness: "10 mm",
      "Coverage per box": "1.28 m²",
    },
    variants: [
      {
        sku: "SMP-GVT-800-BOX",
        name: "Box of 2 tiles (1.28 m²)",
        price: "1560.00",
        unit: "BOX",
        packSize: "2",
        weightKg: "37",
        attributes: { Coverage: "1.28 m²" },
        supplier: "northline-finishes",
        isDefault: true,
      },
    ],
  },
  {
    slug: "tile-adhesive-c1te",
    name: "Tile Adhesive C1TE",
    summary: "Cement-based adhesive for ceramic and vitrified tile.",
    description:
      "Polymer-modified cement adhesive with extended open time, for fixing ceramic and vitrified tile to concrete and cement plaster.",
    category: "tile-adhesive-grout",
    brand: "dr-fixit",
    rooms: ["bathroom", "kitchen", "living-room"],
    stages: ["flooring-tiling"],
    specifications: {
      Classification: "C1TE per IS 15477",
      Coverage: "4–5 m² per 20 kg bag at 3 mm",
      "Open time": "20 minutes",
      "Pot life": "3 hours",
    },
    variants: [
      {
        sku: "TA-C1TE-20KG",
        name: "20 kg bag",
        price: "410.00",
        unit: "BAG",
        packSize: "1",
        weightKg: "20",
        supplier: "northline-finishes",
        isDefault: true,
      },
    ],
  },
  {
    slug: "jaquar-single-lever-basin-mixer",
    name: "Jaquar Single Lever Basin Mixer",
    summary: "Chrome-finished single lever mixer for wash basins.",
    description:
      "Brass-bodied single lever basin mixer with a ceramic cartridge and chrome finish, supplied with connecting hoses.",
    category: "cp-fittings",
    brand: "jaquar",
    rooms: ["bathroom"],
    stages: ["bathroom-plumbing"],
    specifications: {
      Body: "Brass",
      Finish: "Chrome",
      Cartridge: "35 mm ceramic",
      "Working pressure": "0.5–5 bar",
    },
    variants: [
      {
        sku: "JAQ-SLBM-CHR",
        name: "Chrome",
        price: "4850.00",
        unit: "PIECE",
        supplier: "metro-building-supplies",
        isDefault: true,
      },
    ],
  },
  {
    slug: "hindware-wall-hung-wc",
    name: "Hindware Wall Hung WC",
    summary: "Rimless wall-hung water closet with soft-close seat.",
    description:
      "Vitreous china wall-hung WC with a rimless flushing rim that is easier to clean, supplied with a soft-close seat cover. Concealed cistern sold separately.",
    category: "wc-basins",
    brand: "hindware",
    rooms: ["bathroom"],
    stages: ["bathroom-plumbing"],
    specifications: {
      Material: "Vitreous china",
      Mounting: "Wall hung",
      "Flush volume": "3 / 6 litre dual",
      "Seat type": "Soft close",
    },
    variants: [
      {
        sku: "HIN-WHWC-WHT",
        name: "White",
        price: "12400.00",
        unit: "PIECE",
        weightKg: "26",
        attributes: { Colour: "White" },
        supplier: "metro-building-supplies",
        isDefault: true,
      },
    ],
  },
  {
    slug: "cera-pedestal-wash-basin",
    name: "Cera Pedestal Wash Basin",
    summary: "Vitreous china basin with matching full pedestal.",
    description:
      "Pedestal wash basin in vitreous china, with a single tap hole and integral overflow. The pedestal conceals the trap and supply.",
    category: "wc-basins",
    brand: "cera",
    rooms: ["bathroom"],
    stages: ["bathroom-plumbing"],
    specifications: {
      Material: "Vitreous china",
      "Tap holes": "1",
      Overflow: "Integral",
    },
    variants: [
      {
        sku: "CER-PED-BASIN-WHT",
        name: "White",
        price: "5650.00",
        unit: "PIECE",
        weightKg: "22",
        attributes: { Colour: "White" },
        supplier: "metro-building-supplies",
        isDefault: true,
      },
    ],
  },
  {
    slug: "kohler-overhead-shower",
    name: "Kohler Overhead Shower",
    summary: "200 mm square overhead shower with silicone nozzles.",
    description:
      "Overhead rain shower with self-cleaning silicone nozzles that resist scaling in hard water. Shower arm sold separately.",
    category: "showers",
    brand: "kohler",
    rooms: ["bathroom"],
    stages: ["bathroom-plumbing"],
    specifications: {
      Size: "200 × 200 mm",
      Finish: "Chrome",
      "Spray pattern": "Rain",
      Nozzles: "Self-cleaning silicone",
    },
    variants: [
      {
        sku: "KOH-OHS-200-CHR",
        name: "200 mm chrome",
        price: "7250.00",
        unit: "PIECE",
        supplier: "metro-building-supplies",
        isDefault: true,
      },
    ],
  },
  {
    slug: "parryware-cpvc-pipe",
    name: "Parryware CPVC Pipe",
    summary: "Hot and cold water CPVC pipe for internal plumbing.",
    description:
      "Chlorinated PVC pipe rated for hot and cold potable water with solvent-cement joints. Standard choice for concealed bathroom and kitchen plumbing.",
    category: "pipes-fittings",
    brand: "parryware",
    rooms: ["bathroom", "kitchen"],
    stages: ["bathroom-plumbing"],
    specifications: {
      Material: "CPVC",
      Standard: "ASTM D2846",
      "Max temperature": "93 °C",
      "Length per piece": "3 m",
    },
    variants: [
      {
        sku: "PAR-CPVC-15MM-3M",
        name: "15 mm × 3 m",
        price: "268.00",
        unit: "PIECE",
        packSize: "1",
        attributes: { Diameter: "15 mm", Length: "3 m" },
        supplier: "metro-building-supplies",
        isDefault: true,
      },
      {
        sku: "PAR-CPVC-20MM-3M",
        name: "20 mm × 3 m",
        price: "392.00",
        unit: "PIECE",
        packSize: "1",
        attributes: { Diameter: "20 mm", Length: "3 m" },
        supplier: "metro-building-supplies",
      },
      {
        sku: "PAR-CPVC-25MM-3M",
        name: "25 mm × 3 m",
        price: "560.00",
        unit: "PIECE",
        packSize: "1",
        attributes: { Diameter: "25 mm", Length: "3 m" },
        supplier: "metro-building-supplies",
      },
    ],
  },
  {
    slug: "dr-fixit-lw-plus",
    name: "Dr Fixit LW+ Waterproofing Compound",
    summary: "Integral liquid waterproofing admixture for concrete and mortar.",
    description:
      "Added at the mixing stage to reduce permeability in concrete and plaster. Used in foundations, sunken slabs, terraces and external plaster.",
    category: "waterproofing-compounds",
    brand: "dr-fixit",
    rooms: ["bathroom", "balcony-terrace"],
    stages: ["plastering-waterproofing", "foundation-structure"],
    specifications: {
      Type: "Integral liquid admixture",
      Standard: "IS 2645:2003",
      Dosage: "200 ml per 50 kg cement bag",
      Appearance: "Pale yellow liquid",
    },
    variants: [
      {
        sku: "DF-LWPLUS-1L",
        name: "1 litre",
        price: "185.00",
        unit: "LITRE",
        packSize: "1",
        supplier: "northline-finishes",
      },
      {
        sku: "DF-LWPLUS-5L",
        name: "5 litre",
        price: "820.00",
        unit: "LITRE",
        packSize: "5",
        supplier: "northline-finishes",
        isDefault: true,
      },
      {
        sku: "DF-LWPLUS-20L",
        name: "20 litre",
        price: "3050.00",
        unit: "LITRE",
        packSize: "20",
        supplier: "northline-finishes",
      },
    ],
  },
  {
    slug: "app-modified-bitumen-membrane-3mm",
    name: "APP Modified Bitumen Membrane 3 mm",
    summary: "Torch-applied waterproofing membrane for terraces and roofs.",
    description:
      "Polymer-modified bitumen membrane reinforced with a polyester mat, torch-applied to give a continuous waterproof layer over roof slabs and terraces.",
    category: "membranes",
    brand: "dr-fixit",
    rooms: ["balcony-terrace"],
    stages: ["plastering-waterproofing"],
    specifications: {
      Thickness: "3 mm",
      Reinforcement: "Polyester mat",
      "Roll size": "1 m × 10 m",
      "Softening point": "150 °C",
    },
    variants: [
      {
        sku: "APP-MEM-3MM-ROLL",
        name: "Roll, 10 m²",
        price: "2450.00",
        unit: "ROLL",
        packSize: "10",
        weightKg: "33",
        attributes: { Coverage: "10 m²" },
        supplier: "metro-building-supplies",
        isDefault: true,
      },
    ],
  },
  {
    slug: "gypsum-ceiling-board-12mm",
    name: "Gypsum Ceiling Board 12.5 mm",
    summary: "Tapered-edge gypsum board for suspended ceilings.",
    description:
      "Tapered-edge plasterboard for screw fixing to a GI framing grid, giving a jointless painted ceiling once taped and finished.",
    category: "gypsum-board",
    brand: "ultratech-cement",
    rooms: ["living-room", "bedroom", "kitchen", "study-home-office"],
    stages: ["false-ceiling"],
    specifications: {
      Thickness: "12.5 mm",
      "Board size": "2400 × 1200 mm",
      "Edge profile": "Tapered",
      "Coverage per board": "2.88 m²",
    },
    variants: [
      {
        sku: "GYP-BOARD-12.5",
        name: "2400 × 1200 mm board",
        price: "615.00",
        unit: "SHEET",
        weightKg: "26",
        attributes: { Coverage: "2.88 m²" },
        supplier: "metro-building-supplies",
        isDefault: true,
      },
    ],
  },
  {
    slug: "gi-ceiling-framing-channel",
    name: "GI Ceiling Framing Channel",
    summary: "Galvanised steel channel for gypsum ceiling grids.",
    description:
      "Roll-formed galvanised channel for ceiling suspension grids, in intermediate and ceiling sections.",
    category: "ceiling-grid-framing",
    brand: "sail",
    rooms: [],
    stages: ["false-ceiling"],
    specifications: {
      Material: "Galvanised steel",
      "Zinc coating": "120 gsm",
      "Length per piece": "3 m",
    },
    variants: [
      {
        sku: "GI-CEIL-SECTION-3M",
        name: "Ceiling section, 3 m",
        price: "212.00",
        unit: "PIECE",
        packSize: "1",
        supplier: "metro-building-supplies",
        isDefault: true,
      },
      {
        sku: "GI-INTER-SECTION-3M",
        name: "Intermediate section, 3 m",
        price: "268.00",
        unit: "PIECE",
        packSize: "1",
        supplier: "metro-building-supplies",
      },
    ],
  },
  {
    slug: "jindal-upvc-sliding-window",
    name: "UPVC Sliding Window",
    summary: "Two-track UPVC sliding window with 5 mm glazing.",
    description:
      "Multi-chambered UPVC frame with a two-track sliding sash, EPDM gaskets and stainless rollers. Priced by area of opening.",
    category: "windows-glazing",
    brand: "jindal-steel",
    rooms: ["living-room", "bedroom", "study-home-office"],
    stages: ["doors-windows-railings-glass"],
    specifications: {
      Frame: "Multi-chambered UPVC",
      Glazing: "5 mm clear float",
      Tracks: "2",
      Gasket: "EPDM",
    },
    variants: [
      {
        sku: "UPVC-SLIDE-SQM",
        name: "Per square metre",
        price: "5400.00",
        unit: "SQUARE_METRE",
        supplier: "metro-building-supplies",
        isDefault: true,
      },
    ],
  },
  {
    slug: "flush-door-shutter-30mm",
    name: "Flush Door Shutter 30 mm",
    summary: "Solid-core flush door shutter, both faces ready for finish.",
    description:
      "Block-board core flush shutter with hardwood lipping on all four edges, supplied unfinished for site painting or laminating.",
    category: "door-frames-shutters",
    brand: "sail",
    rooms: ["bedroom", "bathroom", "study-home-office"],
    stages: ["doors-windows-railings-glass"],
    specifications: {
      Thickness: "30 mm",
      Core: "Block board",
      Lipping: "Hardwood, four edges",
      Standard: "IS 2202",
    },
    variants: [
      {
        sku: "FLUSH-DOOR-2100-750",
        name: "2100 × 750 mm",
        price: "3250.00",
        unit: "PIECE",
        attributes: { Size: "2100 × 750 mm" },
        supplier: "metro-building-supplies",
        isDefault: true,
      },
      {
        sku: "FLUSH-DOOR-2100-900",
        name: "2100 × 900 mm",
        price: "3780.00",
        unit: "PIECE",
        attributes: { Size: "2100 × 900 mm" },
        supplier: "metro-building-supplies",
      },
    ],
  },
  {
    slug: "modular-kitchen-base-unit",
    name: "Modular Kitchen Base Unit",
    summary: "Carcass with drawers for a modular kitchen run.",
    description:
      "Pre-assembled base carcass in moisture-resistant board with soft-close drawer channels. Shutters and counter sold separately.",
    category: "door-hardware",
    brand: "hindware",
    rooms: ["kitchen"],
    stages: ["kitchen-wardrobes"],
    specifications: {
      Board: "Moisture-resistant MDF",
      Depth: "580 mm",
      Height: "850 mm",
      Channels: "Soft close",
    },
    variants: [
      {
        sku: "KIT-BASE-600",
        name: "600 mm wide",
        price: "9800.00",
        unit: "PIECE",
        attributes: { Width: "600 mm" },
        supplier: "northline-finishes",
        isDefault: true,
      },
      {
        sku: "KIT-BASE-900",
        name: "900 mm wide",
        price: "13400.00",
        unit: "PIECE",
        attributes: { Width: "900 mm" },
        supplier: "northline-finishes",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed routines
// ---------------------------------------------------------------------------

async function seedStages(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  let order = 0;

  // sortOrder carries the real build chronology; the storefront navigation and
  // the stage-to-stage "next" links both rely on it.
  for (const stage of STAGES) {
    const row = await prisma.constructionStage.upsert({
      where: { slug: stage.slug },
      update: {
        name: stage.name,
        description: stage.description,
        sortOrder: order,
      },
      create: { ...stage, sortOrder: order },
    });
    ids.set(stage.slug, row.id);
    order += 10;
  }

  console.log(`  build stages: ${ids.size}`);
  return ids;
}

async function seedRooms(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  let order = 0;

  for (const room of ROOMS) {
    const row = await prisma.room.upsert({
      where: { slug: room.slug },
      update: { name: room.name, description: room.description, sortOrder: order },
      create: { ...room, sortOrder: order },
    });
    ids.set(room.slug, row.id);
    order += 10;
  }

  console.log(`  rooms: ${ids.size}`);
  return ids;
}

async function seedCategories(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  let order = 0;

  for (const parent of CATEGORIES) {
    const created = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: {
        name: parent.name,
        description: parent.description ?? null,
        sortOrder: order,
      },
      create: {
        slug: parent.slug,
        name: parent.name,
        description: parent.description ?? null,
        sortOrder: order,
      },
    });
    ids.set(parent.slug, created.id);
    order += 10;

    let childOrder = 0;
    for (const child of parent.children ?? []) {
      const createdChild = await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: created.id, sortOrder: childOrder },
        create: {
          slug: child.slug,
          name: child.name,
          parentId: created.id,
          sortOrder: childOrder,
        },
      });
      ids.set(child.slug, createdChild.id);
      childOrder += 10;
    }
  }

  console.log(`  categories: ${ids.size}`);
  return ids;
}

async function seedBrands(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const brand of BRANDS) {
    const row = await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: { name: brand.name },
      create: brand,
    });
    ids.set(brand.slug, row.id);
  }
  console.log(`  brands: ${ids.size}`);
  return ids;
}

async function seedSuppliers(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const supplier of SUPPLIERS) {
    const row = await prisma.supplier.upsert({
      where: { slug: supplier.slug },
      update: supplier,
      create: supplier,
    });
    ids.set(supplier.slug, row.id);
  }
  console.log(`  suppliers: ${ids.size}`);
  return ids;
}

function requireId(map: Map<string, string>, slug: string, kind: string): string {
  const id = map.get(slug);
  if (!id) throw new Error(`Unknown ${kind} slug in seed data: ${slug}`);
  return id;
}

async function seedProducts(
  categories: Map<string, string>,
  brands: Map<string, string>,
  rooms: Map<string, string>,
  stages: Map<string, string>,
  suppliers: Map<string, string>,
): Promise<void> {
  const currency = process.env["DEFAULT_CURRENCY"] ?? "INR";
  let variantTotal = 0;

  for (const seed of PRODUCTS) {
    const categoryId = requireId(categories, seed.category, "category");
    const brandId = requireId(brands, seed.brand, "brand");
    const roomConnect = seed.rooms.map((slug) => ({
      id: requireId(rooms, slug, "room"),
    }));
    const stageConnect = seed.stages.map((slug) => ({
      id: requireId(stages, slug, "stage"),
    }));

    const product = await prisma.product.upsert({
      where: { slug: seed.slug },
      update: {
        name: seed.name,
        summary: seed.summary,
        description: seed.description,
        categoryId,
        brandId,
        specifications: seed.specifications,
        // `set` not `connect`: re-running the seed should make the taxonomy match
        // the seed file exactly, not accumulate stale links.
        rooms: { set: roomConnect },
        stages: { set: stageConnect },
      },
      create: {
        slug: seed.slug,
        name: seed.name,
        summary: seed.summary,
        description: seed.description,
        categoryId,
        brandId,
        specifications: seed.specifications,
        // Seeded products are published so the storefront has something to show.
        // The publish precondition (a variant and an image) is enforced by the
        // admin router; the seed creates variants immediately below.
        status: "ACTIVE",
        publishedAt: new Date(),
        rooms: { connect: roomConnect },
        stages: { connect: stageConnect },
      },
      select: { id: true },
    });

    for (const variant of seed.variants) {
      const data = {
        productId: product.id,
        name: variant.name,
        price: new Prisma.Decimal(variant.price),
        currency,
        unit: variant.unit,
        packSize: variant.packSize ? new Prisma.Decimal(variant.packSize) : null,
        weightKg: variant.weightKg ? new Prisma.Decimal(variant.weightKg) : null,
        attributes: variant.attributes ?? {},
        supplierId: variant.supplier
          ? requireId(suppliers, variant.supplier, "supplier")
          : null,
        isDefault: variant.isDefault ?? false,
      };

      await prisma.productVariant.upsert({
        where: { sku: variant.sku },
        update: data,
        create: { ...data, sku: variant.sku },
      });
      variantTotal += 1;
    }

    // The denormalized price columns are normally written by
    // recomputeProductPricing() in packages/api. The seed writes variants
    // directly, so it recomputes them here with the same logic.
    const aggregate = await prisma.productVariant.aggregate({
      where: { productId: product.id, isActive: true },
      _min: { price: true },
      _max: { price: true },
      _count: { _all: true },
    });

    await prisma.product.update({
      where: { id: product.id },
      data: {
        minPrice: aggregate._min.price,
        maxPrice: aggregate._max.price,
        priceCurrency: currency,
        activeVariantCount: aggregate._count._all,
      },
    });
  }

  console.log(`  products: ${PRODUCTS.length}, variants: ${variantTotal}`);
}

/**
 * Two example quote requests, so the admin inbox is not empty on first run and
 * the status workflow can be exercised without filling in the public form.
 */
async function seedQuoteRequests(): Promise<void> {
  const cement = await prisma.productVariant.findUnique({
    where: { sku: "UT-OPC53-50KG" },
    select: { id: true, sku: true, name: true, unit: true, price: true, currency: true, product: { select: { name: true } } },
  });
  const steel = await prisma.productVariant.findUnique({
    where: { sku: "TT-TMT-12MM" },
    select: { id: true, sku: true, name: true, unit: true, price: true, currency: true, product: { select: { name: true } } },
  });

  if (!cement || !steel) {
    console.log("  quote requests: skipped (variants missing)");
    return;
  }

  const year = new Date().getFullYear();

  await prisma.quoteRequest.upsert({
    where: { reference: `BQ-${year}-0001` },
    update: {},
    create: {
      reference: `BQ-${year}-0001`,
      status: "NEW",
      contactName: "Anand Krishnan",
      contactEmail: "anand@sitebuilders.example",
      contactPhone: "+91 98450 11223",
      companyName: "Site Builders LLP",
      projectName: "Whitefield duplex — structure package",
      deliveryPincode: "560066",
      message:
        "Need cement and 12 mm steel for the first-floor slab. Delivery in two lots, first by the 12th.",
      items: {
        create: [
          {
            variantId: cement.id,
            productName: cement.product.name,
            variantName: cement.name,
            sku: cement.sku,
            unit: cement.unit,
            unitPrice: cement.price,
            currency: cement.currency,
            quantity: new Prisma.Decimal("400"),
            note: "Fresh stock only, please share packing date.",
          },
          {
            variantId: steel.id,
            productName: steel.product.name,
            variantName: steel.name,
            sku: steel.sku,
            unit: steel.unit,
            unitPrice: steel.price,
            currency: steel.currency,
            quantity: new Prisma.Decimal("3.5"),
          },
        ],
      },
    },
  });

  await prisma.quoteRequest.upsert({
    where: { reference: `BQ-${year}-0002` },
    update: {},
    create: {
      reference: `BQ-${year}-0002`,
      status: "IN_REVIEW",
      contactName: "Meera Joseph",
      contactEmail: "meera.joseph@example.com",
      contactPhone: "+91 99620 44556",
      projectName: "Two-bedroom flat interior repaint",
      deliveryPincode: "682024",
      message: "Interior emulsion for roughly 1,400 sq ft. Shade card advice welcome.",
      internalNotes: "Called back 2pm — wants a site visit before quoting.",
      items: {
        create: [
          {
            productName: "Asian Paints Royale Luxury Emulsion",
            variantName: "20 litre",
            sku: "AP-ROYALE-20L",
            unit: "LITRE",
            unitPrice: new Prisma.Decimal("10850.00"),
            currency: "INR",
            quantity: new Prisma.Decimal("2"),
          },
        ],
      },
    },
  });

  // Keeps the counter ahead of the references just inserted, so the first
  // request submitted through the public form does not collide.
  await prisma.quoteReferenceCounter.upsert({
    where: { year },
    update: { lastValue: 2 },
    create: { year, lastValue: 2 },
  });

  console.log("  quote requests: 2");
}

async function main(): Promise<void> {
  console.log("Seeding Buildanta development data…");
  await seedAdmin();
  const stages = await seedStages();
  const rooms = await seedRooms();
  const categories = await seedCategories();
  const brands = await seedBrands();
  const suppliers = await seedSuppliers();
  await seedProducts(categories, brands, rooms, stages, suppliers);
  await seedQuoteRequests();
  console.log(
    "\nDone. Seeded products have no images yet — publishing from the admin app " +
      "requires one, so upload images there to exercise that path.",
  );
}

main()
  .catch((error: unknown) => {
    console.error("\nSeed failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
