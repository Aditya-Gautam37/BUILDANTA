"use client";

import Link from "next/link";

import {
  LinkButton,
  PageHeader,
  Spinner,
  StatusBadge,
  Table,
} from "@/components/ui";
import { trpc } from "@/lib/trpc";

export default function OverviewPage() {
  const quotes = trpc.admin.quotes.list.useQuery({
    page: 1,
    limit: 8,
    sort: "newest",
  });
  const products = trpc.admin.products.list.useQuery({
    page: 1,
    limit: 1,
    sort: "updated",
  });
  const drafts = trpc.admin.products.list.useQuery({
    status: "DRAFT",
    page: 1,
    limit: 1,
    sort: "updated",
  });

  const newQuotes = quotes.data?.statusCounts["NEW"] ?? 0;

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Release 1 covers the catalog and bulk quote requests. Stock, orders and payments are later releases."
        action={
          <LinkButton href="/products/new" variant="primary">
            New product
          </LinkButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="New quote requests"
          value={quotes.isLoading ? undefined : newQuotes}
          href="/quotes?status=NEW"
          highlight={newQuotes > 0}
        />
        <Stat
          label="Products"
          value={products.data?.total}
          href="/products"
        />
        <Stat
          label="Awaiting publish"
          value={drafts.data?.total}
          href="/products?status=DRAFT"
        />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Latest quote requests</h2>
          <Link
            href="/quotes"
            className="text-sm text-accent-700 hover:underline"
          >
            View all
          </Link>
        </div>

        {quotes.isLoading ? <Spinner /> : null}

        {quotes.data && quotes.data.items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 bg-white p-8 text-center text-sm text-ink-600">
            No quote requests yet. They arrive from the storefront’s quote form.
          </p>
        ) : null}

        {quotes.data && quotes.data.items.length > 0 ? (
          <Table head={["Reference", "Contact", "Project", "Items", "Status"]}>
            {quotes.data.items.map((quote) => (
              <tr key={quote.id}>
                <td className="px-4 py-2">
                  <Link
                    href={`/quotes/${quote.id}`}
                    className="font-medium text-accent-700 hover:underline"
                  >
                    {quote.reference}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  {quote.contactName}
                  <span className="block text-xs text-ink-600">
                    {quote.companyName ?? quote.contactEmail}
                  </span>
                </td>
                <td className="px-4 py-2 text-ink-600">
                  {quote.projectName ?? "—"}
                </td>
                <td className="px-4 py-2 text-ink-600">{quote.itemCount}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={quote.status} />
                </td>
              </tr>
            ))}
          </Table>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
  highlight = false,
}: {
  label: string;
  value: number | undefined;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border bg-white p-4 hover:border-accent-500 ${
        highlight ? "border-accent-500" : "border-ink-200"
      }`}
    >
      <p className="text-sm text-ink-600">{label}</p>
      {/* An em dash while loading rather than 0, which would read as real data. */}
      <p className="mt-1 text-2xl font-bold">{value ?? "—"}</p>
    </Link>
  );
}
