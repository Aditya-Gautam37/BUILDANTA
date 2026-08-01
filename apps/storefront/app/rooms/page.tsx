import type { Metadata } from "next";
import Link from "next/link";

import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "Shop by room",
  description:
    "Construction materials grouped by the part of the building they are for.",
};

export default async function RoomsPage() {
  const rooms = await api.catalog.taxonomy.rooms.query();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Shop by room</h1>
      <p className="mt-1 text-concrete-600">
        Materials grouped by the part of the building they are for.
      </p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <li key={room.id}>
            <Link
              href={`/rooms/${room.slug}`}
              className="flex h-full flex-col rounded-lg border border-concrete-200 bg-white p-5 hover:border-signal-500 hover:shadow-sm"
            >
              <span className="text-lg font-semibold">{room.name}</span>
              {room.description ? (
                <span className="mt-1 text-sm text-concrete-600">
                  {room.description}
                </span>
              ) : null}
              <span className="mt-auto pt-3 text-sm text-concrete-600">
                {room.productCount} product{room.productCount === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
