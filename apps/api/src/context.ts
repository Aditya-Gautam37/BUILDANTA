import { createContext, env, isProduction } from "@buildanta/api";
import type { Context } from "@buildanta/api";
import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Adapts a Fastify request/reply pair to the transport-agnostic context that
 * `@buildanta/api` expects. This file is the only place in the system that knows
 * both Fastify and the router, which is what keeps the router portable.
 */

/** Exported so its shape (flags, not just behaviour) can be unit tested directly
 *  — see context.test.ts — without needing a full request/response round trip. */
export function cookieOptions(expires?: Date) {
  return {
    path: "/",
    // No JavaScript ever needs to read this cookie, and making it unreadable is
    // what stops an XSS anywhere in the admin app from stealing a session.
    httpOnly: true,
    // Over plain HTTP in development the cookie would simply never be stored.
    secure: isProduction(),
    /**
     * "lax" rather than "strict": the admin app and the API are separate origins on
     * the same site, and "strict" would drop the cookie on a top-level navigation
     * back into the admin from an external link. "none" is not used because it
     * would permit genuine cross-site requests.
     */
    sameSite: "lax" as const,
    signed: true,
    ...(expires ? { expires } : {}),
  };
}

export async function createFastifyContext({
  req,
  res,
}: {
  req: FastifyRequest;
  res: FastifyReply;
}): Promise<Context> {
  const cookieName = env().SESSION_COOKIE_NAME;
  const raw = req.cookies[cookieName];

  // An unsigned or tampered cookie is treated as absent rather than trusted.
  let sessionToken: string | null = null;
  if (raw) {
    const unsigned = req.unsignCookie(raw);
    sessionToken = unsigned.valid ? unsigned.value : null;
  }

  return createContext({
    request: {
      sessionToken,
      // `req.ip` honours x-forwarded-for only when Fastify is configured with
      // trustProxy; see apps/api/src/env.ts for why that is opt-in.
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    },
    cookies: {
      set(token, expiresAt) {
        res.setCookie(cookieName, token, cookieOptions(expiresAt));
      },
      clear() {
        res.clearCookie(cookieName, cookieOptions());
      },
    },
  });
}
