"use client";

import { useState } from "react";

import {
  Alert,
  Button,
  Card,
  Checkbox,
  ConfirmButton,
  Field,
  Input,
  Table,
  Textarea,
} from "@/components/ui";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { slugify } from "@/lib/slug";

/**
 * List-and-form manager for a flat, sorted taxonomy: rooms and build stages.
 *
 * Purely presentational — the page owns the tRPC hooks and passes typed callbacks in.
 * A single factory over both Prisma delegates was tried in the API layer and forced
 * unsafe casts; doing the sharing here, at the dumb-component level, gets the reuse
 * without any of that.
 */

export interface LabelRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export interface LabelValues {
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface Draft {
  id: string | null;
  slug: string;
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
}

function emptyDraft(nextSortOrder: number): Draft {
  return {
    id: null,
    slug: "",
    name: "",
    description: "",
    sortOrder: String(nextSortOrder),
    isActive: true,
  };
}

export function LabelManager({
  entityLabel,
  sortOrderHint,
  items,
  isLoading,
  error,
  onCreate,
  onUpdate,
  onSetActive,
  onDelete,
  pending,
}: {
  entityLabel: string;
  /** Explains what sortOrder means for this entity — it differs by entity. */
  sortOrderHint: string;
  items: LabelRecord[] | undefined;
  isLoading: boolean;
  error: unknown;
  onCreate: (values: LabelValues) => void;
  onUpdate: (id: string, values: LabelValues) => void;
  onSetActive: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  const nextSortOrder =
    items && items.length > 0
      ? Math.max(...items.map((item) => item.sortOrder)) + 10
      : 0;

  const [draft, setDraft] = useState<Draft | null>(null);
  const errors = fieldErrors(error);

  function submit(): void {
    if (!draft) return;
    const values: LabelValues = {
      slug: draft.slug,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      sortOrder: Number(draft.sortOrder) || 0,
      isActive: draft.isActive,
    };
    if (draft.id) onUpdate(draft.id, values);
    else onCreate(values);
  }

  return (
    <div className="space-y-6">
      {error ? <Alert tone="error">{errorMessage(error)}</Alert> : null}

      <Card
        title={draft?.id ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
        action={
          <Button onClick={() => setDraft(draft ? null : emptyDraft(nextSortOrder))}>
            {draft ? "Cancel" : `Add ${entityLabel}`}
          </Button>
        }
      >
        {draft ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="name" required errors={errors["name"]}>
                <Input
                  id="name"
                  required
                  value={draft.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            name,
                            // Only auto-derived while creating: changing an existing
                            // slug changes a live public URL.
                            slug: current.id ? current.slug : slugify(name),
                          }
                        : current,
                    );
                  }}
                />
              </Field>

              <Field
                label="URL slug"
                htmlFor="slug"
                required
                hint="Lowercase, single hyphens. Appears in the public URL."
                errors={errors["slug"]}
              >
                <Input
                  id="slug"
                  required
                  value={draft.slug}
                  onChange={(event) =>
                    setDraft({ ...draft, slug: event.target.value })
                  }
                />
              </Field>

              <Field
                label="Sort order"
                htmlFor="sortOrder"
                hint={sortOrderHint}
                errors={errors["sortOrder"]}
              >
                <Input
                  id="sortOrder"
                  type="number"
                  min="0"
                  value={draft.sortOrder}
                  onChange={(event) =>
                    setDraft({ ...draft, sortOrder: event.target.value })
                  }
                />
              </Field>

              <div className="flex items-end">
                <Checkbox
                  label="Active (visible on the storefront)"
                  checked={draft.isActive}
                  onChange={(event) =>
                    setDraft({ ...draft, isActive: event.target.checked })
                  }
                />
              </div>
            </div>

            <Field
              label="Description"
              htmlFor="description"
              errors={errors["description"]}
            >
              <Textarea
                id="description"
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
              />
            </Field>

            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : draft.id ? "Save changes" : `Add ${entityLabel}`}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-ink-600">
            {items?.length ?? 0} {entityLabel}
            {items?.length === 1 ? "" : "s"}. Order is controlled by sort order.
          </p>
        )}
      </Card>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-ink-600">Loading…</p>
      ) : null}

      {items && items.length > 0 ? (
        <Table head={["Order", "Name", "Slug", "Products", "State", ""]}>
          {items.map((item) => (
            <tr key={item.id} className={item.isActive ? "" : "opacity-60"}>
              <td className="px-4 py-2 text-ink-600">{item.sortOrder}</td>
              <td className="px-4 py-2 font-medium">{item.name}</td>
              <td className="px-4 py-2 text-ink-600">{item.slug}</td>
              <td className="px-4 py-2 text-ink-600">{item.productCount}</td>
              <td className="px-4 py-2">
                {item.isActive ? "Active" : "Inactive"}
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap justify-end gap-1">
                  <Button
                    onClick={() =>
                      setDraft({
                        id: item.id,
                        slug: item.slug,
                        name: item.name,
                        description: item.description ?? "",
                        sortOrder: String(item.sortOrder),
                        isActive: item.isActive,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => onSetActive(item.id, !item.isActive)}
                    disabled={pending}
                  >
                    {item.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <ConfirmButton
                    message={
                      item.productCount > 0
                        ? `${item.productCount} product(s) use this ${entityLabel}. Deleting removes those links. Continue?`
                        : `Delete this ${entityLabel}?`
                    }
                    onConfirm={() => onDelete(item.id)}
                    disabled={pending}
                  >
                    Delete
                  </ConfirmButton>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      ) : null}
    </div>
  );
}
