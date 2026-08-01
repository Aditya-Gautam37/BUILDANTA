"use client";

import { formatMoney, formatUnit } from "@buildanta/api/client";
import type { VariantDto } from "@buildanta/api/client";
import { useState } from "react";

import {
  Alert,
  Button,
  Card,
  ConfirmButton,
  Field,
  Input,
  Select,
  Table,
} from "@/components/ui";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

const UNITS = [
  "PIECE",
  "BAG",
  "BOX",
  "BUNDLE",
  "ROLL",
  "SHEET",
  "METRE",
  "SQUARE_METRE",
  "CUBIC_METRE",
  "LITRE",
  "KILOGRAM",
  "TONNE",
] as const;

interface Draft {
  sku: string;
  name: string;
  price: string;
  unit: (typeof UNITS)[number];
  packSize: string;
  weightKg: string;
  supplierId: string;
}

function emptyDraft(): Draft {
  return {
    sku: "",
    name: "",
    price: "",
    unit: "PIECE",
    packSize: "",
    weightKg: "",
    supplierId: "",
  };
}

/**
 * Variants are where SKU and price live, so this is the part of the admin that
 * actually determines what the storefront shows. Every mutation here recomputes the
 * product's price summary server-side inside the same transaction.
 */
export function VariantManager({
  productId,
  variants,
}: {
  productId: string;
  variants: VariantDto[];
}) {
  const utils = trpc.useUtils();
  const suppliers = trpc.admin.suppliers.options.useQuery();

  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    // The product query is invalidated too, not just the variant list: adding a
    // variant changes the product's "from" price and whether it can be published.
    await utils.admin.products.invalidate();
    await utils.admin.variants.invalidate();
  }

  const create = trpc.admin.variants.create.useMutation({
    async onSuccess() {
      await refresh();
      setDraft(emptyDraft());
      setShowForm(false);
    },
  });

  const setActive = trpc.admin.variants.setActive.useMutation({
    onSuccess: refresh,
  });
  const setDefault = trpc.admin.variants.setDefault.useMutation({
    onSuccess: refresh,
  });
  const remove = trpc.admin.variants.delete.useMutation({ onSuccess: refresh });

  const errors = fieldErrors(create.error);
  const mutationError =
    create.error ?? setActive.error ?? setDefault.error ?? remove.error;

  return (
    <Card
      title={`Variants (${variants.length})`}
      action={
        <Button onClick={() => setShowForm((open) => !open)}>
          {showForm ? "Cancel" : "Add variant"}
        </Button>
      }
    >
      {mutationError ? (
        <div className="mb-3">
          <Alert tone="error">{errorMessage(mutationError)}</Alert>
        </div>
      ) : null}

      {setActive.data?.productUnpublished ? (
        <div className="mb-3">
          <Alert tone="warn">
            That was the last active variant, so the product has been moved back to
            draft — a published product with no price would be broken on the
            storefront.
          </Alert>
        </div>
      ) : null}

      {showForm ? (
        <form
          className="mb-4 space-y-3 rounded-md border border-ink-200 bg-ink-50 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({
              productId,
              sku: draft.sku.trim(),
              name: draft.name.trim(),
              price: draft.price.trim(),
              unit: draft.unit,
              packSize: draft.packSize.trim() || null,
              weightKg: draft.weightKg.trim() || null,
              supplierId: draft.supplierId || null,
              attributes: {},
              isDefault: variants.length === 0,
              isActive: true,
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="SKU" htmlFor="sku" required errors={errors["sku"]}>
              <Input
                id="sku"
                required
                placeholder="UT-OPC53-50KG"
                value={draft.sku}
                onChange={(event) =>
                  setDraft({ ...draft, sku: event.target.value })
                }
              />
            </Field>

            <Field
              label="Option name"
              htmlFor="variant-name"
              required
              hint="What distinguishes it, e.g. “50 kg bag”."
              errors={errors["name"]}
            >
              <Input
                id="variant-name"
                required
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </Field>

            <Field
              label="Price"
              htmlFor="price"
              required
              hint="Per unit, e.g. 435.00"
              errors={errors["price"]}
            >
              <Input
                id="price"
                required
                inputMode="decimal"
                placeholder="435.00"
                value={draft.price}
                onChange={(event) =>
                  setDraft({ ...draft, price: event.target.value })
                }
              />
            </Field>

            <Field
              label="Sold by"
              htmlFor="unit"
              required
              hint="The unit the price is per. Getting this wrong misprices the product."
              errors={errors["unit"]}
            >
              <Select
                id="unit"
                value={draft.unit}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    unit: event.target.value as Draft["unit"],
                  })
                }
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {formatUnit(unit, "long")}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Pack size"
              htmlFor="packSize"
              hint="How many units in one SKU, e.g. 40 for a pallet."
              errors={errors["packSize"]}
            >
              <Input
                id="packSize"
                inputMode="decimal"
                value={draft.packSize}
                onChange={(event) =>
                  setDraft({ ...draft, packSize: event.target.value })
                }
              />
            </Field>

            <Field
              label="Weight (kg)"
              htmlFor="weightKg"
              errors={errors["weightKg"]}
            >
              <Input
                id="weightKg"
                inputMode="decimal"
                value={draft.weightKg}
                onChange={(event) =>
                  setDraft({ ...draft, weightKg: event.target.value })
                }
              />
            </Field>

            <Field label="Supplier" htmlFor="supplierId">
              <Select
                id="supplierId"
                value={draft.supplierId}
                onChange={(event) =>
                  setDraft({ ...draft, supplierId: event.target.value })
                }
              >
                <option value="">Not recorded</option>
                {suppliers.data?.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Adding…" : "Add variant"}
          </Button>
        </form>
      ) : null}

      {variants.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-600">
          No variants yet. A product needs at least one before it can be published.
        </p>
      ) : (
        <Table
          head={["Option", "SKU", "Price", "Sold by", "Supplier", "State", ""]}
        >
          {variants.map((variant) => (
            <tr key={variant.id} className={variant.isActive ? "" : "opacity-60"}>
              <td className="px-4 py-2">
                <span className="font-medium">{variant.name}</span>
                {variant.isDefault ? (
                  <span className="ml-2 rounded-full border border-accent-500 bg-accent-50 px-2 py-0.5 text-xs text-accent-700">
                    default
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-2 text-ink-600">{variant.sku}</td>
              <td className="px-4 py-2 font-medium">
                {formatMoney(variant.price, variant.currency)}
              </td>
              <td className="px-4 py-2 text-ink-600">
                {formatUnit(variant.unit, "long")}
                {variant.packSize ? (
                  <span className="block text-xs">pack of {variant.packSize}</span>
                ) : null}
              </td>
              <td className="px-4 py-2 text-ink-600">
                {variant.supplier?.name ?? "—"}
              </td>
              <td className="px-4 py-2">
                {variant.isActive ? "Active" : "Inactive"}
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap justify-end gap-1">
                  {variant.isActive && !variant.isDefault ? (
                    <Button
                      onClick={() => setDefault.mutate({ id: variant.id })}
                      disabled={setDefault.isPending}
                    >
                      Make default
                    </Button>
                  ) : null}
                  <Button
                    onClick={() =>
                      setActive.mutate({
                        id: variant.id,
                        isActive: !variant.isActive,
                      })
                    }
                    disabled={setActive.isPending}
                  >
                    {variant.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <ConfirmButton
                    message={`Delete variant ${variant.sku}? This cannot be undone.`}
                    onConfirm={() => remove.mutate({ id: variant.id })}
                    disabled={remove.isPending}
                  >
                    Delete
                  </ConfirmButton>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
