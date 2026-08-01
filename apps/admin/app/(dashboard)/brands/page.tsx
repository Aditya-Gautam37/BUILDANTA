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
  logoUrl: string;
  websiteUrl: string;
  isActive: boolean;
}

function emptyDraft(): Draft {
  return {
    id: null,
    slug: "",
    name: "",
    description: "",
    logoUrl: "",
    websiteUrl: "",
    isActive: true,
  };
}

export default function BrandsPage() {
  const utils = trpc.useUtils();
  const brands = trpc.admin.brands.list.useQuery();

  const invalidate = async () => {
    await utils.admin.brands.invalidate();
    await utils.admin.products.formOptions.invalidate();
  };

  const create = trpc.admin.brands.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });
  const update = trpc.admin.brands.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });
  const setActive = trpc.admin.brands.setActive.useMutation({
    onSuccess: invalidate,
  });
  const remove = trpc.admin.brands.delete.useMutation({ onSuccess: invalidate });

  const [draft, setDraft] = useState<Draft | null>(null);

  const error =
    brands.error ??
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

  return (
    <div>
      <PageHeader
        title="Brands"
        description="Manufacturers whose products appear in the catalog. Deactivating a brand hides it from storefront filters without touching its products."
      />

      {error ? (
        <div className="mb-4">
          <Alert tone="error">{errorMessage(error)}</Alert>
        </div>
      ) : null}

      <div className="mb-6">
        <Card
          title={draft?.id ? "Edit brand" : "Add brand"}
          action={
            <Button onClick={() => setDraft(draft ? null : emptyDraft())}>
              {draft ? "Cancel" : "Add brand"}
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
                  // Empty strings are sent as null: the schema validates these as
                  // URLs, and "" is not a URL.
                  logoUrl: draft.logoUrl.trim() || null,
                  websiteUrl: draft.websiteUrl.trim() || null,
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
                  hint="Used in storefront filter links, e.g. /products?brand=asian-paints"
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
                  label="Logo URL"
                  htmlFor="logoUrl"
                  hint="Full https:// URL, or leave empty."
                  errors={errors["logoUrl"]}
                >
                  <Input
                    id="logoUrl"
                    type="url"
                    value={draft.logoUrl}
                    onChange={(event) =>
                      setDraft({ ...draft, logoUrl: event.target.value })
                    }
                  />
                </Field>

                <Field
                  label="Website"
                  htmlFor="websiteUrl"
                  errors={errors["websiteUrl"]}
                >
                  <Input
                    id="websiteUrl"
                    type="url"
                    value={draft.websiteUrl}
                    onChange={(event) =>
                      setDraft({ ...draft, websiteUrl: event.target.value })
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
                label="Active (appears in storefront filters)"
                checked={draft.isActive}
                onChange={(event) =>
                  setDraft({ ...draft, isActive: event.target.checked })
                }
              />

              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Saving…" : draft.id ? "Save changes" : "Add brand"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-ink-600">
              {brands.data?.length ?? 0} brands.
            </p>
          )}
        </Card>
      </div>

      {brands.isLoading ? <Spinner /> : null}

      {brands.data && brands.data.length > 0 ? (
        <Table head={["Name", "Slug", "Products", "State", ""]}>
          {brands.data.map((brand) => (
            <tr key={brand.id} className={brand.isActive ? "" : "opacity-60"}>
              <td className="px-4 py-2 font-medium">{brand.name}</td>
              <td className="px-4 py-2 text-ink-600">{brand.slug}</td>
              <td className="px-4 py-2 text-ink-600">{brand.productCount}</td>
              <td className="px-4 py-2">
                {brand.isActive ? "Active" : "Inactive"}
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap justify-end gap-1">
                  <Button
                    onClick={() =>
                      setDraft({
                        id: brand.id,
                        slug: brand.slug,
                        name: brand.name,
                        description: brand.description ?? "",
                        logoUrl: brand.logoUrl ?? "",
                        websiteUrl: brand.websiteUrl ?? "",
                        isActive: brand.isActive,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() =>
                      setActive.mutate({
                        id: brand.id,
                        isActive: !brand.isActive,
                      })
                    }
                    disabled={pending}
                  >
                    {brand.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <ConfirmButton
                    message="Delete this brand? Only a brand with no products can be deleted."
                    onConfirm={() => remove.mutate({ id: brand.id })}
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
