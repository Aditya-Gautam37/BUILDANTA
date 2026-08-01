import { authRouter } from "./routers/auth.js";
import { productsRouter } from "./routers/products.js";
import { quotesRouter } from "./routers/quotes.js";
import { taxonomyRouter } from "./routers/taxonomy.js";
import { adminImagesRouter } from "./routers/admin/images.js";
import { adminProductsRouter } from "./routers/admin/products.js";
import { adminQuotesRouter } from "./routers/admin/quotes.js";
import { adminSuppliersRouter } from "./routers/admin/suppliers.js";
import {
  adminBrandsRouter,
  adminCategoriesRouter,
  adminRoomsRouter,
  adminStagesRouter,
} from "./routers/admin/taxonomy.js";
import { adminVariantsRouter } from "./routers/admin/variants.js";
import { router } from "./trpc.js";

/**
 * The single API contract for the whole system.
 *
 * One definition of every procedure and one set of input schemas; both web apps
 * consume this router's *type* rather than a hand-maintained client. Nothing here
 * is duplicated per app, and there is no generated client to fall out of date.
 *
 * The `admin.*` namespace is not merely a naming convention — every procedure under
 * it is built from `adminProcedure`, so authentication cannot be forgotten on a new
 * endpoint.
 */
export const appRouter = router({
  auth: authRouter,
  catalog: router({
    taxonomy: taxonomyRouter,
    products: productsRouter,
  }),
  quotes: quotesRouter,
  admin: router({
    categories: adminCategoriesRouter,
    brands: adminBrandsRouter,
    rooms: adminRoomsRouter,
    stages: adminStagesRouter,
    suppliers: adminSuppliersRouter,
    products: adminProductsRouter,
    variants: adminVariantsRouter,
    images: adminImagesRouter,
    quotes: adminQuotesRouter,
  }),
});

export type AppRouter = typeof appRouter;
