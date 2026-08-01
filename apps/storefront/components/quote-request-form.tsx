"use client";

import {
  formatMoney,
  formatQuantity,
  formatUnit,
  quoteRequestInput,
} from "@buildanta/api/client";
import { TRPCClientError } from "@trpc/client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { browserApi } from "@/lib/browser-api";
import { useQuoteBasket } from "@/lib/quote-basket";

interface ResolvedVariant {
  id: string;
  sku: string;
  name: string;
  price: string;
  currency: string;
  unit: string;
  product: {
    slug: string;
    name: string;
    imageUrl: string | null;
    imageAlt: string | null;
  };
}

type Status =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "submitted"; reference: string }
  | { kind: "failed"; message: string };

export function QuoteRequestForm() {
  const { lines, ready, setQuantity, remove, clear } = useQuoteBasket();

  const [variants, setVariants] = useState<ResolvedVariant[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "editing" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const variantIds = useMemo(
    () => lines.map((line) => line.variantId),
    [lines],
  );
  // A stable primitive the effect below can depend on directly. Depending on
  // `variantIds` itself would refetch on every render (a new array, even with
  // the same contents); depending on `variantIds.join(",")` inline is the same
  // value but recomputed every render, which is why the lint rule cannot verify
  // it's safe. Memoizing it here satisfies the rule and is the real fix, not a
  // suppression.
  const variantIdsKey = useMemo(() => variantIds.join(","), [variantIds]);

  /**
   * Names and prices are always resolved from the API, never read from
   * localStorage. That is what stops a hand-edited basket from displaying — or
   * submitting — a price that was never real.
   */
  useEffect(() => {
    if (!ready) return;
    if (variantIds.length === 0) {
      setVariants([]);
      return;
    }

    let cancelled = false;
    setLoadError(null);

    browserApi.catalog.products.variantsByIds
      .query({ ids: variantIds })
      .then((result) => {
        if (!cancelled) setVariants(result);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            "We could not load your saved items. Please reload the page.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
    // Keyed on the joined ids so adding and removing refetches, but retyping a
    // quantity does not. `variantIds` itself is deliberately not a dependency:
    // editing a quantity replaces `lines` with a new array (see setQuantity in
    // lib/quote-basket.tsx), which gives `variantIds` a new identity too even
    // though its contents are unchanged — depending on it directly would
    // refetch on every keystroke. The lint rule can't verify that
    // `variantIdsKey` is an equivalent, deliberately-stable proxy for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, variantIdsKey]);

  if (status.kind === "submitted") {
    return <SubmittedNotice reference={status.reference} />;
  }

  if (!ready || variants === null) {
    return <p className="text-concrete-600">Loading your request…</p>;
  }

  if (loadError) {
    return (
      <p role="alert" className="rounded-md bg-signal-50 p-4 text-signal-700">
        {loadError}
      </p>
    );
  }

  const resolved = new Map(variants.map((variant) => [variant.id, variant]));

  // A variant can be withdrawn between adding it and submitting. It is called out
  // rather than silently dropped, so the buyer knows what changed.
  const unavailable = lines.filter((line) => !resolved.has(line.variantId));
  const available = lines.filter((line) => resolved.has(line.variantId));

  if (lines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-concrete-200 bg-white p-10 text-center">
        <p className="text-lg font-semibold">Your quote request is empty</p>
        <p className="mt-1 text-sm text-concrete-600">
          Browse the catalog and use “Add to quote” on any product.
        </p>
        <Link
          href="/products"
          className="mt-4 inline-block rounded bg-signal-600 px-4 py-2 text-sm font-medium text-white hover:bg-signal-700"
        >
          Browse products
        </Link>
      </div>
    );
  }

  const indicativeTotal = available.reduce((sum, line) => {
    const variant = resolved.get(line.variantId)!;
    const quantity = Number(line.quantity);
    return sum + Number(variant.price) * (Number.isFinite(quantity) ? quantity : 0);
  }, 0);

  const currency = variants[0]?.currency ?? "INR";

  async function handleSubmit(formData: FormData): Promise<void> {
    setFieldErrors({});

    const payload = {
      contactName: String(formData.get("contactName") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
      contactPhone: emptyToNull(formData.get("contactPhone")),
      companyName: emptyToNull(formData.get("companyName")),
      projectName: emptyToNull(formData.get("projectName")),
      deliveryPincode: emptyToNull(formData.get("deliveryPincode")),
      message: emptyToNull(formData.get("message")),
      requiredBy: emptyToNull(formData.get("requiredBy")),
      items: available.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
        note: null,
      })),
    };

    // Validated client-side with the very same schema the server enforces, so
    // obvious mistakes are caught without a round trip and the rules cannot drift.
    const parsed = quoteRequestInput.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      setStatus({
        kind: "failed",
        message: "Please check the highlighted fields.",
      });
      return;
    }

    setStatus({ kind: "submitting" });

    try {
      const result = await browserApi.quotes.submit.mutate(parsed.data);
      clear();
      setStatus({ kind: "submitted", reference: result.reference });
    } catch (error) {
      setStatus({
        kind: "failed",
        message:
          error instanceof TRPCClientError
            ? error.message
            : "We could not submit your request. Please try again.",
      });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div>
        <h2 className="text-lg font-semibold">
          {available.length} product{available.length === 1 ? "" : "s"}
        </h2>

        {unavailable.length > 0 ? (
          <div
            role="alert"
            className="mt-3 rounded-md border border-signal-500 bg-signal-50 p-3 text-sm text-signal-700"
          >
            <p className="font-semibold">
              {unavailable.length} item
              {unavailable.length === 1 ? "" : "s"} no longer available
            </p>
            <p className="mt-1">
              They have been withdrawn from the catalog and will not be included.
            </p>
            <button
              type="button"
              onClick={() => {
                for (const line of unavailable) remove(line.variantId);
              }}
              className="mt-2 rounded border border-signal-600 px-2 py-1 text-xs font-medium hover:bg-signal-100"
            >
              Remove them
            </button>
          </div>
        ) : null}

        <ul className="mt-4 divide-y divide-concrete-200 rounded-lg border border-concrete-200 bg-white">
          {available.map((line) => {
            const variant = resolved.get(line.variantId)!;
            return (
              <li key={line.variantId} className="flex gap-4 p-4">
                <div className="relative size-20 shrink-0 overflow-hidden rounded bg-concrete-100">
                  {variant.product.imageUrl ? (
                    <Image
                      src={variant.product.imageUrl}
                      alt={variant.product.imageAlt ?? variant.product.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${variant.product.slug}?variant=${variant.sku}`}
                    className="font-semibold hover:text-signal-700"
                  >
                    {variant.product.name}
                  </Link>
                  <p className="text-sm text-concrete-600">
                    {variant.name} · {variant.sku}
                  </p>
                  <p className="mt-1 text-sm">
                    {formatMoney(variant.price, variant.currency)} per{" "}
                    {formatUnit(variant.unit, "long")}
                  </p>

                  <div className="mt-2 flex items-end gap-3">
                    <div>
                      <label
                        htmlFor={`qty-${line.variantId}`}
                        className="block text-xs font-medium text-concrete-600"
                      >
                        Quantity ({formatUnit(variant.unit, "short")})
                      </label>
                      <input
                        id={`qty-${line.variantId}`}
                        type="number"
                        min="0.001"
                        step="any"
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(event) =>
                          setQuantity(line.variantId, event.target.value)
                        }
                        className="mt-1 w-24 rounded border border-concrete-200 px-2 py-1 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(line.variantId)}
                      className="text-sm text-signal-700 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <p className="shrink-0 text-right font-semibold">
                  {formatMoney(
                    (
                      Number(variant.price) * (Number(line.quantity) || 0)
                    ).toFixed(2),
                    variant.currency,
                  )}
                  <span className="block text-xs font-normal text-concrete-600">
                    {formatQuantity(line.quantity)} ×{" "}
                    {formatUnit(variant.unit, "short")}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>

        <form
          className="mt-8 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit(new FormData(event.currentTarget));
          }}
        >
          <h2 className="text-lg font-semibold">Your details</h2>

          {status.kind === "failed" ? (
            <p
              role="alert"
              className="rounded-md border border-signal-500 bg-signal-50 p-3 text-sm font-medium text-signal-700"
            >
              {status.message}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Your name"
              name="contactName"
              required
              errors={fieldErrors["contactName"]}
            />
            <Field
              label="Email"
              name="contactEmail"
              type="email"
              required
              autoComplete="email"
              errors={fieldErrors["contactEmail"]}
            />
            <Field
              label="Phone"
              name="contactPhone"
              type="tel"
              autoComplete="tel"
              errors={fieldErrors["contactPhone"]}
            />
            <Field
              label="Company"
              name="companyName"
              errors={fieldErrors["companyName"]}
            />
            <Field
              label="Project name"
              name="projectName"
              errors={fieldErrors["projectName"]}
            />
            <Field
              label="Delivery pincode"
              name="deliveryPincode"
              inputMode="numeric"
              hint="Six digits"
              errors={fieldErrors["deliveryPincode"]}
            />
            <Field
              label="Needed by"
              name="requiredBy"
              type="date"
              errors={fieldErrors["requiredBy"]}
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium">
              Anything else we should know?
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              placeholder="Site access, delivery in lots, shade matching…"
              className="mt-1 w-full rounded-md border border-concrete-200 bg-white px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={status.kind === "submitting" || available.length === 0}
            aria-busy={status.kind === "submitting"}
            className="rounded-md bg-signal-600 px-6 py-3 font-semibold text-white hover:bg-signal-700 disabled:cursor-not-allowed disabled:bg-concrete-400"
          >
            {status.kind === "submitting" ? "Sending…" : "Send quote request"}
          </button>
        </form>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-lg border border-concrete-200 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-concrete-600">
            Summary
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-concrete-600">Products</dt>
              <dd>{available.length}</dd>
            </div>
            <div className="flex justify-between border-t border-concrete-200 pt-2">
              <dt className="font-medium">Indicative total</dt>
              <dd className="font-bold">
                {formatMoney(indicativeTotal.toFixed(2), currency)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-concrete-600">
            Based on listed prices. Excludes delivery and taxes, and is not a
            quotation — we will confirm pricing when we respond.
          </p>
        </div>
      </aside>
    </div>
  );
}

function SubmittedNotice({ reference }: { reference: string }) {
  return (
    <div className="rounded-lg border border-concrete-200 bg-white p-10 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-signal-700">
        Request received
      </p>
      <h2 className="mt-2 text-2xl font-bold">
        Your reference is {reference}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-concrete-600">
        Quote it when you call or email us. We will come back with pricing for
        your list.
      </p>
      <Link
        href="/products"
        className="mt-6 inline-block rounded-md bg-signal-600 px-5 py-2.5 font-medium text-white hover:bg-signal-700"
      >
        Continue browsing
      </Link>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  hint,
  errors,
  autoComplete,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  hint?: string;
  errors?: string[];
  autoComplete?: string;
  inputMode?: "numeric" | "decimal" | "tel" | "text";
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-signal-700">
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p className="text-xs text-concrete-600">{hint}</p>
      ) : null}
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={errors?.length ? true : undefined}
        className="mt-1 w-full rounded-md border border-concrete-200 bg-white px-3 py-2"
      />
      {errors?.length ? (
        <p className="mt-1 text-xs font-medium text-signal-700">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : null;
}
