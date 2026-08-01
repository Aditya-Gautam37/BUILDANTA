# Authentication

## Why not Supabase

Both planning documents assume Supabase Auth (`PROJECT_CONTEXT.md` §4, §11,
§23.5–23.7; `BUILD_FROM_SCRATCH.md` §6, §9). Release 1 uses neither — plain
email/password against the local database, with server-side sessions. This was
an explicit choice made when scoping this rebuild (a single `ADMIN` role, no
customer accounts yet, no third-party identity provider to configure for a
prototype), not an oversight. It is recorded here because it's a real deviation
from what both documents specify, and because whoever adds customer accounts in
Release 2 needs to know it's an open question whether that's when Supabase (or
another provider) gets introduced, or whether the local-session pattern below
just gets reused for customers too.

## How it works

```text
Admin submits email + password
  → auth.login (packages/api/src/routers/auth.ts)
  → rate limit check: 5 attempts / 15 min, keyed on IP AND on email
  → Prisma lookup by email
  → Argon2id verify (packages/auth/src/password.ts)
  → session token created: 32 random bytes, base64url
  → only the SHA-256 of the token is stored (AdminSession.tokenHash)
  → signed, httpOnly, sameSite=lax cookie set with the raw token
```

**Every request** re-resolves the session (`createContext` in
`packages/api/src/context.ts`):

- No cookie, or a cookie whose HMAC signature doesn't verify → treated as
  signed out. Fastify's signed-cookie support (`@fastify/cookie`) is what makes
  a tampered cookie value fail before it ever reaches the token lookup.
- A cookie whose token doesn't match any session, or whose session has expired,
  or whose owning account has been deactivated → the session row is deleted (if
  it existed) and the cookie is cleared. **A deactivated account's existing
  sessions stop working on the very next request** — there's no window where a
  disabled admin can keep working until their session naturally expires.
- A session inside 24 hours of its 7-day expiry is silently extended
  (`SESSION_RENEW_THRESHOLD_MS`) — daily use never logs someone out mid-edit,
  but an abandoned session still dies on schedule.

## Timing-safe login

`packages/auth/src/password.ts` exports `fakeVerifyPassword`, called when the
looked-up email doesn't exist (or the account is inactive). It runs a real
Argon2id verification against a random value generated once at process start,
so a nonexistent-account response takes the same ~50ms as a real one. Without
this, response latency alone would let an attacker enumerate valid staff email
addresses. The dummy hash is generated at runtime (`getDummyHash()`), never
hardcoded — a hand-written fake Argon2 string would fail to parse and return in
under a millisecond, which is exactly the leak this exists to close.

## CSRF

There is no CSRF token. Two independent checks stand in for one
(`apps/api/src/server.ts`):

1. **Origin allowlist.** Every non-GET request's `Origin` header, if present,
   must be in `CORS_ORIGINS`.
2. **Required custom header.** Every non-GET request must carry
   `x-buildanta-client`. A classic cross-site `<form>` POST — the attack this
   guards against — cannot set a custom header without a preflight, and the
   preflight would fail the CORS check anyway. This is the second, independent
   line: even a request that somehow passed the origin check (e.g. from a tool
   that doesn't send `Origin`) still needs to know to send this header.

## Password storage

Argon2id, memory cost 19 MiB, 2 iterations, parallelism 1 — the OWASP Password
Storage Cheat Sheet baseline. Parameters are pinned as a literal in
`packages/auth/src/password.ts`, not left to the library default, so a
dependency upgrade cannot silently change them.

## What Release 2 will need to decide

- Whether customer accounts reuse this session pattern or introduce a real
  identity provider (both planning documents assume Supabase; that decision was
  deferred, not made, for Release 1's single-role admin case).
- Password reset (not built — there's one seeded admin account and no email
  sending yet).
- Multiple roles (`PROJECT_CONTEXT.md` §23.5 names five; Release 1 has one).
