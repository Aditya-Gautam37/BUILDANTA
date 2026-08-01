import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { api } from "@/lib/api";

export default async function HomePage() {
  const [categories, stages, rooms, newest] = await Promise.all([
    api.catalog.taxonomy.categoryTree.query(),
    api.catalog.taxonomy.stages.query(),
    api.catalog.taxonomy.rooms.query(),
    api.catalog.products.list.query({ sort: "newest", limit: 8, page: 1 }),
  ]);

  // Empty taxonomy entries are hidden rather than rendered as dead links to an
  // empty result page.
  const stagesWithProducts = stages.filter((stage) => stage.productCount > 0);
  const roomsWithProducts = rooms.filter((room) => room.productCount > 0);

  return (
    <div>
      <section className="bg-steel-700 text-white">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Everything you need to finish your home, in one place
          </h1>
          <p className="mt-4 max-w-xl text-lg text-concrete-100">
            Cement by the bag, steel by the tonne, tile by the box. Browse by
            build stage, by room, or by category — then request a bulk quote.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/stages"
              className="rounded-md bg-signal-500 px-6 py-3 font-semibold text-white hover:bg-signal-600"
            >
              Browse by stage
            </Link>
            <Link
              href="/rooms"
              className="rounded-md border border-concrete-200 px-6 py-3 font-semibold text-white hover:bg-steel-600"
            >
              Browse by room
            </Link>
          </div>
        </div>
      </section>

      {stagesWithProducts.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 py-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Shop by build stage
          </h2>
          <p className="mt-1 text-concrete-600">
            In the order the work actually happens on site.
          </p>
          <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stagesWithProducts.map((stage, index) => (
              <li key={stage.id}>
                <Link
                  href={`/stages/${stage.slug}`}
                  className="flex h-full flex-col justify-between rounded-lg border border-concrete-200 bg-white p-4 hover:border-signal-500 hover:shadow-sm"
                >
                  <span className="text-xs font-semibold text-signal-700">
                    Stage {index + 1}
                  </span>
                  <span className="mt-1 font-semibold">{stage.name}</span>
                  <span className="mt-2 text-sm text-concrete-600">
                    {stage.productCount} product
                    {stage.productCount === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Categories</h2>
          <Link
            href="/categories"
            className="text-sm font-medium text-signal-700 hover:underline"
          >
            View all categories
          </Link>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="rounded-lg border border-concrete-200 bg-white p-5"
            >
              <Link
                href={`/categories/${category.slug}`}
                className="text-lg font-semibold hover:text-signal-700"
              >
                {category.name}
              </Link>
              {category.children.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {category.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={`/categories/${child.slug}`}
                        className="text-concrete-600 hover:text-signal-700"
                      >
                        {child.name}
                        <span className="ml-1 text-concrete-400">
                          ({child.productCount})
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {newest.items.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 py-12">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Recently added</h2>
            <Link
              href="/products?sort=newest"
              className="text-sm font-medium text-signal-700 hover:underline"
            >
              See all
            </Link>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {newest.items.map((product) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {roomsWithProducts.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-12">
          <h2 className="text-2xl font-bold tracking-tight">Shop by room</h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {roomsWithProducts.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/rooms/${room.slug}`}
                  className="inline-block rounded-full border border-concrete-400 bg-white px-4 py-2 text-sm font-medium hover:border-signal-500 hover:text-signal-700"
                >
                  {room.name}
                  <span className="ml-1 text-concrete-400">
                    ({room.productCount})
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="rounded-lg bg-concrete-900 px-6 py-10 text-center text-white">
          <h2 className="text-2xl font-bold tracking-tight">
            Buying for a whole project?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-concrete-200">
            Add what you need to a quote request and we will come back with
            pricing for the full list.
          </p>
          <Link
            href="/quote"
            className="mt-6 inline-block rounded-md bg-signal-500 px-6 py-3 font-semibold hover:bg-signal-600"
          >
            Get bulk quotes
          </Link>
        </div>
      </section>
    </div>
  );
}
