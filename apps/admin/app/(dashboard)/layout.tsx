"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button, Spinner } from "@/components/ui";
import { trpc } from "@/lib/trpc";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/quotes", label: "Quote requests" },
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
  { href: "/brands", label: "Brands" },
  { href: "/rooms", label: "Rooms" },
  { href: "/stages", label: "Build stages" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/settings", label: "Settings" },
] as const;

/**
 * Authenticated shell for every admin screen.
 *
 * The gate here is a redirect for the *user's* benefit, not a security boundary.
 * Authorisation is enforced on the server by `adminProcedure`, so bypassing this
 * component gets you an empty page and a string of 401s, not data.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();

  const logout = trpc.auth.logout.useMutation({
    async onSuccess() {
      await utils.invalidate();
      router.replace("/login");
    },
  });

  const signedOut = me.isSuccess && me.data === null;

  useEffect(() => {
    if (!signedOut) return;
    // Carries the current location so the user lands back where they were.
    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [signedOut, pathname, router]);

  if (me.isLoading) return <Spinner label="Checking your session…" />;
  if (!me.data) return <Spinner label="Redirecting to sign in…" />;

  return (
    <div className="flex min-h-screen">
      <nav
        aria-label="Admin sections"
        className="w-56 shrink-0 border-r border-ink-200 bg-white"
      >
        <div className="px-4 py-5">
          <p className="font-bold">Buildanta</p>
          <p className="text-xs text-ink-600">Catalog admin</p>
        </div>

        <ul className="space-y-0.5 px-2 pb-4">
          {NAV.map((item) => {
            // Exact match for the overview, prefix match for sections, so a nested
            // route like /products/123 still highlights "Products".
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`block rounded-md px-3 py-2 text-sm ${
                    isActive
                      ? "bg-accent-50 font-semibold text-accent-700"
                      : "hover:bg-ink-100"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-ink-200 bg-white px-6 py-3">
          <p className="text-sm text-ink-600">
            Signed in as <span className="font-medium">{me.data.email}</span>
          </p>
          <Button onClick={() => logout.mutate()} disabled={logout.isPending}>
            {logout.isPending ? "Signing out…" : "Sign out"}
          </Button>
        </header>

        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
