import {
  SESSION_RENEW_THRESHOLD_MS,
  hashSessionToken,
  sessionExpiry,
} from "@buildanta/auth";
import { prisma } from "@buildanta/db";
import type { AdminRole } from "@buildanta/db";

/**
 * What the router needs to know about the incoming request. Deliberately not a
 * Fastify or Next type: this package must not know which server is hosting it, so
 * a second transport can be added without touching any procedure.
 */
export interface IncomingRequest {
  sessionToken: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

/** How the host sets or clears the session cookie. */
export interface SessionCookieWriter {
  set(token: string, expiresAt: Date): void;
  clear(): void;
}

export interface AuthenticatedAdmin {
  sessionId: string;
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

export interface Context {
  prisma: typeof prisma;
  request: IncomingRequest;
  cookies: SessionCookieWriter;
  /** Null when there is no cookie, or it is unknown, expired, or deactivated. */
  admin: AuthenticatedAdmin | null;
}

export interface CreateContextArgs {
  request: IncomingRequest;
  cookies: SessionCookieWriter;
}

/**
 * Resolves the session on every request. An expired row is deleted rather than
 * merely ignored, and a session belonging to a deactivated account is revoked on
 * the spot — disabling an admin must take effect immediately, not at expiry.
 */
export async function createContext({
  request,
  cookies,
}: CreateContextArgs): Promise<Context> {
  const admin = await resolveAdmin(request, cookies);
  return { prisma, request, cookies, admin };
}

async function resolveAdmin(
  request: IncomingRequest,
  cookies: SessionCookieWriter,
): Promise<AuthenticatedAdmin | null> {
  if (!request.sessionToken) return null;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(request.sessionToken) },
    include: { adminUser: true },
  });

  if (!session) {
    cookies.clear();
    return null;
  }

  const now = new Date();

  if (session.expiresAt <= now || !session.adminUser.isActive) {
    await prisma.adminSession.delete({ where: { id: session.id } });
    cookies.clear();
    return null;
  }

  // Sliding expiry: extend a session close to lapsing so daily use never
  // interrupts an edit, while an abandoned one still dies on schedule.
  if (session.expiresAt.getTime() - now.getTime() < SESSION_RENEW_THRESHOLD_MS) {
    const expiresAt = sessionExpiry(now);
    await prisma.adminSession.update({
      where: { id: session.id },
      data: { expiresAt },
    });
    cookies.set(request.sessionToken, expiresAt);
  }

  return {
    sessionId: session.id,
    id: session.adminUser.id,
    email: session.adminUser.email,
    name: session.adminUser.name,
    role: session.adminUser.role,
  };
}
