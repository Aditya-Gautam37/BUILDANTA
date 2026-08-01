"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  Alert,
  Button,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
  StatusBadge,
  Table,
} from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

const STATUSES = [
  "NEW",
  "IN_REVIEW",
  "QUOTED",
  "WON",
  "LOST",
  "CLOSED",
] as const;

type Status = (typeof STATUSES)[number];

function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value);
}

export default function QuotesPage() {
  const router = useRouter();
  const params = useSearchParams();

  // Filters live in the URL, so "all new requests" is a bookmarkable link and the
  // back button behaves.
  const page = Number(params.get("page") ?? 1) || 1;
  const statusParam = params.get("status") ?? "";
  const q = params.get("q") ?? "";
  const [search, setSearch] = useState(q);

  const quotes = trpc.admin.quotes.list.useQuery({
    page,
    limit: 25,
    sort: "newest",
    ...(q ? { q } : {}),
    ...(isStatus(statusParam) ? { status: statusParam } : {}),
  });

  function apply(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any filter change resets pagination; page 3 of the old filter is usually empty
    // under the new one.
    if (!("page" in changes)) next.delete("page");
    router.push(`/quotes?${next.toString()}`);
  }

  const counts = quotes.data?.statusCounts ?? {};

  return (
    <div>
      <PageHeader
        title="Quote requests"
        description="Bulk quote requests submitted from the storefront. Requests are never deleted — close them instead."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusTab
          label="All"
          active={statusParam === ""}
          onClick={() => apply({ status: undefined })}
        />
        {STATUSES.map((status) => (
          <StatusTab
            key={status}
            label={`${status.toLowerCase().replace(/_/g, " ")} (${counts[status] ?? 0})`}
            active={statusParam === status}
            onClick={() => apply({ status })}
          />
        ))}
      </div>

      <form
        className="mb-4 flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q: search.trim() || undefined });
        }}
      >
        <div>
          <label htmlFor="q" className="block text-sm font-medium">
            Search
          </label>
          <Input
            id="q"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Reference, name, email, company or SKU"
          />
        </div>
        <Button type="submit">Search</Button>
        {q ? (
          <Button
            onClick={() => {
              setSearch("");
              apply({ q: undefined });
            }}
          >
            Clear
          </Button>
        ) : null}
      </form>

      {quotes.error ? (
        <Alert tone="error">{errorMessage(quotes.error)}</Alert>
      ) : null}

      {quotes.isLoading ? <Spinner /> : null}

      {quotes.data && quotes.data.items.length === 0 ? (
        <EmptyState
          title="No quote requests match"
          description={
            q || statusParam
              ? "Try clearing the search or status filter."
              : "Requests arrive here when someone submits the storefront quote form."
          }
        />
      ) : null}

      {quotes.data && quotes.data.items.length > 0 ? (
        <>
          <Table
            head={[
              "Reference",
              "Contact",
              "Project",
              "Pincode",
              "Needed by",
              "Items",
              "Received",
              "Owner",
              "Status",
            ]}
          >
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
                    {quote.contactEmail}
                  </span>
                </td>
                <td className="px-4 py-2 text-ink-600">
                  {quote.projectName ?? quote.companyName ?? "—"}
                </td>
                <td className="px-4 py-2 text-ink-600">
                  {quote.deliveryPincode ?? "—"}
                </td>
                <td className="px-4 py-2 text-ink-600">
                  {formatDate(quote.requiredBy)}
                </td>
                <td className="px-4 py-2 text-ink-600">{quote.itemCount}</td>
                <td className="px-4 py-2 text-ink-600">
                  {formatDate(quote.createdAt)}
                </td>
                <td className="px-4 py-2 text-ink-600">
                  {quote.assignedTo?.name ?? "Unassigned"}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={quote.status} />
                </td>
              </tr>
            ))}
          </Table>

          {quotes.data.pageCount > 1 ? (
            <div className="mt-4 flex items-center gap-2">
              <Button
                disabled={page <= 1}
                onClick={() => apply({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <span className="text-sm text-ink-600">
                Page {quotes.data.page} of {quotes.data.pageCount}
              </span>
              <Button
                disabled={page >= quotes.data.pageCount}
                onClick={() => apply({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function StatusTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
        active
          ? "border-accent-600 bg-accent-50 text-accent-700"
          : "border-ink-200 bg-white hover:bg-ink-100"
      }`}
    >
      {label}
    </button>
  );
}

/** Dates render in en-IN, matching the market this catalog serves. */
function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}
