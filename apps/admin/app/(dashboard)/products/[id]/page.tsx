"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { ImageManager } from "@/components/image-manager";
import { ProductForm } from "@/components/product-form";
import { VariantManager } from "@/components/variant-manager";
import {
  Alert,
  Button,
  Card,
  ConfirmButton,
  PageHeader,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

export default function EditProductPage() {
  const routeParams = useParams<{ id: string }>();
  const id = routeParams.id;

  const router = useRouter();
  const utils = trpc.useUtils();
  const product = trpc.admin.products.byId.useQuery({ id });

  const [saved, setSaved] = useState(false);

  const update = trpc.admin.products.update.useMutation({
    async onSuccess() {
      await utils.admin.products.invalidate();
      setSaved(true);
    },
  });

  const setStatus = trpc.admin.products.setStatus.useMutation({
    onSuccess: () => utils.admin.products.invalidate(),
  });

  const remove = trpc.admin.products.delete.useMutation({
    async onSuccess() {
      await utils.admin.products.invalidate();
      router.replace("/products");
    },
  });

  if (product.isLoading) return <Spinner />;
  if (product.error)
    return <Alert tone="error">{errorMessage(product.error)}</Alert>;
  if (!product.data) return null;

  const record = product.data;
  const canPublish = record.variantCount > 0 && record.images.length > 0;
  const neverPublished = record.publishedAt === null;

  return (
    <div>
      <PageHeader
        title={record.name}
        description={record.slug}
        action={<StatusBadge status={record.status} />}
      />

      <div className="mb-6">
        <Card title="Publishing">
          {setStatus.error ? (
            <div className="mb-3">
              <Alert tone="error">{errorMessage(setStatus.error)}</Alert>
            </div>
          ) : null}

          {!canPublish && record.status !== "ACTIVE" ? (
            <div className="mb-3">
              <Alert tone="warn">
                Not ready to publish:{" "}
                {record.variantCount === 0
                  ? "add a variant with a price"
                  : "add a product image"}
                .
              </Alert>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {record.status !== "ACTIVE" ? (
              <Button
                variant="primary"
                disabled={!canPublish || setStatus.isPending}
                onClick={() => setStatus.mutate({ id, status: "ACTIVE" })}
              >
                Publish
              </Button>
            ) : (
              <Button
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate({ id, status: "DRAFT" })}
              >
                Unpublish (back to draft)
              </Button>
            )}

            {record.status !== "ARCHIVED" ? (
              <ConfirmButton
                message="Archive this product? It disappears from the storefront but keeps its history."
                onConfirm={() => setStatus.mutate({ id, status: "ARCHIVED" })}
                disabled={setStatus.isPending}
              >
                Archive
              </ConfirmButton>
            ) : null}

            {/* Deletion is only offered for a product that was never published.
                Anything with history is referenced by quote requests. */}
            {neverPublished ? (
              <ConfirmButton
                message="Delete this draft permanently? Its variants and images go with it."
                onConfirm={() => remove.mutate({ id })}
                disabled={remove.isPending}
              >
                Delete draft
              </ConfirmButton>
            ) : null}
          </div>

          {!neverPublished ? (
            <p className="mt-3 text-xs text-ink-600">
              This product has been published before, so it can be archived but not
              deleted — quote requests reference its SKUs.
            </p>
          ) : null}

          {remove.error ? (
            <div className="mt-3">
              <Alert tone="error">{errorMessage(remove.error)}</Alert>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {saved ? <Alert tone="success">Details saved.</Alert> : null}

          <ProductForm
            // Remounts when the record changes, so the form's internal state is
            // seeded from fresh server data rather than holding a stale copy.
            key={`${record.id}-${record.updatedAt.toISOString()}`}
            initial={{
              slug: record.slug,
              name: record.name,
              summary: record.summary ?? "",
              description: record.description ?? "",
              categoryId: record.category.id,
              brandId: record.brand?.id ?? "",
              specifications: Object.entries(record.specifications).map(
                ([key, value]) => ({ key, value }),
              ),
              roomIds: record.rooms.map((room) => room.id),
              stageIds: record.stages.map((stage) => stage.id),
            }}
            submitLabel="Save details"
            pending={update.isPending}
            error={update.error}
            onSubmit={(values) => {
              setSaved(false);
              update.mutate({ ...values, id });
            }}
          />
        </div>

        <div className="space-y-6">
          <VariantManager productId={id} variants={record.variants} />
          <ImageManager productId={id} images={record.images} />
        </div>
      </div>
    </div>
  );
}
