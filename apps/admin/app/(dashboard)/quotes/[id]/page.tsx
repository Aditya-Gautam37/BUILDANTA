"use client";

import { formatMoney, formatQuantity, formatUnit } from "@buildanta/api/client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Alert,
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  Spinner,
  StatusBadge,
  Table,
  Textarea,
} from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

const STATUSES = [
  { value: "NEW", label: "New" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "QUOTED", label: "Quoted" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "CLOSED", label: "Closed (spam or duplicate)" },
] as const;

type Status = (typeof STATUSES)[number]["value"];

export default function QuoteDetailPage() {
  const routeParams = useParams<{ id: string }>();
  const id = routeParams.id;

  const utils = trpc.useUtils();
  const quote = trpc.admin.quotes.byId.useQuery({ id });
  const assignees = trpc.admin.quotes.assignees.useQuery();

  const [status, setStatus] = useState<Status>("NEW");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  // Seeded from the server data once it arrives. Keyed on the loaded record's
  // identity (id + updatedAt) rather than on `quote.data` itself: a background
  // refetch returns a new object with equal content, and including the object
  // would reset the status dropdown and notes textarea out from under whoever
  // is mid-edit every time React Query polls. Deliberately narrower than the
  // exhaustive-deps rule wants — including `quote.data` is the bug, not the fix.
  useEffect(() => {
    if (!quote.data) return;
    setStatus(quote.data.status as Status);
    setNotes(quote.data.internalNotes ?? "");
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.data?.id, quote.data?.updatedAt]);

  const setStatusMutation = trpc.admin.quotes.setStatus.useMutation({
    async onSuccess() {
      await utils.admin.quotes.invalidate();
      setSaved(true);
    },
  });

  const assign = trpc.admin.quotes.assign.useMutation({
    onSuccess: () => utils.admin.quotes.invalidate(),
  });

  if (quote.isLoading) return <Spinner />;
  if (quote.error) return <Alert tone="error">{errorMessage(quote.error)}</Alert>;
  if (!quote.data) return null;

  const request = quote.data;

  return (
    <div>
      <PageHeader
        title={request.reference}
        description={`Received ${formatDateTime(request.createdAt)}`}
        action={
          <Link
            href="/quotes"
            className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-ink-100"
          >
            Back to inbox
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card title="Requested items">
            <Table
              head={["Product", "SKU", "Unit price", "Quantity", "Line total"]}
            >
              {request.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2">
                    <span className="font-medium">{item.productName}</span>
                    <span className="block text-xs text-ink-600">
                      {item.variantName}
                    </span>
                    {item.note ? (
                      <span className="mt-1 block text-xs italic text-ink-600">
                        “{item.note}”
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-ink-600">{item.sku}</td>
                  <td className="px-4 py-2">
                    {formatMoney(item.unitPrice, item.currency)}
                    <span className="block text-xs text-ink-600">
                      per {formatUnit(item.unit, "long")}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {formatQuantity(item.quantity)}{" "}
                    <span className="text-xs text-ink-600">
                      {formatUnit(item.unit, "short")}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-semibold">
                    {formatMoney(item.lineTotal, item.currency)}
                  </td>
                </tr>
              ))}
              <tr className="bg-ink-50">
                <td colSpan={4} className="px-4 py-2 text-right font-semibold">
                  Indicative total
                </td>
                <td className="px-4 py-2 font-bold">
                  {formatMoney(request.indicativeTotal, request.currency)}
                </td>
              </tr>
            </Table>

            <p className="mt-3 text-xs text-ink-600">
              Prices are those shown to the buyer when they submitted, copied onto
              the request. Current catalog prices may differ.
            </p>
          </Card>

          {request.message ? (
            <Card title="Buyer’s message">
              <p className="whitespace-pre-line text-sm">{request.message}</p>
            </Card>
          ) : null}

          <Card title="Work this request">
            {setStatusMutation.error ? (
              <Alert tone="error">{errorMessage(setStatusMutation.error)}</Alert>
            ) : null}
            {saved ? <Alert tone="success">Saved.</Alert> : null}

            <form
              className="mt-3 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setStatusMutation.mutate({
                  id: request.id,
                  status,
                  internalNotes: notes.trim() ? notes : null,
                });
              }}
            >
              <Field
                label="Status"
                htmlFor="status"
                hint="Setting this to Quoted stamps the response time, once."
              >
                <Select
                  id="status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as Status);
                    setSaved(false);
                  }}
                >
                  {STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Internal notes"
                htmlFor="notes"
                hint="Never shown to the buyer."
              >
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setSaved(false);
                  }}
                  placeholder="Called back, waiting on supplier pricing…"
                />
              </Field>

              <Button
                type="submit"
                variant="primary"
                disabled={setStatusMutation.isPending}
              >
                {setStatusMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </form>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Status">
            <div className="space-y-3 text-sm">
              <StatusBadge status={request.status} />
              <Detail
                label="Responded"
                value={
                  request.respondedAt
                    ? formatDateTime(request.respondedAt)
                    : "Not yet"
                }
              />
              <Detail
                label="Last updated"
                value={formatDateTime(request.updatedAt)}
              />
            </div>
          </Card>

          <Card title="Owner">
            <Select
              aria-label="Assign to"
              value={request.assignedTo?.id ?? ""}
              disabled={assign.isPending}
              onChange={(event) =>
                assign.mutate({
                  id: request.id,
                  assignedToId: event.target.value || null,
                })
              }
            >
              <option value="">Unassigned</option>
              {assignees.data?.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
            {assign.error ? (
              <div className="mt-2">
                <Alert tone="error">{errorMessage(assign.error)}</Alert>
              </div>
            ) : null}
          </Card>

          <Card title="Contact">
            <div className="space-y-3 text-sm">
              <Detail label="Name" value={request.contactName} />
              <Detail
                label="Email"
                value={
                  <a
                    href={`mailto:${request.contactEmail}?subject=${encodeURIComponent(
                      `Buildanta quote ${request.reference}`,
                    )}`}
                    className="text-accent-700 hover:underline"
                  >
                    {request.contactEmail}
                  </a>
                }
              />
              {request.contactPhone ? (
                <Detail
                  label="Phone"
                  value={
                    <a
                      href={`tel:${request.contactPhone.replace(/\s/g, "")}`}
                      className="text-accent-700 hover:underline"
                    >
                      {request.contactPhone}
                    </a>
                  }
                />
              ) : null}
              {request.companyName ? (
                <Detail label="Company" value={request.companyName} />
              ) : null}
            </div>
          </Card>

          <Card title="Project">
            <div className="space-y-3 text-sm">
              <Detail label="Name" value={request.projectName ?? "—"} />
              <Detail
                label="Delivery pincode"
                value={request.deliveryPincode ?? "—"}
              />
              <Detail
                label="Needed by"
                value={
                  request.requiredBy ? formatDate(request.requiredBy) : "Not given"
                }
              />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-600">
        {label}
      </p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}
