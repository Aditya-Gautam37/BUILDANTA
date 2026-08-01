/**
 * Transport-level configuration, kept separate from the router's own environment
 * schema in `@buildanta/api`. Ports, CORS and proxy trust are properties of how the
 * API is *hosted*, not of what it does.
 */
export interface ServerEnv {
  port: number;
  host: string;
  corsOrigins: string[];
  trustProxy: boolean;
}

export function serverEnv(): ServerEnv {
  const port = Number(process.env["API_PORT"] ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`API_PORT must be a valid port number, got "${port}".`);
  }

  const corsOrigins = (process.env["CORS_ORIGINS"] ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.length === 0) {
    throw new Error(
      "CORS_ORIGINS is empty. List the storefront and admin origins, e.g. " +
        'CORS_ORIGINS="http://localhost:3000,http://localhost:3001".',
    );
  }

  return {
    port,
    // 127.0.0.1 by default: binding 0.0.0.0 exposes the dev API to the local
    // network, which should be an explicit choice.
    host: process.env["API_HOST"] ?? "127.0.0.1",
    corsOrigins,
    /**
     * Only enable behind a proxy that actually sets `x-forwarded-for`. With it on
     * and no such proxy, any client can spoof its own IP and defeat both the login
     * and quote-submission rate limiters.
     */
    trustProxy: process.env["TRUST_PROXY"] === "true",
  };
}
