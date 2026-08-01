"use client";

import { useRouter } from "next/navigation";

import { ProductForm, emptyProductForm } from "@/components/product-form";
import { Alert, PageHeader } from "@/components/ui";
import { trpc } from "@/lib/trpc";

export default function NewProductPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const create = trpc.admin.products.create.useMutation({
    async onSuccess(product) {
      await utils.admin.products.invalidate();
      // Straight to the editor, because a new product still needs a variant and an
      // image before it can be published.
      router.replace(`/products/${product.id}`);
    },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New product"
        description="Created as a draft. Add a variant and an image, then publish."
      />

      <div className="mb-4">
        <Alert tone="info">
          A product is published only once it has at least one active variant with a
          price and at least one image — otherwise it would appear on the storefront
          with no price.
        </Alert>
      </div>

      <ProductForm
        initial={emptyProductForm()}
        submitLabel="Create draft"
        pending={create.isPending}
        error={create.error}
        onSubmit={(values) =>
          create.mutate({
            ...values,
            // The router rejects ACTIVE on create; being explicit here documents that
            // rather than relying on a default.
            status: "DRAFT",
          })
        }
      />
    </div>
  );
}
