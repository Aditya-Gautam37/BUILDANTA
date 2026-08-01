import { z } from "zod";

/**
 * Environment is validated once, at import time, and the process refuses to start
 * if anything required is missing or too weak. A misconfigured secret should be a
 * startup crash, not a runtime hole discovered in production.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url(),

  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters."),
  SESSION_COOKIE_NAME: z.string().min(1).default("buildanta_admin_session"),

  // Product image storage — Supabase Storage. The service role key is
  // server-only: it bypasses every storage policy, which is exactly why uploads
  // go through this API and are never sent directly from a browser.
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required for image storage."),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("product-images"),

  DEFAULT_CURRENCY: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, "DEFAULT_CURRENCY must be an ISO 4217 code.")
    .default("INR"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill in the missing values.`,
    );
  }

  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return env().NODE_ENV === "production";
}
