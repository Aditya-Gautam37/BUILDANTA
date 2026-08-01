"use client";

import { useState } from "react";

import {
  Alert,
  Button,
  Card,
  CheckboxGroup,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import { trpc } from "@/lib/trpc";

export interface ProductFormValues {
  slug: string;
  name: string;
  summary: string;
  description: string;
  categoryId: string;
  brandId: string;
  specifications: { key: string; value: string }[];
  roomIds: string[];
  stageIds: string[];
}

export function emptyProductForm(): ProductFormValues {
  return {
    slug: "",
    name: "",
    summary: "",
    description: "",
    categoryId: "",
    brandId: "",
    specifications: [],
    roomIds: [],
    stageIds: [],
  };
}

/**
 * The product details form, shared by create and edit.
 *
 * Specifications are held as an ordered array of pairs rather than an object,
 * because an object would lose row order and could not represent a blank new row
 * while it is being typed. It is converted to a record on submit.
 */
export function ProductForm({
  initial,
  submitLabel,
  onSubmit,
  pending,
  error,
}: {
  initial: ProductFormValues;
  submitLabel: string;
  onSubmit: (values: {
    slug: string;
    name: string;
    summary: string | null;
    description: string | null;
    categoryId: string;
    brandId: string | null;
    specifications: Record<string, string>;
    roomIds: string[];
    stageIds: string[];
  }) => void;
  pending: boolean;
  error: unknown;
}) {
  const options = trpc.admin.products.formOptions.useQuery();
  const [values, setValues] = useState(initial);
  // Tracked so the slug stops auto-following the name once it has been edited by
  // hand — silently overwriting a deliberate slug would change a live URL.
  const [slugLocked, setSlugLocked] = useState(initial.slug.length > 0);

  const errors = fieldErrors(error);

  /**
   * Renders nothing until the dropdown data exists, which is a correctness
   * requirement here rather than a nicety.
   *
   * The category `<select>` is `required`, and on the edit form it arrives with
   * a category already chosen. While this query is still in flight the select
   * has no `<option>` elements to hold that value, so its value is the empty
   * placeholder and the browser refuses to submit the form — "Please select an
   * item in the list", pointing at a field the user never touched. Native
   * validation fires no React event and renders none of our own messages, so
   * the failure is completely silent: no request, no error, no success. Anyone
   * who edited a name and hit save inside that window saw nothing happen.
   */
  if (!options.data) {
    return (
      <Card title="Details">
        <Spinner label="Loading form options…" />
      </Card>
    );
  }

  function update<K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const categoryOptions = (options.data?.categories ?? []).map((category) => {
    const parent = options.data?.categories.find(
      (entry) => entry.id === category.parentId,
    );
    return {
      id: category.id,
      // Parent prefix, because subcategory names alone ("Cement", "Membranes") are
      // ambiguous in a flat dropdown.
      label: parent ? `${parent.name} → ${category.name}` : category.name,
      isActive: category.isActive,
    };
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        const specifications: Record<string, string> = {};
        for (const row of values.specifications) {
          const key = row.key.trim();
          // Blank rows are an artefact of the editor, not data the user entered.
          if (!key) continue;
          specifications[key] = row.value.trim();
        }

        onSubmit({
          slug: values.slug,
          name: values.name.trim(),
          summary: values.summary.trim() || null,
          description: values.description.trim() || null,
          categoryId: values.categoryId,
          brandId: values.brandId || null,
          specifications,
          roomIds: values.roomIds,
          stageIds: values.stageIds,
        });
      }}
    >
      {error ? <Alert tone="error">{errorMessage(error)}</Alert> : null}

      <Card title="Details">
        <div className="space-y-4">
          <Field label="Name" htmlFor="name" required errors={errors["name"]}>
            <Input
              id="name"
              required
              value={values.name}
              onChange={(event) => {
                const name = event.target.value;
                setValues((current) => ({
                  ...current,
                  name,
                  slug: slugLocked ? current.slug : slugify(name),
                }));
              }}
            />
          </Field>

          <Field
            label="URL slug"
            htmlFor="slug"
            required
            hint="Appears in the public product URL. Lowercase, single hyphens."
            errors={errors["slug"]}
          >
            <Input
              id="slug"
              required
              value={values.slug}
              onChange={(event) => {
                setSlugLocked(true);
                update("slug", event.target.value);
              }}
            />
          </Field>

          <Field
            label="Summary"
            htmlFor="summary"
            hint="One line, shown on product cards and in search results."
            errors={errors["summary"]}
          >
            <Input
              id="summary"
              maxLength={400}
              value={values.summary}
              onChange={(event) => update("summary", event.target.value)}
            />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            errors={errors["description"]}
          >
            <Textarea
              id="description"
              rows={6}
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card title="Classification">
        <div className="space-y-4">
          <Field
            label="Category"
            htmlFor="categoryId"
            required
            errors={errors["categoryId"]}
          >
            <Select
              id="categoryId"
              required
              value={values.categoryId}
              onChange={(event) => update("categoryId", event.target.value)}
            >
              <option value="">Choose a category…</option>
              {categoryOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                  {option.isActive ? "" : " (inactive)"}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Brand" htmlFor="brandId" errors={errors["brandId"]}>
            <Select
              id="brandId"
              value={values.brandId}
              onChange={(event) => update("brandId", event.target.value)}
            >
              <option value="">No brand</option>
              {options.data?.brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
          </Field>

          <CheckboxGroup
            legend="Build stages"
            options={options.data?.stages ?? []}
            selected={values.stageIds}
            onChange={(next) => update("stageIds", next)}
          />

          <CheckboxGroup
            legend="Rooms"
            options={options.data?.rooms ?? []}
            selected={values.roomIds}
            onChange={(next) => update("roomIds", next)}
          />
        </div>
      </Card>

      <Card title="Specifications">
        <p className="text-xs text-ink-600">
          Rendered as a table on the product page, e.g. Grade / 53.
        </p>

        <div className="mt-3 space-y-2">
          {values.specifications.map((row, index) => (
            <div key={index} className="flex gap-2">
              <Input
                aria-label={`Specification ${index + 1} label`}
                placeholder="Label"
                value={row.key}
                onChange={(event) =>
                  update(
                    "specifications",
                    values.specifications.map((entry, i) =>
                      i === index ? { ...entry, key: event.target.value } : entry,
                    ),
                  )
                }
              />
              <Input
                aria-label={`Specification ${index + 1} value`}
                placeholder="Value"
                value={row.value}
                onChange={(event) =>
                  update(
                    "specifications",
                    values.specifications.map((entry, i) =>
                      i === index
                        ? { ...entry, value: event.target.value }
                        : entry,
                    ),
                  )
                }
              />
              <Button
                variant="danger"
                aria-label={`Remove specification ${index + 1}`}
                onClick={() =>
                  update(
                    "specifications",
                    values.specifications.filter((_, i) => i !== index),
                  )
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </div>

        <Button
          className="mt-3"
          onClick={() =>
            update("specifications", [
              ...values.specifications,
              { key: "", value: "" },
            ])
          }
        >
          Add specification
        </Button>
      </Card>

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
