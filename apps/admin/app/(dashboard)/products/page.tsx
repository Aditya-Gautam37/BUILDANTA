"use client";

import { formatMoney } from "@buildanta/api/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  Alert,
  Button,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Spinner,
  StatusBadge,
  Table,
} from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

const STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
type Status = (typeof STATUSES)[number];

function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value);
}

export default function ProductsPage() {
  const router = useRouter();
  const params = useSearchParams();

  const page = Number(params.get("page") ?? 1) || 1;
  const statusParam = params.get("status") ?? "";
  const q = params.get("q") ?? "";
  const [search, setSearch] = useState(q);

  const products = trpc.admin.products.list.useQuery({
    page,
    limit: 25,
    sort: "updated",
    ...(q ? { q } : {}),
    ...(isStatus(statusParam) ? { status: statusParam } : {}),
  });

  function apply(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    router.push(`/products?${next.toString()}`);
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Editorial records. Price and SKU live on each product's variants."
        action={
          <LinkButton href="/products/new" variant="primary">
            New product
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form
          className="flex items-end gap-2"
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
              placeholder="Name, slug or SKU"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <div>
          <label htmlFor="status" className="block text-sm font-medium">
            Status
          </label>
          <Select
            id="status"
            value={statusParam}
            onChange={(event) =>
              apply({ status: event.target.value || undefined })
            }
          >
            <option value="">All statuses</option>
            {STATUSES.map((entry) => (
              <option key={entry} value={entry}>
                {entry.toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {products.error ? (
        <Alert tone="error">{errorMessage(products.error)}</Alert>
      ) : null}

      {products.isLoading ? <Spinner /> : null}

      {products.data && products.data.items.length === 0 ? (
        <EmptyState
          title="No products match"
          description={
            q || statusParam
              ? "Try clearing the search or status filter."
              : "Create your first product to get started."
          }
          action={
            <LinkButton href="/products/new" variant="primary">
              New product
            </LinkButton>
          }
        />
      ) : null}

      {products.data && products.data.items.length > 0 ? (
        <>
          <Table
            head={[
              "Product",
              "Category",
              "Brand",
              "From",
              "Variants",
              "Images",
              "Status",
            ]}
          >
            {products.data.items.map((product) => (
              <tr key={product.id}>
                <td className="px-4 py-2">
                  <Link
                    href={`/products/${product.id}`}
                    className="font-medium text-accent-700 hover:underline"
                  >
                    {product.name}
                  </Link>
                  <p className="text-xs text-ink-400">{product.slug}</p>
                </td>
                <td className="px-4 py-2 text-ink-600">
                  {product.category.name}
                </td>
                <td className="px-4 py-2 text-ink-600">
                  {product.brand?.name ?? "—"}
                </td>
                <td className="px-4 py-2">
                  {formatMoney(product.fromPrice, product.currency)}
                </td>
                <td className="px-4 py-2 text-ink-600">
                  {product.variantCount}
                </td>
                {/* Zero images is called out in red: it is the usual reason a draft
                    cannot be published. */}
                <td
                  className={`px-4 py-2 ${
                    product.imageCount === 0
                      ? "font-medium text-danger-600"
                      : "text-ink-600"
                  }`}
                >
                  {product.imageCount}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={product.status} />
                </td>
              </tr>
            ))}
          </Table>

          {products.data.pageCount > 1 ? (
            <div className="mt-4 flex items-center gap-2">
              <Button
                disabled={page <= 1}
                onClick={() => apply({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <span className="text-sm text-ink-600">
                Page {products.data.page} of {products.data.pageCount}
              </span>
              <Button
                disabled={page >= products.data.pageCount}
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
