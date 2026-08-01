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
  PageHeader,
  Select,
  Spinner,
  Table,
  Textarea,
} from "@/components/ui";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import { trpc } from "@/lib/trpc";

interface Draft {
  id: string | null;
  slug: string;
  name: string;
  description: string;
  parentId: string;
  sortOrder: string;
  isActive: boolean;
}

function emptyDraft(): Draft {
  return {
    id: null,
    slug: "",
    name: "",
    description: "",
    parentId: "",
    sortOrder: "0",
    isActive: true,
  };
}

export default function CategoriesPage() {
  const utils = trpc.useUtils();
  const categories = trpc.admin.categories.list.useQuery();

  const invalidate = async () => {
    await utils.admin.categories.invalidate();
    // The product form's category dropdown is built from a different query.
    await utils.admin.products.formOptions.invalidate();
  };

  const create = trpc.admin.categories.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });
  const update = trpc.admin.categories.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });
  const setActive = trpc.admin.categories.setActive.useMutation({
    onSuccess: invalidate,
  });
  const remove = trpc.admin.categories.delete.useMutation({
    onSuccess: invalidate,
  });

  const [draft, setDraft] = useState<Draft | null>(null);

  const error =
    categories.error ??
    create.error ??
    update.error ??
    setActive.error ??
    remove.error;
  const errors = fieldErrors(create.error ?? update.error);
  const pending =
    create.isPending ||
    update.isPending ||
    setActive.isPending ||
    remove.isPending;

  // Only top-level categories are offered as parents. Release 1's storefront renders
  // two levels, so allowing a third would produce pages the UI cannot show properly.
  const parentOptions = (categories.data ?? []).filter(
    (category) => category.parentId === null,
  );

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Two levels: a top-level category and its subcategories. Browsing a parent includes everything filed beneath it."
      />

      {error ? (
        <div className="mb-4">
          <Alert tone="error">{errorMessage(error)}</Alert>
        </div>
      ) : null}

      <div className="mb-6">
        <Card
          title={draft?.id ? "Edit category" : "Add category"}
          action={
            <Button onClick={() => setDraft(draft ? null : emptyDraft())}>
              {draft ? "Cancel" : "Add category"}
            </Button>
          }
        >
          {draft ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const values = {
                  slug: draft.slug,
                  name: draft.name.trim(),
                  description: draft.description.trim() || null,
                  parentId: draft.parentId || null,
                  sortOrder: Number(draft.sortOrder) || 0,
                  isActive: draft.isActive,
                };
                if (draft.id) update.mutate({ id: draft.id, ...values });
                else create.mutate(values);
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
                              // Auto-derived only while creating: changing an existing
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
                  hint="Lowercase, single hyphens — e.g. tiles-flooring, never tiles--flooring."
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
                  label="Parent category"
                  htmlFor="parentId"
                  hint="Leave empty for a top-level category."
                  errors={errors["parentId"]}
                >
                  <Select
                    id="parentId"
                    value={draft.parentId}
                    onChange={(event) =>
                      setDraft({ ...draft, parentId: event.target.value })
                    }
                  >
                    <option value="">No parent (top level)</option>
                    {parentOptions
                      // A category cannot be its own parent. The server enforces the
                      // full cycle check; this just keeps the obvious case out of the
                      // dropdown.
                      .filter((option) => option.id !== draft.id)
                      .map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                  </Select>
                </Field>

                <Field
                  label="Sort order"
                  htmlFor="sortOrder"
                  hint="Lower comes first. Leave gaps (0, 10, 20…) so one can be inserted later."
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

              <Checkbox
                label="Active (visible on the storefront)"
                checked={draft.isActive}
                onChange={(event) =>
                  setDraft({ ...draft, isActive: event.target.checked })
                }
              />

              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Saving…" : draft.id ? "Save changes" : "Add category"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-ink-600">
              {categories.data?.length ?? 0} categories, including subcategories.
            </p>
          )}
        </Card>
      </div>

      {categories.isLoading ? <Spinner /> : null}

      {categories.data && categories.data.length > 0 ? (
        <Table
          head={["Order", "Name", "Parent", "Slug", "Products", "Subs", "State", ""]}
        >
          {categories.data.map((category) => (
            <tr
              key={category.id}
              className={category.isActive ? "" : "opacity-60"}
            >
              <td className="px-4 py-2 text-ink-600">{category.sortOrder}</td>
              <td className="px-4 py-2 font-medium">
                {/* Indented so the two-level shape is readable in a flat table. */}
                {category.parent ? (
                  <span className="text-ink-400">↳ </span>
                ) : null}
                {category.name}
              </td>
              <td className="px-4 py-2 text-ink-600">
                {category.parent?.name ?? "—"}
              </td>
              <td className="px-4 py-2 text-ink-600">{category.slug}</td>
              <td className="px-4 py-2 text-ink-600">{category.productCount}</td>
              <td className="px-4 py-2 text-ink-600">{category.childCount}</td>
              <td className="px-4 py-2">
                {category.isActive ? "Active" : "Inactive"}
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap justify-end gap-1">
                  <Button
                    onClick={() =>
                      setDraft({
                        id: category.id,
                        slug: category.slug,
                        name: category.name,
                        description: category.description ?? "",
                        parentId: category.parentId ?? "",
                        sortOrder: String(category.sortOrder),
                        isActive: category.isActive,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() =>
                      setActive.mutate({
                        id: category.id,
                        isActive: !category.isActive,
                      })
                    }
                    disabled={pending}
                  >
                    {category.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <ConfirmButton
                    message="Delete this category? Only an empty category can be deleted."
                    onConfirm={() => remove.mutate({ id: category.id })}
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
