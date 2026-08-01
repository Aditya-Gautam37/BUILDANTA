"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Form and layout primitives.
 *
 * These exist so every admin screen has the same field spacing, the same error
 * placement and the same button hierarchy. Styling each form inline is how you end up
 * with no two forms behaving alike when validation fails.
 */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-ink-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex gap-2">{action}</div> : null}
    </div>
  );
}

export function Card({
  children,
  title,
  action,
  className = "",
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-ink-200 bg-white ${className}`}>
      {title ? (
        <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

const BUTTON_VARIANTS = {
  primary:
    "bg-accent-600 text-white hover:bg-accent-700 disabled:bg-accent-600/50",
  secondary:
    "border border-ink-200 bg-white text-ink-900 hover:bg-ink-100 disabled:opacity-50",
  danger:
    "border border-danger-500 bg-white text-danger-600 hover:bg-danger-50 disabled:opacity-50",
} as const;

export function Button({
  children,
  variant = "secondary",
  type = "button",
  className = "",
  ...rest
}: {
  children: ReactNode;
  variant?: keyof typeof BUTTON_VARIANTS;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      {...rest}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof BUTTON_VARIANTS;
}) {
  return (
    <Link
      href={href}
      className={`inline-block rounded-md px-3 py-1.5 text-sm font-medium transition ${BUTTON_VARIANTS[variant]}`}
    >
      {children}
    </Link>
  );
}

/**
 * Wraps one input with its label, hint and error.
 *
 * `errors` takes the array the API returns for that field, so a server-side
 * validation failure lands next to the input that caused it.
 */
export function Field({
  label,
  htmlFor,
  hint,
  errors,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  errors?: string[];
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-danger-500">
            *
          </span>
        ) : null}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-ink-600">{hint}</p> : null}
      <div className="mt-1">{children}</div>
      {errors?.length ? (
        <p className="mt-1 text-xs font-medium text-danger-600">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-md border border-ink-200 bg-white px-3 py-1.5 text-sm focus:border-accent-500";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={INPUT_CLASS} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return <textarea {...props} className={`${INPUT_CLASS} min-h-24`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={INPUT_CLASS} />;
}

export function Checkbox({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" {...rest} className="size-4 rounded" />
      {label}
    </label>
  );
}

/** Multi-select rendered as checkboxes, for rooms and build stages. */
export function CheckboxGroup({
  legend,
  options,
  selected,
  onChange,
}: {
  legend: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        {options.map((option) => (
          <Checkbox
            key={option.id}
            label={option.name}
            checked={selected.includes(option.id)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, option.id]
                  : selected.filter((id) => id !== option.id),
              )
            }
          />
        ))}
      </div>
    </fieldset>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info" | "warn";
  children: ReactNode;
}) {
  const styles = {
    error: "border-danger-500 bg-danger-50 text-danger-600",
    success: "border-success-600 bg-success-50 text-success-600",
    warn: "border-warn-600 bg-warn-50 text-warn-600",
    info: "border-ink-200 bg-ink-100 text-ink-800",
  } as const;

  return (
    <div
      // Assertive for errors, so a screen reader announces a failed save immediately
      // rather than after the current utterance finishes.
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${styles[tone]}`}
    >
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-success-50 text-success-600 border-success-600",
    DRAFT: "bg-ink-100 text-ink-600 border-ink-400",
    ARCHIVED: "bg-danger-50 text-danger-600 border-danger-500",
    NEW: "bg-accent-50 text-accent-700 border-accent-500",
    IN_REVIEW: "bg-warn-50 text-warn-600 border-warn-600",
    QUOTED: "bg-success-50 text-success-600 border-success-600",
    WON: "bg-success-50 text-success-600 border-success-600",
    LOST: "bg-danger-50 text-danger-600 border-danger-500",
    CLOSED: "bg-ink-100 text-ink-600 border-ink-400",
  };

  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? styles["DRAFT"]
      }`}
    >
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <p role="status" className="py-8 text-center text-sm text-ink-600">
      {label}
    </p>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-ink-200 bg-white p-10 text-center">
      <p className="font-semibold">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-ink-600">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Table({
  head,
  children,
}: {
  head: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-ink-100 text-left">
          <tr>
            {head.map((label) => (
              <th key={label} scope="col" className="px-4 py-2 font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-200">{children}</tbody>
      </table>
    </div>
  );
}

/** Confirms a destructive action before running it. */
export function ConfirmButton({
  onConfirm,
  message,
  children,
  disabled,
}: {
  onConfirm: () => void;
  message: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="danger"
      disabled={disabled}
      onClick={() => {
        // A native confirm is deliberate: it cannot be missed, cannot be
        // mis-styled, and this is a small internal tool where a bespoke modal would
        // be more code than the action it guards.
        if (window.confirm(message)) onConfirm();
      }}
    >
      {children}
    </Button>
  );
}
