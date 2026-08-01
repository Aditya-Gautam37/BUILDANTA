"use client";

import { useState } from "react";

import {
  Alert,
  Button,
  Card,
  Checkbox,
  ConfirmButton,
  EmptyState,
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
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  notes: string;
  isActive: boolean;
}

function emptyDraft(): Draft {
  return {
    id: null,
    slug: "",
    name: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "India",
    notes: "",
    isActive: true,
  };
}

export default function SuppliersPage() {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  const suppliers = trpc.admin.suppliers.list.useQuery({
    page,
    limit: 25,
    ...(q ? { q } : {}),
  });

  const invalidate = () => utils.admin.suppliers.invalidate();

  const create = trpc.admin.suppliers.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });
  const update = trpc.admin.suppliers.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });
  const setActive = trpc.admin.suppliers.setActive.useMutation({
    onSuccess: invalidate,
  });
  const remove = trpc.admin.suppliers.delete.useMutation({
    onSuccess: invalidate,
  });

  const [draft, setDraft] = useState<Draft | null>(null);

  const error =
    suppliers.error ??
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

  const blank = (value: string) => value.trim() || null;

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Who supplies each variant. Purchase orders, goods receipts and stock arrive in Release 3."
      />

      {error ? (
        <div className="mb-4">
          <Alert tone="error">{errorMessage(error)}</Alert>
        </div>
      ) : null}

      <div className="mb-6">
        <Card
          title={draft?.id ? "Edit supplier" : "Add supplier"}
          action={
            <Button onClick={() => setDraft(draft ? null : emptyDraft())}>
              {draft ? "Cancel" : "Add supplier"}
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
                  contactName: blank(draft.contactName),
                  contactEmail: blank(draft.contactEmail),
                  contactPhone: blank(draft.contactPhone),
                  addressLine1: blank(draft.addressLine1),
                  addressLine2: blank(draft.addressLine2),
                  city: blank(draft.city),
                  region: blank(draft.region),
                  postalCode: blank(draft.postalCode),
                  country: blank(draft.country),
                  notes: blank(draft.notes),
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
                  label="Slug"
                  htmlFor="slug"
                  required
                  hint="Internal identifier. Not shown to customers."
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
                  label="Contact name"
                  htmlFor="contactName"
                  errors={errors["contactName"]}
                >
                  <Input
                    id="contactName"
                    value={draft.contactName}
                    onChange={(event) =>
                      setDraft({ ...draft, contactName: event.target.value })
                    }
                  />
                </Field>

                <Field
                  label="Email"
                  htmlFor="contactEmail"
                  errors={errors["contactEmail"]}
                >
                  <Input
                    id="contactEmail"
                    type="email"
                    value={draft.contactEmail}
                    onChange={(event) =>
                      setDraft({ ...draft, contactEmail: event.target.value })
                    }
                  />
                </Field>

                <Field
                  label="Phone"
                  htmlFor="contactPhone"
                  errors={errors["contactPhone"]}
                >
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={draft.contactPhone}
                    onChange={(event) =>
                      setDraft({ ...draft, contactPhone: event.target.value })
                    }
                  />
                </Field>

                <Field
                  label="Address"
                  htmlFor="addressLine1"
                  errors={errors["addressLine1"]}
                >
                  <Input
                    id="addressLine1"
                    value={draft.addressLine1}
                    onChange={(event) =>
                      setDraft({ ...draft, addressLine1: event.target.value })
                    }
                  />
                </Field>

                <Field
                  label="Address line 2"
                  htmlFor="addressLine2"
                  errors={errors["addressLine2"]}
                >
                  <Input
                    id="addressLine2"
                    value={draft.addressLine2}
                    onChange={(event) =>
                      setDraft({ ...draft, addressLine2: event.target.value })
                    }
                  />
                </Field>

                <Field label="City" htmlFor="city" errors={errors["city"]}>
                  <Input
                    id="city"
                    value={draft.city}
                    onChange={(event) =>
                      setDraft({ ...draft, city: event.target.value })
                    }
                  />
                </Field>

                <Field
                  label="State"
                  htmlFor="region"
                  errors={errors["region"]}
                >
                  <Input
                    id="region"
                    value={draft.region}
                    onChange={(event) =>
                      setDraft({ ...draft, region: event.target.value })
                    }
                  />
                </Field>

                <Field
                  label="Pincode"
                  htmlFor="postalCode"
                  errors={errors["postalCode"]}
                >
                  <Input
                    id="postalCode"
                    inputMode="numeric"
                    value={draft.postalCode}
                    onChange={(event) =>
                      setDraft({ ...draft, postalCode: event.target.value })
                    }
                  />
                </Field>

                <Field label="Country" htmlFor="country" errors={errors["country"]}>
                  <Input
                    id="country"
                    value={draft.country}
                    onChange={(event) =>
                      setDraft({ ...draft, country: event.target.value })
                    }
                  />
                </Field>
              </div>

              <Field label="Notes" htmlFor="notes" errors={errors["notes"]}>
                <Textarea
                  id="notes"
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft({ ...draft, notes: event.target.value })
                  }
                  placeholder="Lead times, minimum order, delivery constraints…"
                />
              </Field>

              <Checkbox
                label="Active (offered on the variant form)"
                checked={draft.isActive}
                onChange={(event) =>
                  setDraft({ ...draft, isActive: event.target.checked })
                }
              />

              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Saving…" : draft.id ? "Save changes" : "Add supplier"}
              </Button>
            </form>
          ) : (
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setQ(search.trim());
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
                  placeholder="Name, city or email"
                />
              </div>
              <Button type="submit">Search</Button>
              {q ? (
                <Button
                  onClick={() => {
                    setSearch("");
                    setQ("");
                    setPage(1);
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </form>
          )}
        </Card>
      </div>

      {suppliers.isLoading ? <Spinner /> : null}

      {suppliers.data && suppliers.data.items.length === 0 ? (
        <EmptyState
          title="No suppliers yet"
          description="Add one so variants can record where they are sourced from."
        />
      ) : null}

      {suppliers.data && suppliers.data.items.length > 0 ? (
        <>
          <Table
            head={["Name", "Contact", "Location", "Variants", "State", ""]}
          >
            {suppliers.data.items.map((supplier) => (
              <tr
                key={supplier.id}
                className={supplier.isActive ? "" : "opacity-60"}
              >
                <td className="px-4 py-2 font-medium">{supplier.name}</td>
                <td className="px-4 py-2 text-ink-600">
                  {supplier.contactName ?? "—"}
                  {supplier.contactEmail ? (
                    <span className="block text-xs">{supplier.contactEmail}</span>
                  ) : null}
                  {supplier.contactPhone ? (
                    <span className="block text-xs">{supplier.contactPhone}</span>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-ink-600">
                  {[supplier.city, supplier.country].filter(Boolean).join(", ") ||
                    "—"}
                </td>
                <td className="px-4 py-2 text-ink-600">
                  {supplier.variantCount}
                </td>
                <td className="px-4 py-2">
                  {supplier.isActive ? "Active" : "Inactive"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button
                      onClick={() =>
                        setDraft({
                          id: supplier.id,
                          slug: supplier.slug,
                          name: supplier.name,
                          contactName: supplier.contactName ?? "",
                          contactEmail: supplier.contactEmail ?? "",
                          contactPhone: supplier.contactPhone ?? "",
                          addressLine1: supplier.addressLine1 ?? "",
                          addressLine2: supplier.addressLine2 ?? "",
                          city: supplier.city ?? "",
                          region: supplier.region ?? "",
                          postalCode: supplier.postalCode ?? "",
                          country: supplier.country ?? "India",
                          notes: supplier.notes ?? "",
                          isActive: supplier.isActive,
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() =>
                        setActive.mutate({
                          id: supplier.id,
                          isActive: !supplier.isActive,
                        })
                      }
                      disabled={pending}
                    >
                      {supplier.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <ConfirmButton
                      message="Delete this supplier? Only one with no variants can be deleted."
                      onConfirm={() => remove.mutate({ id: supplier.id })}
                      disabled={pending}
                    >
                      Delete
                    </ConfirmButton>
                  </div>
                </td>
              </tr>
            ))}
          </Table>

          {suppliers.data.pageCount > 1 ? (
            <div className="mt-4 flex items-center gap-2">
              <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-ink-600">
                Page {suppliers.data.page} of {suppliers.data.pageCount}
              </span>
              <Button
                disabled={page >= suppliers.data.pageCount}
                onClick={() => setPage(page + 1)}
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
