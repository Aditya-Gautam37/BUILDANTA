/**
 * Server-side entry point. Imported by `apps/api` only.
 *
 * The web apps must import from `@buildanta/api/client` instead — that module is
 * types and helpers with no database or filesystem dependencies, so pulling it into
 * a browser bundle cannot drag Prisma or sharp along with it.
 */

export { appRouter } from "./root.js";
export type { AppRouter } from "./root.js";

export { createContext } from "./context.js";
export type {
  AuthenticatedAdmin,
  Context,
  CreateContextArgs,
  IncomingRequest,
  SessionCookieWriter,
} from "./context.js";

export { createCallerFactory } from "./trpc.js";

export { env, isProduction } from "./env.js";
export type { Env } from "./env.js";

export { attachProductImage, removeOrphanedFiles } from "./images.js";
export type { AttachImageArgs } from "./images.js";

export {
  MAX_UPLOAD_BYTES,
  UploadRejected,
  ensureBucketExists,
} from "./storage.js";

export { recomputeProductPricing } from "./pricing.js";
