import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-signal-700">
        404
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        We could not find that page
      </h1>
      <p className="mt-3 text-concrete-600">
        The product or category may have been renamed or withdrawn from the
        catalog.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/products"
          className="rounded-md bg-signal-600 px-5 py-2.5 font-medium text-white hover:bg-signal-700"
        >
          Browse the catalog
        </Link>
        <Link
          href="/stages"
          className="rounded-md border border-concrete-400 px-5 py-2.5 font-medium hover:bg-concrete-100"
        >
          Shop by build stage
        </Link>
      </div>
    </div>
  );
}
