import { NextResponse } from "next/server";

/**
 * Thin proxy from the storefront's own origin to the Buildanta API.
 *
 * The basket runs in the browser and needs to reach the API. Rather than publish
 * the API origin to the page and widen its CORS allowlist, requests go through here
 * — the browser only ever talks to the storefront's own origin, so there is no
 * cross-origin request and no preflight.
 *
 * Deliberately does not forward cookies. Every procedure the basket calls is public;
 * forwarding credentials would turn this into a confused deputy that could reach
 * admin procedures on behalf of whoever holds a session.
 */
const apiUrl = process.env.API_URL ?? "http://localhost:4000";

/** Procedures the basket is allowed to reach through this proxy. */
const ALLOWED_PATHS = new Set([
  "catalog.products.variantsByIds",
  "quotes.submit",
]);

async function proxy(request: Request, trpcPath: string): Promise<Response> {
  // tRPC batches calls as a comma-separated path. Every segment must be allowed,
  // or the proxy becomes a general-purpose tunnel to the whole router.
  const procedures = trpcPath.split(",");
  if (procedures.some((procedure) => !ALLOWED_PATHS.has(procedure))) {
    return NextResponse.json(
      { error: "Not available through this endpoint." },
      { status: 403 },
    );
  }

  const incoming = new URL(request.url);
  const target = `${apiUrl}/trpc/${trpcPath}${incoming.search}`;

  const response = await fetch(target, {
    method: request.method,
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
      "x-buildanta-client": "storefront",
      // Preserved so the API's rate limiter sees the visitor rather than this
      // server. It is only trusted when the API runs behind a proxy that sets it
      // (TRUST_PROXY), which is the same condition under which this app is proxied.
      ...(request.headers.get("x-forwarded-for")
        ? { "x-forwarded-for": request.headers.get("x-forwarded-for")! }
        : {}),
    },
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.text(),
    cache: "no-store",
  });

  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ trpc: string }> },
): Promise<Response> {
  const { trpc } = await params;
  return proxy(request, trpc);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ trpc: string }> },
): Promise<Response> {
  const { trpc } = await params;
  return proxy(request, trpc);
}
