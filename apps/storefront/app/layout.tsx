import type { Metadata } from "next";
import Link from "next/link";

import { QuoteBasketLink } from "@/components/quote-basket-link";
import { SiteSearch } from "@/components/site-search";
import { api } from "@/lib/api";
import { QuoteBasketProvider } from "@/lib/quote-basket";

import "./globals.css";

/**
 * Applies to every route under this layout.
 *
 * The whole storefront is database-driven, so prerendering it at build time would
 * make `next build` depend on a running API and a reachable Postgres. Rendering per
 * request keeps the build hermetic; see lib/api.ts for the ISR follow-up.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Buildanta — everything you need to finish your home",
    template: "%s · Buildanta",
  },
  description:
    "Construction materials by build stage, by room and by category. Cement by the bag, steel by the tonne, tile by the box.",
};

/**
 * Header and footer navigation come from one query.
 *
 * This is the fix for the live prototype's worst structural bug: its stage, room and
 * category menus were hardcoded in several places and drifted apart — ten stages on
 * the homepage but seven in the footer, and three different category lists. Here
 * both menus read the same rows, so they cannot disagree.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nav = await api.catalog.taxonomy.navigation.query();

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <QuoteBasketProvider>
          <header className="bg-concrete-900 text-concrete-50">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4">
              <Link href="/" className="text-2xl font-bold tracking-tight">
                Buildanta
              </Link>

              <div className="order-3 w-full md:order-2 md:w-auto md:flex-1 md:max-w-md">
                <SiteSearch />
              </div>

              <nav
                aria-label="Main"
                className="order-2 ml-auto flex items-center gap-5 text-sm font-medium md:order-3"
              >
                <Link href="/stages" className="hover:text-signal-500">
                  By stage
                </Link>
                <Link href="/rooms" className="hover:text-signal-500">
                  By room
                </Link>
                <Link href="/categories" className="hover:text-signal-500">
                  Categories
                </Link>
                <QuoteBasketLink />
              </nav>
            </div>

            <div className="border-t border-concrete-800">
              <nav
                aria-label="Build stages"
                className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 py-2 text-sm text-concrete-200"
              >
                {nav.stages.map((stage) => (
                  <Link
                    key={stage.id}
                    href={`/stages/${stage.slug}`}
                    className="whitespace-nowrap hover:text-signal-500"
                  >
                    {stage.name}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="mt-16 bg-concrete-900 text-concrete-200">
            <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="font-bold text-concrete-50">Buildanta</p>
                <p className="mt-2 text-sm text-concrete-400">
                  Your all-in-one source for every build detail. Prices are
                  indicative and exclude delivery and taxes.
                </p>
              </div>

              <FooterColumn
                title="By stage"
                links={nav.stages.map((stage) => ({
                  href: `/stages/${stage.slug}`,
                  label: stage.name,
                }))}
              />
              <FooterColumn
                title="By room"
                links={nav.rooms.map((room) => ({
                  href: `/rooms/${room.slug}`,
                  label: room.name,
                }))}
              />
              <FooterColumn
                title="Categories"
                links={nav.categories.map((category) => ({
                  href: `/categories/${category.slug}`,
                  label: category.name,
                }))}
              />
            </div>

            <div className="border-t border-concrete-800">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-concrete-400">
                <p>© {new Date().getFullYear()} Buildanta.</p>
                <Link href="/quote" className="hover:text-signal-500">
                  Request a bulk quote
                </Link>
              </div>
            </div>
          </footer>
        </QuoteBasketProvider>
      </body>
    </html>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-concrete-50">{title}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="hover:text-signal-500">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
